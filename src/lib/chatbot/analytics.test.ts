import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChatbotAnalytics } from "./analytics";
import type { Database } from "@/types/database";

type AnalyticsClient = Pick<SupabaseClient<Database>, "from">;

type FakeRow = {
  id: string;
  created_at: string;
  message_count: number;
  captured_email?: string | null;
  captured_phone?: string | null;
  messages?: unknown;
  prospect_profile?: unknown;
  lead_submission_id?: string | null;
  call_booked_at?: string | null;
  booked_event_uri?: string | null;
  attribution_source?: string | null;
};

const NOW = new Date("2026-08-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

/**
 * Fake `.from().select().gte().order().limit()` (chatbot_conversations) and
 * `.from().select().in().not()` (lead_submissions) chains. `missingColumns`
 * makes any select() that asks for one of those columns come back as a
 * Postgres "column does not exist" error, so the cascading fallback in
 * fetchConversationRows has something real to fall back through.
 */
function fakeClient(options: {
  rows?: FakeRow[];
  bookedLeadIds?: string[];
  missingColumns?: string[];
}) {
  const rows = options.rows ?? [];
  const bookedLeadIds = new Set(options.bookedLeadIds ?? []);
  const missingColumns = options.missingColumns ?? [];

  function conversationsQuery(fields: string) {
    const requested = fields.split(",").map((f) => f.trim());
    const missing = requested.find((f) => missingColumns.includes(f));
    const result = missing
      ? {
          data: null,
          error: {
            message: `column chatbot_conversations.${missing} does not exist`,
          },
        }
      : { data: rows, error: null };
    const builder = {
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };
    return builder;
  }

  function leadSubmissionsQuery() {
    const result = {
      data: Array.from(bookedLeadIds).map((id) => ({ id })),
      error: null,
    };
    const builder = {
      in: () => builder,
      not: () => builder,
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };
    return builder;
  }

  const client = {
    from(table: string) {
      if (table === "chatbot_conversations") {
        return { select: (fields: string) => conversationsQuery(fields) };
      }
      if (table === "lead_submissions") {
        return { select: () => leadSubmissionsQuery() };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client as unknown as AnalyticsClient;
}

describe("getChatbotAnalytics funnels", () => {
  it("counts the four stages as nested sets, so no rate can exceed 100%", async () => {
    const rows: FakeRow[] = [
      {
        id: "a",
        created_at: daysAgo(1),
        message_count: 1,
      },
      {
        id: "b",
        created_at: daysAgo(1),
        message_count: 5,
        captured_email: "b@example.com",
      },
      {
        id: "c",
        created_at: daysAgo(1),
        message_count: 3, // engaged boundary
        captured_phone: "555-0100",
        call_booked_at: "2026-08-23T00:00:00.000Z",
      },
      {
        id: "d",
        created_at: daysAgo(1),
        message_count: 2,
        lead_submission_id: "lead-d",
      },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({ rows, bookedLeadIds: ["lead-d"] }),
      now: () => NOW,
    });

    const d30 = analytics.funnels.d30;
    // Row d is booked via Close reconciliation on only 2 messages and with no
    // captured contact on the conversation itself. Counted independently it
    // would sit in `booked` but not in `captured` or `engaged`, which is what
    // let the strip render a conversion rate above 100%. A booked call implies
    // both of the stages above it, so d is absorbed upward.
    expect(d30.conversations).toBe(4);
    expect(d30.engaged).toBe(3); // b, c, d
    expect(d30.captured).toBe(3); // b, c, d
    expect(d30.booked).toBe(2); // c (own timestamp), d (Close reconciliation)
    expect(d30.engagedRatePct).toBe(75);
    expect(d30.capturedRateOfEngagedPct).toBe(100);
    expect(d30.bookedRateOfCapturedPct).toBe(66.7);
    expect(d30.overallBookedRatePct).toBe(50);

    // The nesting contract itself, which is what stops a rate over 100%.
    expect(d30.engaged).toBeLessThanOrEqual(d30.conversations);
    expect(d30.captured).toBeLessThanOrEqual(d30.engaged);
    expect(d30.booked).toBeLessThanOrEqual(d30.captured);
  });

  it("buckets conversations into the 7/30/90 day windows correctly", async () => {
    const rows: FakeRow[] = [
      { id: "recent", created_at: daysAgo(2), message_count: 1 },
      { id: "mid", created_at: daysAgo(20), message_count: 1 },
      { id: "old", created_at: daysAgo(60), message_count: 1 },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({ rows }),
      now: () => NOW,
    });

    expect(analytics.funnels.d7.conversations).toBe(1);
    expect(analytics.funnels.d30.conversations).toBe(2);
    expect(analytics.funnels.d90.conversations).toBe(3);
  });

  it("splits booked-call attribution into in-chat vs assisted when the column is present", async () => {
    const rows: FakeRow[] = [
      {
        id: "in-chat",
        created_at: daysAgo(1),
        message_count: 4,
        captured_email: "x@example.com",
        call_booked_at: "2026-08-23T00:00:00.000Z",
        booked_event_uri: "https://api.calendly.com/scheduled_events/1",
        attribution_source: "in_chat",
      },
      {
        id: "assisted",
        created_at: daysAgo(1),
        message_count: 4,
        captured_email: "y@example.com",
        lead_submission_id: "lead-y",
        attribution_source: "email_match",
      },
      {
        id: "unattributed",
        created_at: daysAgo(1),
        message_count: 1,
      },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({ rows, bookedLeadIds: ["lead-y"] }),
      now: () => NOW,
    });

    expect(analytics.attributionSplitTrustworthy).toBe(true);
    const d30 = analytics.funnels.d30;
    expect(d30.bySource.inChat.booked).toBe(1);
    expect(d30.bySource.assisted.booked).toBe(1);
    // The unattributed, unbooked row lands in neither bucket.
    expect(
      d30.bySource.inChat.conversations + d30.bySource.assisted.conversations,
    ).toBe(2);
  });

  it("falls back to a heuristic split and marks it untrustworthy when attribution_source is missing", async () => {
    const rows: FakeRow[] = [
      {
        id: "legacy-booked",
        created_at: daysAgo(1),
        message_count: 4,
        captured_email: "z@example.com",
        call_booked_at: "2026-08-23T00:00:00.000Z",
        booked_event_uri: "https://api.calendly.com/scheduled_events/2",
        // No attribution_source: column not migrated on this deploy yet.
      },
      {
        id: "booked-no-uri",
        created_at: daysAgo(1),
        message_count: 4,
        captured_email: "w@example.com",
        lead_submission_id: "lead-w",
        // Booked via Close reconciliation only, no Calendly event URI at all
        // — can't be honestly classified, so it should be excluded.
      },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({
        rows,
        bookedLeadIds: ["lead-w"],
        missingColumns: ["attribution_source"],
      }),
      now: () => NOW,
    });

    expect(analytics.attributionSplitTrustworthy).toBe(false);
    const d30 = analytics.funnels.d30;
    // Overall counts are unaffected by the missing column.
    expect(d30.conversations).toBe(2);
    expect(d30.booked).toBe(2);
    // Legacy heuristic: a booked call with a Calendly event URI counts as
    // in-chat even with no attribution_source column at all.
    expect(d30.bySource.inChat.booked).toBe(1);
    expect(d30.bySource.assisted.booked).toBe(0);
  });

  it("degrades all the way to the pre-v2 shape when call_booked_at is also missing", async () => {
    const rows: FakeRow[] = [
      { id: "a", created_at: daysAgo(1), message_count: 4 },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({
        rows,
        missingColumns: ["attribution_source", "call_booked_at"],
      }),
      now: () => NOW,
    });

    expect(analytics.attributionSplitTrustworthy).toBe(false);
    expect(analytics.funnels.d30.conversations).toBe(1);
  });
});

