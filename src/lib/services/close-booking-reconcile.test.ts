import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLOSE_LEAD_MISSING,
  reconcileCloseBookings,
} from "./close-booking-reconcile";
import type { CloseClient } from "@/lib/close/client";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({
  config: { CLOSE_API_KEY: "api_test", CLOSE_API_BASE_URL: undefined },
}));

type StaleLead = { id: string; close_lead_id: string | null };

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
