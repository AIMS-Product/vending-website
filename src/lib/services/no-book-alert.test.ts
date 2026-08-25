import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { formatNoBookAlert, runNoBookAlertCron } from "./no-book-alert";

type LeadRow = Tables<"lead_submissions">;

const NOW = new Date("2026-08-25T15:00:00.000Z");

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    full_name: "Test Person",
    email: "test@example.com",
    phone: "(555) 123-4567",
    source_path: "/vending-machine-business",
    landing_path: "/",
    qualification_summary: {},
    metadata: { source: "chatbot" },
    call_booked_at: null,
    created_at: "2026-08-25T14:40:00.000Z",
    ...overrides,
  } as LeadRow;
}

type Filters = Record<string, unknown>;

function buildClient(
  options: {
    leads?: LeadRow[];
    bookings?: unknown[];
    listError?: boolean;
    updateError?: boolean;
  } = {},
) {
  const filters: Filters = {};
  const updates: Array<Record<string, unknown>> = [];

  const from = vi.fn((table: string) => {
    if (table === "lead_submissions") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        is: (column: string, value: unknown) => {
          filters[`is:${column}`] = value;
          return chain;
        },
        gte: (column: string, value: unknown) => {
          filters[`gte:${column}`] = value;
          return chain;
        },
        lte: (column: string, value: unknown) => {
          filters[`lte:${column}`] = value;
          return chain;
        },
        neq: (column: string, value: unknown) => {
          filters[`neq:${column}`] = value;
          return chain;
        },
        or: (expression: string) => {
          filters["or"] = expression;
          return chain;
        },
        order: () => chain,
        limit: async () => ({
          data: options.listError ? null : (options.leads ?? []),
          error: options.listError ? { message: "boom" } : null,
        }),
        update: (patch: Record<string, unknown>) => {
          return {
            eq: async (_column: string, id: unknown) => {
              updates.push({ ...patch, __id: id });
              return {
                error: options.updateError ? { message: "boom" } : null,
              };
            },
          };
        },
      };
      return chain;
    }
    if (table === "calendly_bookings") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: async () => ({ data: options.bookings ?? [], error: null }),
      };
      return chain;
    }
    throw new Error(`unexpected table ${table}`);
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    filters,
    updates,
  };
}

function okFetch() {
  return vi.fn(async () => new Response("ok", { status: 200 }));
}