describe("outcome rollup", () => {
  const calendarTranscript = (question: string) => [
    { role: "user", content: question, ts: daysAgo(3) },
    {
      role: "assistant",
      content: "Opened the booking calendar in the chat.",
      ts: daysAgo(3),
      kind: "calendar",
    },
  ];

  it("splits the last 30 days by what actually happened", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "booked",
            created_at: daysAgo(3),
            message_count: 5,
            messages: calendarTranscript("How much does it cost to start?"),
            captured_email: "booked@example.com",
            call_booked_at: daysAgo(3),
          },
          {
            id: "abandoned",
            created_at: daysAgo(3),
            message_count: 3,
            messages: calendarTranscript("How much does it cost to start?"),
          },
          {
            id: "captured-only",
            created_at: daysAgo(4),
            message_count: 4,
            messages: [
              { role: "user", content: "How does the program work?", ts: daysAgo(4) },
            ],
            captured_email: "warm@example.com",
          },
          {
            id: "gone",
            created_at: daysAgo(5),
            message_count: 1,
            messages: [
              { role: "user", content: "where do i sign up", ts: daysAgo(5) },
            ],
          },
        ],
      }) as never,
    });

    expect(analytics.outcomes.d30).toMatchObject({
      days: 30,
      total: 4,
      booked: 1,
      calendarAbandoned: 1,
      capturedNoBooking: 1,
      leftNoContact: 1,
      open: 0,
    });
    // Both cost askers saw a calendar; only one of them booked.
    expect(analytics.outcomes.d30.costQuestion).toEqual({
      asked: 2,
      sawCalendar: 2,
      captured: 1,
      booked: 1,
    });
  });

  it("counts a call reconciled through the lead row as booked, not abandoned", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "reconciled",
            created_at: daysAgo(2),
            message_count: 4,
            messages: calendarTranscript("what does it cost?"),
            lead_submission_id: "lead-1",
          },
        ],
        bookedLeadIds: ["lead-1"],
      }) as never,
    });

    expect(analytics.outcomes.d30.booked).toBe(1);
    expect(analytics.outcomes.d30.calendarAbandoned).toBe(0);
  });

  it("leaves a chat that is still moving out of the lost buckets", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "live",
            created_at: new Date(NOW.getTime() - 60_000).toISOString(),
            message_count: 2,
            messages: [
              {
                role: "user",
                content: "How much does it cost?",
                ts: new Date(NOW.getTime() - 60_000).toISOString(),
              },
            ],
          },
        ],
      }) as never,
    });

    expect(analytics.outcomes.d7).toMatchObject({ open: 1, leftNoContact: 0 });
  });
});
