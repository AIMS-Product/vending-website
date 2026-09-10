import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLOSE_LEAD_MISSING,
  earliestWonDate,
  outcomeFromLabel,
  outcomeUpdate,
  reconcileCloseBookings,
} from "./close-booking-reconcile";
import type { CloseClient } from "@/lib/close/client";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({
  config: { CLOSE_API_KEY: "api_test", CLOSE_API_BASE_URL: undefined },
}));

type StaleLead = {
  id: string;
  close_lead_id: string | null;
  call_status?: string | null;
  closed_won_at?: string | null;
  closed_won_source?: string | null;
};

function buildClient(rows: StaleLead[], updateError: unknown = null) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const or = vi.fn().mockReturnValue({ order });
  const not = vi.fn().mockReturnValue({ or });
  const select = vi.fn().mockReturnValue({ not });

  const update = vi.fn((patch: Record<string, unknown>) => ({
    eq: vi.fn(async (_column: string, id: string) => {
      updates.push({ id, patch });
      return { error: updateError };
    }),
  }));

  const from = vi.fn((table: string) => {
    if (table !== "lead_submissions") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return { select, update };
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    updates,
  };
}

function buildCloseClient(
  leads: Record<
    string,
    { status_label?: string | null; custom?: Record<string, unknown> } | null
  >,
) {
  return {
    getLead: vi.fn(async (id: string) => {
      if (!(id in leads)) throw new Error(`Unexpected lead: ${id}`);
      const lead = leads[id];
      return lead === null ? null : { id, ...lead };
    }),
  } as unknown as CloseClient;
}

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("reconcileCloseBookings", () => {
  it("mirrors the booked date and status onto the lead row", async () => {
    const { client, updates } = buildClient([
      { id: "lead-1", close_lead_id: "close_1" },
    ]);
    const closeClient = buildCloseClient({
      close_1: {
        status_label: "☎️ Call Booked",
        custom: { "First Call Booked Date": "2026-08-21" },
      },
    });

    const result = await reconcileCloseBookings({
      client,
      closeClient,
      now: NOW,
    });

    expect(result).toMatchObject({ scanned: 1, updated: 1, booked: 1 });
    expect(updates).toEqual([
      {
        id: "lead-1",
        patch: {
          call_booked_at: "2026-08-21",
          call_status: "☎️ Call Booked",
          call_reconciled_at: NOW.toISOString(),
          // "Call Booked" asserts nothing about whether it was held.
          call_outcome: null,
          // The label differs from the row's previous (undefined) status, so
          // this is when that status began.
          close_status_at: NOW.toISOString(),
        },
      },
    ]);
  });

  it("records a lead that never booked as null rather than skipping it", async () => {
    const { client, updates } = buildClient([
      { id: "lead-2", close_lead_id: "close_2" },
    ]);
    const closeClient = buildCloseClient({
      close_2: { status_label: "🆕 New", custom: {} },
    });

    const result = await reconcileCloseBookings({
      client,
      closeClient,
      now: NOW,
    });

    // Stamped as checked, so it rotates to the back of the queue instead of
    // being re-read every two minutes forever.
    expect(result).toMatchObject({ updated: 1, booked: 0 });
    expect(updates[0].patch).toMatchObject({
      call_booked_at: null,
      call_reconciled_at: NOW.toISOString(),
    });
  });

  it("never un-books a call when the Close lead has been deleted", async () => {
    const { client, updates } = buildClient([
      { id: "lead-3", close_lead_id: "close_gone" },
    ]);
    const closeClient = buildCloseClient({ close_gone: null });

    const result = await reconcileCloseBookings({
      client,
      closeClient,
      now: NOW,
    });

    expect(result).toMatchObject({ updated: 1, missing: 1, booked: 0 });
    expect(updates[0].patch).toEqual({
      call_status: CLOSE_LEAD_MISSING,
      call_reconciled_at: NOW.toISOString(),
    });
    expect(updates[0].patch).not.toHaveProperty("call_booked_at");
  });

  it("rejects a malformed date instead of writing it to a date column", async () => {
    const { client, updates } = buildClient([
      { id: "lead-4", close_lead_id: "close_4" },
    ]);
    const closeClient = buildCloseClient({
      close_4: {
        status_label: "📞 Follow Up",
        custom: { "First Call Booked Date": "not a date" },
      },
    });

    await reconcileCloseBookings({ client, closeClient, now: NOW });

    expect(updates[0].patch.call_booked_at).toBeNull();
  });

  it("keeps going when one lead read fails", async () => {
    const { client } = buildClient([
      { id: "lead-5", close_lead_id: "close_5" },
      { id: "lead-6", close_lead_id: "close_6" },
    ]);
    const closeClient = {
      getLead: vi.fn(async (id: string) => {
        if (id === "close_5") throw new Error("Close is down");
        return {
          id,
          status_label: "☎️ Call Booked",
          custom: { "First Call Booked Date": "2026-08-22" },
        };
      }),
    } as unknown as CloseClient;

    const result = await reconcileCloseBookings({
      client,
      closeClient,
      now: NOW,
    });

    expect(result).toMatchObject({ scanned: 2, failed: 1, updated: 1 });
  });
});

