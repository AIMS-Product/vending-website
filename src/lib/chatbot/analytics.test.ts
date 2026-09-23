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
  /** lead id -> Close "Reactivation - Setter Name", as the reconciler mirrors it. */
  setters?: Record<string, string>;
  /** lead id -> Close Resource Tag + lead creation time, as the reconciler mirrors them. */
  closeLeads?: Record<
    string,
    { resourceTag: string | null; createdAt: string }
  >;
  /** Calendly event uri -> the lead that booking is linked to, as recordCalendlyBooking wrote it. */
  bookingLeads?: Record<string, string>;
  /** lead id -> Close "First Sales Call Booked Date" (a DATE), as the reconciler mirrors it. */
  bookedOn?: Record<string, string>;
  /** lead id -> setter inferred from Close activity (setter_touch_name). */
  touchSetters?: Record<string, string>;
  /** lead_submissions columns to report as not existing yet. */
  missingLeadColumns?: string[];
}) {
  const rows = options.rows ?? [];
  const bookedLeadIds = new Set(options.bookedLeadIds ?? []);
  const missingColumns = options.missingColumns ?? [];
  const setters = options.setters ?? {};
  const closeLeads = options.closeLeads ?? {};
  const bookingLeads = options.bookingLeads ?? {};
  const bookedOn = options.bookedOn ?? {};
  const touchSetters = options.touchSetters ?? {};
  const missingLeadColumns = options.missingLeadColumns ?? [];
  const creditIds = [
    ...new Set([
      ...Object.keys(setters),
      ...Object.keys(closeLeads),
      ...Object.keys(touchSetters),
    ]),
  ];

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

  function leadSubmissionsQuery(fields: string) {
    const missing = missingLeadColumns.find((column) =>
      fields.includes(column),
    );
    const result = missing
      ? {
          data: null,
          error: {
            message: `column lead_submissions.${missing} does not exist`,
          },
        }
      : fields.includes("booked_by_setter")
        ? {
            data: creditIds.map((id) => ({
              id,
              booked_by_setter: setters[id] ?? null,
              entry_resource_tag: closeLeads[id]?.resourceTag ?? null,
              close_lead_created_at: closeLeads[id]?.createdAt ?? null,
              ...(fields.includes("setter_touch_name")
                ? { setter_touch_name: touchSetters[id] ?? null }
                : {}),
            })),
            error: null,
          }
        : {
            data: Array.from(bookedLeadIds).map((id) => ({
              id,
              call_booked_at: bookedOn[id] ?? null,
            })),
            error: null,
          };
    const builder = {
      in: () => builder,
      not: () => builder,
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    };
    return builder;
  }

  function calendlyBookingsQuery() {
    return {
      in: (_column: string, uris: string[]) =>
        Promise.resolve({
          data: uris
            .filter((uri) => bookingLeads[uri])
            .map((uri) => ({
              scheduled_event_uri: uri,
              lead_submission_id: bookingLeads[uri],
            })),
          error: null,
        }),
    };
  }

  const client = {
    from(table: string) {
      if (table === "chatbot_conversations") {
        return { select: (fields: string) => conversationsQuery(fields) };
      }
      if (table === "lead_submissions") {
        return { select: (fields: string) => leadSubmissionsQuery(fields) };
      }
      if (table === "calendly_bookings") {
        return { select: () => calendlyBookingsQuery() };
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

  it("splits booked calls by first touch and by who booked them", async () => {
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
        // Gerald Winslow: chatted, did not book, Connor George called and
        // booked him days later. The email match is the only thing that ties
        // the booking back to this conversation.
        id: "gerald",
        created_at: daysAgo(4),
        message_count: 6,
        captured_email: "gw@example.com",
        lead_submission_id: "lead-gw",
        attribution_source: "email_match",
      },
      {
        // Booked via Close reconciliation only, no stamp at all.
        id: "close-only",
        created_at: daysAgo(2),
        message_count: 4,
        captured_email: "p@example.com",
        lead_submission_id: "lead-p",
      },
      {
        id: "no-setter",
        created_at: daysAgo(2),
        message_count: 4,
        captured_email: "u@example.com",
        lead_submission_id: "lead-u",
        attribution_source: "email_match",
      },
      {
        id: "unattributed",
        created_at: daysAgo(1),
        message_count: 1,
      },
    ];

    const analytics = await getChatbotAnalytics({
      client: fakeClient({
        rows,
        bookedLeadIds: ["lead-gw", "lead-p", "lead-u"],
        setters: { "lead-gw": "Connor George", "lead-p": "Pearl Sathekge" },
        closeLeads: {
          // Close created Gerald a day AFTER he chatted: the chat came first.
          "lead-gw": { resourceTag: "chatbot", createdAt: daysAgo(3) },
          // A webinar lead Close had for a month before they ever chatted.
          "lead-p": { resourceTag: "internal-webinar", createdAt: daysAgo(30) },
        },
      }),
      now: () => NOW,
    });

    expect(analytics.attributionSplitTrustworthy).toBe(true);
    const d30 = analytics.funnels.d30;
    expect(d30.booked).toBe(4);
    expect(d30.bookedBy).toEqual({
      inChat: 1,
      setter: 2,
      setterInferred: 0,
      unknown: 1,
      setters: [
        { label: "Connor George", count: 1 },
        { label: "Pearl Sathekge", count: 1 },
      ],
      byFirstTouch: {
        chatbot: { inChat: 0, setter: 1, unknown: 0 },
        // The chat was a middle touch here, not the way in.
        earlier: { inChat: 0, setter: 1, unknown: 0 },
        // Booked from the chat calendar but never captured a lead, so there
        // is nothing to check -- distinct from "not checked yet" below.
        unlinked: { inChat: 1, setter: 0, unknown: 0 },
        // Has a lead, but Close's date is not mirrored onto it yet: reported
        // as such, not as the chatbot.
        unknown: { inChat: 0, setter: 0, unknown: 1 },
      },
      earlierSources: [{ label: "Internal webinar", count: 1 }],
    });
  });

  it("recovers first touch through the Calendly booking when the chat captured no lead", async () => {
    // A visitor who books straight from the in-chat calendar without giving
    // the bot their details leaves lead_submission_id null on the
    // conversation; only the calendly_bookings row carries the lead. Without
    // the recovery this booking reported as "No lead linked" forever, even
    // though Close knew the person came from a webinar first.
    const analytics = await getChatbotAnalytics({
      client: fakeClient({
        rows: [
          {
            id: "booked-no-lead",
            created_at: daysAgo(1),
            message_count: 4,
            call_booked_at: "2026-08-23T00:00:00.000Z",
            booked_event_uri: "https://api.calendly.com/scheduled_events/9",
            attribution_source: "in_chat",
          },
        ],
        bookingLeads: {
          "https://api.calendly.com/scheduled_events/9": "lead-recovered",
        },
        closeLeads: {
          "lead-recovered": {
            resourceTag: "internal-webinar",
            createdAt: daysAgo(30),
          },
        },
      }),
      now: () => NOW,
    });

    const { byFirstTouch } = analytics.funnels.d30.bookedBy;
    expect(byFirstTouch.earlier).toEqual({ inChat: 1, setter: 0, unknown: 0 });
    expect(byFirstTouch.unlinked).toEqual({
      inChat: 0,
      setter: 0,
      unknown: 0,
    });
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
    // in-chat even with no attribution_source column at all. The other has no
    // URI and no setter, so it is unknown -- never the chatbot's booking.
    expect(d30.bookedBy).toMatchObject({ inChat: 1, setter: 0, unknown: 1 });
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
              {
                role: "user",
                content: "How does the program work?",
                ts: daysAgo(4),
              },
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

  it("buckets drop-off by visitor turns and stamps booked calls on the daily trend", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "booked",
            created_at: daysAgo(3),
            message_count: 5,
            messages: [
              ...calendarTranscript("How much does it cost to start?"),
              { role: "user", content: "ok", ts: daysAgo(3) },
              { role: "assistant", content: "Great.", ts: daysAgo(3) },
              { role: "user", content: "booked", ts: daysAgo(3) },
            ],
            captured_email: "booked@example.com",
            call_booked_at: daysAgo(3),
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

    const byLabel = Object.fromEntries(
      analytics.dropOff.map((b) => [b.label, b]),
    );
    expect(byLabel["1 message"]).toMatchObject({ total: 1, leftNoContact: 1 });
    expect(byLabel["3-4"]).toMatchObject({ total: 1, booked: 1 });
    expect(analytics.dropOff).toHaveLength(5);

    const day = analytics.dailyTrend.find(
      (row) => row.date === daysAgo(3).slice(0, 10),
    );
    expect(day).toMatchObject({ count: 1, booked: 1, captured: 1 });
    expect(analytics.dailyTrendPrior).toHaveLength(30);
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

describe("booking credit: who the chat can claim", () => {
  const said = (content: string) => [{ role: "user", content, ts: daysAgo(5) }];

  it("leaves out calls booked before the chat, and support chats, from the funnel", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            // Already on the calendar on Aug 10, chatted on Aug 19 to cancel.
            id: "pre-chat",
            created_at: daysAgo(5),
            message_count: 3,
            captured_email: "pre@example.com",
            lead_submission_id: "lead-pre",
            messages: said("hi, I need to cancel my call"),
          },
          {
            // Booked the same day as the chat: order unknown, so it keeps
            // its credit rather than lose a real one.
            id: "same-day",
            created_at: daysAgo(5),
            message_count: 6,
            captured_email: "same@example.com",
            lead_submission_id: "lead-same",
            messages: said("how does the program work"),
          },
          {
            id: "after",
            created_at: daysAgo(5),
            message_count: 6,
            captured_email: "after@example.com",
            lead_submission_id: "lead-after",
            messages: said("do I need experience"),
          },
          {
            id: "support",
            created_at: daysAgo(5),
            message_count: 4,
            captured_email: "member@example.com",
            messages: said("I'm an existing member and can't log in"),
          },
          {
            id: "browsing",
            created_at: daysAgo(5),
            message_count: 1,
            messages: said("what is vending"),
          },
        ],
        bookedLeadIds: ["lead-pre", "lead-same", "lead-after"],
        bookedOn: {
          "lead-pre": "2026-08-10",
          "lead-same": "2026-08-19",
          "lead-after": "2026-08-21",
        },
      }),
    });

    const d30 = analytics.funnels.d30;
    expect(d30.conversations).toBe(3);
    expect(d30.booked).toBe(2);
    expect(d30.excluded).toEqual({ support: 1, bookedBeforeChat: 1 });
    expect(analytics.callsBooked30d.value).toBe(2);
    expect(analytics.conversations30d.value).toBe(3);
    expect(analytics.outcomes.d30.total).toBe(3);
  });

  it("credits a setter inferred from Close activity as a setter, marked inferred", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "stated",
            created_at: daysAgo(4),
            message_count: 6,
            captured_email: "a@example.com",
            lead_submission_id: "lead-a",
          },
          {
            id: "inferred",
            created_at: daysAgo(4),
            message_count: 6,
            captured_email: "b@example.com",
            lead_submission_id: "lead-b",
          },
          {
            id: "nobody",
            created_at: daysAgo(4),
            message_count: 6,
            captured_email: "c@example.com",
            lead_submission_id: "lead-c",
          },
        ],
        bookedLeadIds: ["lead-a", "lead-b", "lead-c"],
        setters: { "lead-a": "Connor George" },
        touchSetters: { "lead-b": "Pearl Sathekge" },
      }),
    });

    const bookedBy = analytics.funnels.d30.bookedBy;
    expect(bookedBy.setter).toBe(2);
    expect(bookedBy.setterInferred).toBe(1);
    expect(bookedBy.unknown).toBe(1);
  });

  it("keeps stated setter credit when the inferred-setter column is not there yet", async () => {
    const analytics = await getChatbotAnalytics({
      now: () => NOW,
      client: fakeClient({
        rows: [
          {
            id: "stated",
            created_at: daysAgo(4),
            message_count: 6,
            captured_email: "a@example.com",
            lead_submission_id: "lead-a",
          },
        ],
        bookedLeadIds: ["lead-a"],
        setters: { "lead-a": "Connor George" },
        missingLeadColumns: ["setter_touch_name"],
      }),
    });

    expect(analytics.funnels.d30.bookedBy.setter).toBe(1);
  });
});