describe("runNoBookAlertCron", () => {
  it("does nothing without a Slack webhook rather than throwing", async () => {
    const { client } = buildClient({ leads: [buildLead()] });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: null,
    });
    expect(result.alerted).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("bounds the window to 15 to 120 minutes so a first run cannot flood", async () => {
    const { client, filters } = buildClient({ leads: [] });
    await runNoBookAlertCron({
      client,
      fetchImpl: okFetch(),
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    expect(filters["lte:created_at"]).toBe("2026-08-25T14:45:00.000Z");
    expect(filters["gte:created_at"]).toBe("2026-08-25T13:00:00.000Z");
    expect(filters["is:call_booked_at"]).toBeNull();
    // The dedupe key lives in the existing metadata jsonb. A dedicated column
    // would be a hand-applied production migration for one timestamp.
    expect(filters["is:metadata->>alerted_no_book_at"]).toBeNull();
  });

  it("never alerts a newsletter subscriber as a no-book lead", async () => {
    const { client, filters } = buildClient({ leads: [] });
    await runNoBookAlertCron({
      client,
      fetchImpl: okFetch(),
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    // Newsletter signups reach lead_submissions through the same
    // createQualificationIntakeSession as the qualification funnel, so without
    // these they get posted to the team as "No call booked".
    expect(filters["neq:lifecycle_status"]).toBe("newsletter_subscribed");
    // The or() keeps rows with a NULL form id, which is every plain contact
    // lead. A bare neq() would drop all of them.
    expect(filters["or"]).toContain("latest_qualification_form_id.is.null");
    expect(filters["or"]).toContain("latest_qualification_form_id.neq.");
  });

  it("can be switched off without taking lead notifications down too", async () => {
    const { client } = buildClient({ leads: [buildLead()] });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
      enabled: "false",
    });
    expect(result.scanned).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("alerts an unbooked lead and stamps it so it is not alerted twice", async () => {
    const { client, updates } = buildClient({ leads: [buildLead()] });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    expect(result).toEqual({
      scanned: 1,
      alerted: 1,
      skippedBooked: 0,
      failed: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(updates[0].metadata).toEqual({
      source: "chatbot",
      alerted_no_book_at: NOW.toISOString(),
    });
  });

  it("sends one message per person, not one per lead row", async () => {
    // Confirmed in production 2026-08-25: two rows for one address eight minutes
    // apart, both inside one window. /contact mints a fresh idempotencyKey every
    // page render, so a reload gives one person another row.
    const { client, updates } = buildClient({
      leads: [
        buildLead({
          id: "lead-1",
          email: "Warren@Example.com",
          created_at: "2026-08-25T14:31:00.000Z",
        }),
        buildLead({
          id: "lead-2",
          email: "warren@example.com",
          created_at: "2026-08-25T14:39:00.000Z",
        }),
      ],
    });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    expect(result.scanned).toBe(2);
    expect(result.alerted).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Both rows stamped, so the duplicate cannot resurface next run.
    expect(updates.map((u) => u.__id).sort()).toEqual(["lead-1", "lead-2"]);
  });

  it("still alerts a row that has no email to collapse on", async () => {
    const { client } = buildClient({
      leads: [
        buildLead({ id: "lead-1", email: null as unknown as string }),
        buildLead({ id: "lead-2", email: null as unknown as string }),
      ],
    });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });
    expect(result.alerted).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not alert a lead who booked through the Calendly redirect", async () => {
    const { client } = buildClient({
      leads: [buildLead()],
      bookings: [{ id: "book-1" }],
    });
    const fetchImpl = okFetch();
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    expect(result.skippedBooked).toBe(1);
    expect(result.alerted).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves an undelivered alert eligible for the next run", async () => {
    const { client, updates } = buildClient({ leads: [buildLead()] });
    const fetchImpl = vi.fn(async () => new Response("no", { status: 500 }));
    const result = await runNoBookAlertCron({
      client,
      fetchImpl,
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });

    expect(result.failed).toBe(1);
    expect(result.alerted).toBe(0);
    // Not stamped: dedupe is on "was told", never on "was looked at".
    expect(updates).toHaveLength(0);
  });

  it("keeps going when one lead fails", async () => {
    const { client } = buildClient({
      leads: [
        buildLead({ id: "lead-1", email: "one@example.com" }),
        buildLead({ id: "lead-2", email: "two@example.com" }),
      ],
      updateError: true,
    });
    const result = await runNoBookAlertCron({
      client,
      fetchImpl: okFetch(),
      now: () => NOW,
      webhookUrl: "https://hooks.slack.test/x",
    });
    expect(result.scanned).toBe(2);
    expect(result.failed).toBe(2);
  });
});

describe("formatNoBookAlert", () => {
  it("makes the phone number tappable and links the admin list", () => {
    const text = formatNoBookAlert(buildLead(), NOW);
    expect(text).toContain("<tel:5551234567|(555) 123-4567>");
    expect(text).toContain("/admin/leads?call=not_booked");
    expect(text).toContain("20 minutes ago");
    expect(text).toContain("Band: not scored yet");
  });

  it("shows the qualification band when there is one", () => {
    const text = formatNoBookAlert(
      buildLead({ qualification_summary: { qualification_band: "A" } }),
      NOW,
    );
    expect(text).toContain("Band: A");
  });

  it("says so plainly when there is no phone number", () => {
    const text = formatNoBookAlert(buildLead({ phone: null }), NOW);
    expect(text).toContain("Phone: not given");
  });

  it("carries no em dashes, en dashes or emojis", () => {
    const text = formatNoBookAlert(buildLead(), NOW);
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