describe("outcomeFromLabel", () => {
  it("reads the real Close labels, emoji and all", () => {
    expect(outcomeFromLabel("👻 No Show")).toBe("no_show");
    expect(outcomeFromLabel("🔻 Canceled (by Lead)")).toBe("canceled");
    expect(outcomeFromLabel("🕛 Reschedule")).toBe("rescheduled");
    expect(outcomeFromLabel("📄 Contract Sent")).toBe("contract_sent");
    expect(outcomeFromLabel("🏆 Closed / Won")).toBe("won");
  });

  it("claims nothing for labels that assert nothing about the call", () => {
    expect(outcomeFromLabel("📞 Follow Up")).toBeNull();
    expect(outcomeFromLabel("🆕 New")).toBeNull();
    expect(outcomeFromLabel("💔 Lost")).toBeNull();
    expect(outcomeFromLabel("🗓️ Long Term Follow Up")).toBeNull();
    expect(outcomeFromLabel(null)).toBeNull();
  });

  it("does not match 'won' inside another word", () => {
    expect(outcomeFromLabel("Wonky pipeline stage")).toBeNull();
  });
});

describe("earliestWonDate", () => {
  it("takes the first win when a lead has several opportunities", () => {
    expect(
      earliestWonDate([
        { status_type: "won", date_won: "2026-09-02" },
        { status_type: "won", date_won: "2026-08-14" },
      ]),
    ).toBe("2026-08-14");
  });

  it("ignores active opportunities and unusable dates", () => {
    expect(
      earliestWonDate([{ status_type: "active", date_won: null }]),
    ).toBeNull();
    expect(
      earliestWonDate([{ status_type: "won", date_won: "soon" }]),
    ).toBeNull();
    // Orgs that track deals only as a lead status send no opportunities.
    expect(earliestWonDate(undefined)).toBeNull();
    expect(earliestWonDate(null)).toBeNull();
  });

  it("trims a timestamp down to its date", () => {
    expect(
      earliestWonDate([
        { status_type: "won", date_won: "2026-08-14T11:00:00.000Z" },
      ]),
    ).toBe("2026-08-14");
  });
});

describe("outcomeUpdate", () => {
  const row = {
    call_status: null,
    closed_won_at: null,
    closed_won_source: null,
  };

  it("prefers a Close opportunity date over anything inferred", () => {
    expect(
      outcomeUpdate(
        row,
        {
          status_label: "🏆 Closed / Won",
          opportunities: [{ status_type: "won", date_won: "2026-08-14" }],
        },
        NOW,
      ),
    ).toMatchObject({
      call_outcome: "won",
      closed_won_at: "2026-08-14",
      closed_won_source: "close_opportunity",
    });
  });

  it("falls back to today only when the lead is won and has no date at all", () => {
    expect(
      outcomeUpdate(row, { status_label: "🏆 Closed / Won" }, NOW),
    ).toMatchObject({
      call_outcome: "won",
      closed_won_at: NOW.toISOString().slice(0, 10),
      closed_won_source: "status_observed",
    });
  });

  it("never downgrades a real opportunity date to an observed one", () => {
    const dated = {
      call_status: "🏆 Closed / Won",
      closed_won_at: "2026-07-01",
      closed_won_source: "close_opportunity",
    };
    const update = outcomeUpdate(
      dated,
      { status_label: "🏆 Closed / Won" },
      NOW,
    );

    expect(update.closed_won_at).toBeUndefined();
    expect(update.closed_won_source).toBeUndefined();
  });

  it("dates the status only when it actually changed", () => {
    const unchanged = outcomeUpdate(
      { ...row, call_status: "📞 Follow Up" },
      { status_label: "📞 Follow Up" },
      NOW,
    );
    expect(unchanged.close_status_at).toBeUndefined();

    const changed = outcomeUpdate(
      { ...row, call_status: "📞 Follow Up" },
      { status_label: "👻 No Show" },
      NOW,
    );
    expect(changed.close_status_at).toBe(NOW.toISOString());
    expect(changed.call_outcome).toBe("no_show");
  });

  it("does not stamp a won date for a lead that is not won", () => {
    const update = outcomeUpdate(row, { status_label: "💔 Lost" }, NOW);
    expect(update.closed_won_at).toBeUndefined();
    expect(update.call_outcome).toBeNull();
  });
});
