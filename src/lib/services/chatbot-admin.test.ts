import { describe, expect, it } from "vitest";
import {
  adminListConversations,
  hostNameFromPayload,
} from "@/lib/services/chatbot-admin";

const NOW = new Date();
const STALE = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();

const calendarTranscript = [
  { role: "user", content: "How much does it cost to start?", ts: STALE },
  {
    role: "assistant",
    content: "Opened the booking calendar in the chat.",
    ts: STALE,
    kind: "calendar",
  },
];

type FakeRow = Record<string, unknown>;

/**
 * Fakes the three chains adminListConversations uses: the conversation list
 * (select/order/limit), the flag lookup (select/in) and the booked-lead lookup
 * (select/in/not). `missingBookingColumn` makes the first select fail the way
 * Postgres does before the v2 migration, so the pre-migration fallback is
 * exercised for real.
 */
function fakeClient(options: {
  rows: FakeRow[];
  bookedLeadIds?: string[];
  missingBookingColumn?: boolean;
  bookingLookupFails?: boolean;
  /** conversation id -> attribution_source, for the booked-chat stamp lookup. */
  stamps?: Record<string, string>;
  /** lead id -> the credit columns the booking reconciler mirrors from Close. */
  leadCredit?: Record<
    string,
    {
      booked_by_setter?: string | null;
      entry_resource_tag?: string | null;
      close_lead_created_at?: string | null;
    }
  >;
  /** conversation id -> the Calendly event its booking stamp points at. */
  eventUris?: Record<string, string>;
  /** Calendly event uri -> the lead that booking is linked to. */
  bookingLeads?: Record<string, string>;
}) {
  const bookedLeadIds = new Set(options.bookedLeadIds ?? []);
  const leadCredit = options.leadCredit ?? {};

  return {
    from(table: string) {
      if (table === "chatbot_conversations") {
        return {
          select: (fields: string) => {
            const failing =
              options.missingBookingColumn && fields.includes("call_booked_at");
            const result = failing
              ? {
                  data: null,
                  error: {
                    message:
                      "column chatbot_conversations.call_booked_at does not exist",
                  },
                }
              : {
                  data: options.rows.map((row) =>
                    failing === false && options.missingBookingColumn
                      ? { ...row, call_booked_at: undefined }
                      : row,
                  ),
                  error: null,
                };
            const builder = {
              order: () => builder,
              limit: () => builder,
              // The booked-chat attribution stamp lookup (select/in).
              in: (_column: string, ids: string[]) =>
                Promise.resolve({
                  data: ids.map((id) => ({
                    id,
                    attribution_source: options.stamps?.[id] ?? null,
                    booked_event_uri: options.eventUris?.[id] ?? null,
                  })),
                  error: null,
                }),
              then: (resolve: (value: typeof result) => unknown) =>
                resolve(result),
            };
            return builder;
          },
        };
      }

      if (table === "chatbot_conversation_flags") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }

      if (table === "lead_submissions") {
        return {
          select: () => ({
            in: (_column: string, ids: string[]) => ({
              // Awaited directly by the lead credit lookup (select/in).
              then: (resolve: (value: unknown) => unknown) =>
                resolve({
                  data: ids
                    .filter((id) => id in leadCredit)
                    .map((id) => ({
                      id,
                      booked_by_setter: null,
                      entry_resource_tag: null,
                      close_lead_created_at: null,
                      ...leadCredit[id],
                    })),
                  error: null,
                }),
              not: () =>
                Promise.resolve(
                  options.bookingLookupFails
                    ? { data: null, error: { message: "request too long" } }
                    : {
                        data: ids
                          .filter((id) => bookedLeadIds.has(id))
                          .map((id) => ({ id })),
                        error: null,
                      },
                ),
            }),
          }),
        };
      }

      if (table === "calendly_bookings") {
        return {
          select: () => {
            let uris: string[] = [];
            const builder = {
              in: (_column: string, values: string[]) => {
                uris = values;
                return builder;
              },
              not: () =>
                Promise.resolve({
                  data: uris
                    .filter((uri) => options.bookingLeads?.[uri])
                    .map((uri) => ({
                      scheduled_event_uri: uri,
                      lead_submission_id: options.bookingLeads?.[uri],
                    })),
                  error: null,
                }),
            };
            return builder;
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

const baseRow = {
  id: "c1",
  session_id: "s1",
  status: "active",
  captured_name: null,
  captured_email: null,
  captured_phone: null,
  messages: calendarTranscript,
  message_count: 3,
  last_message_at: STALE,
  created_at: STALE,
  call_booked_at: null,
  lead_submission_id: null,
};

describe("adminListConversations first and last touch", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) =>
    new Date(NOW.getTime() - days * DAY).toISOString();
  const CHAT_AT = daysAgo(4);
  const rows = [
    // Gerald: chatted first, Connor George called and booked him.
    {
      ...baseRow,
      id: "gerald",
      created_at: CHAT_AT,
      lead_submission_id: "lead-gw",
    },
    // A webinar lead Close had for a month before they ever chatted.
    {
      ...baseRow,
      id: "webinar",
      created_at: CHAT_AT,
      lead_submission_id: "lead-wb",
    },
    // Chatted first and booked from the chat calendar itself.
    {
      ...baseRow,
      id: "in-chat",
      created_at: CHAT_AT,
      lead_submission_id: "lead-ic",
    },
  ];
  const client = () =>
    fakeClient({
      rows,
      bookedLeadIds: ["lead-gw", "lead-wb", "lead-ic"],
      stamps: { gerald: "email_match", "in-chat": "in_chat" },
      leadCredit: {
        "lead-gw": {
          booked_by_setter: "Connor George",
          entry_resource_tag: "chatbot",
          close_lead_created_at: daysAgo(3),
        },
        "lead-wb": {
          entry_resource_tag: "internal-webinar",
          close_lead_created_at: daysAgo(30),
        },
        "lead-ic": {
          entry_resource_tag: "chatbot",
          close_lead_created_at: daysAgo(3.9),
        },
      },
    }) as never;

  it("puts every booked chat in exactly one first touch x last touch bucket", async () => {
    const result = await adminListConversations({}, { client: client() });
    const byId = Object.fromEntries(
      result.items.map((item) => [item.id, item.touch]),
    );

    expect(byId.gerald).toMatchObject({
      bucket: "chatbot_setter",
      last: { label: "Set by Connor George" },
    });
    expect(byId.webinar).toMatchObject({
      bucket: "earlier",
      first: { label: "Internal webinar" },
    });
    expect(byId["in-chat"]).toMatchObject({
      bucket: "end_to_end",
      last: { kind: "in_chat" },
    });
    expect(result.touchCounts).toEqual({
      end_to_end: 1,
      chatbot_setter: 1,
      chatbot_elsewhere: 0,
      earlier: 1,
      no_lead: 0,
      unchecked: 0,
    });
  });

  it("separates a chat with no lead from one recovered through its booking", async () => {
    // Both chats booked from the in-chat calendar without ever capturing a
    // lead. One's Calendly booking is linked to a lead (recoverable, and Close
    // says a webinar brought them in first); the other's is not (nothing to
    // recover, so say so rather than promising a pending check).
    const result = await adminListConversations(
      {},
      {
        client: fakeClient({
          rows: [
            // Booked on the conversation itself, which is exactly how these
            // rows look: a booking stamp and no lead of their own.
            {
              ...baseRow,
              id: "recovered",
              created_at: CHAT_AT,
              call_booked_at: daysAgo(1),
            },
            {
              ...baseRow,
              id: "orphan",
              created_at: CHAT_AT,
              call_booked_at: daysAgo(1),
            },
          ],
          bookedLeadIds: ["lead-rec"],
          stamps: { recovered: "in_chat", orphan: "in_chat" },
          eventUris: {
            recovered: "https://api.calendly.com/scheduled_events/7",
            orphan: "https://api.calendly.com/scheduled_events/8",
          },
          bookingLeads: {
            "https://api.calendly.com/scheduled_events/7": "lead-rec",
          },
          leadCredit: {
            "lead-rec": {
              entry_resource_tag: "internal-webinar",
              close_lead_created_at: daysAgo(30),
            },
          },
        }) as never,
      },
    );

    const byId = Object.fromEntries(
      result.items.map((item) => [item.id, item.touch]),
    );
    expect(byId.recovered).toMatchObject({
      bucket: "earlier",
      first: { label: "Internal webinar" },
    });
    expect(byId.orphan).toMatchObject({
      bucket: "no_lead",
      first: { kind: "unlinked", label: "No lead linked" },
    });
    expect(result.touchCounts.no_lead).toBe(1);
    expect(result.touchCounts.unchecked).toBe(0);
  });

  it("filters the booked view by bucket, and ignores the filter anywhere else", async () => {
    const earlier = await adminListConversations(
      { outcome: "booked", touch: "earlier" },
      { client: client() },
    );
    expect(earlier.items.map((item) => item.id)).toEqual(["webinar"]);

    const everyOutcome = await adminListConversations(
      { touch: "earlier" },
      { client: client() },
    );
    expect(everyOutcome.items).toHaveLength(3);
  });
});

describe("adminListConversations outcomes", () => {
  it("counts a call reconciled onto the lead as booked, not abandoned", async () => {
    const result = await adminListConversations(
      {},
      {
        client: fakeClient({
          rows: [{ ...baseRow, lead_submission_id: "lead-1" }],
          bookedLeadIds: ["lead-1"],
        }) as never,
      },
    );

    expect(result.items[0]?.outcome).toBe("booked");
    expect(result.items[0]?.callBookedAt).toBe(STALE);
    expect(result.outcomeCounts.booked).toBe(1);
    expect(result.outcomeCounts.calendar_abandoned).toBe(0);
    expect(result.outcomesTrustworthy).toBe(true);
  });

  it("flags a shown-then-abandoned calendar and the cost question behind it", async () => {
    const result = await adminListConversations(
      {},
      { client: fakeClient({ rows: [baseRow] }) as never },
    );

    expect(result.outcomeCounts.calendar_abandoned).toBe(1);
    expect(result.costQuestionCount).toBe(1);
    expect(result.items[0]?.askedAboutCost).toBe(true);
  });

  it("filters to one outcome", async () => {
    const client = fakeClient({
      rows: [baseRow, { ...baseRow, id: "c2", captured_email: "a@b.com" }],
    }) as never;

    const abandoned = await adminListConversations(
      { outcome: "calendar_abandoned" },
      { client },
    );
    expect(abandoned.items.map((item) => item.id)).toEqual(["c1"]);

    const reachable = await adminListConversations(
      { outcome: "captured_no_booking" },
      { client },
    );
    expect(reachable.items.map((item) => item.id)).toEqual(["c2"]);
  });

  it("declines to report outcomes when the booking column cannot be read", async () => {
    const result = await adminListConversations(
      {},
      {
        client: fakeClient({
          rows: [baseRow],
          missingBookingColumn: true,
        }) as never,
      },
    );

    // The list still renders; only the outcome split is withheld.
    expect(result.items).toHaveLength(1);
    expect(result.outcomesTrustworthy).toBe(false);
  });

  it("withholds outcomes when the booking lookup fails part way", async () => {
    const result = await adminListConversations(
      {},
      {
        client: fakeClient({
          rows: [{ ...baseRow, lead_submission_id: "lead-1" }],
          bookedLeadIds: ["lead-1"],
          bookingLookupFails: true,
        }) as never,
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.outcomesTrustworthy).toBe(false);
  });

  it("ignores an outcome filter while outcomes are not reportable", async () => {
    const result = await adminListConversations(
      { outcome: "calendar_abandoned" },
      {
        client: fakeClient({
          rows: [baseRow],
          missingBookingColumn: true,
        }) as never,
      },
    );

    // The chips are hidden in this state, so a filter left in the URL must not
    // silently shrink the list.
    expect(result.items).toHaveLength(1);
  });
});

describe("hostNameFromPayload", () => {
  it("reads the consultant from a webhook payload and from the embed route's shape", () => {
    expect(
      hostNameFromPayload({
        scheduled_event: {
          event_memberships: [{ user_name: "Kody Lee", user_email: "k@x.com" }],
        },
      }),
    ).toBe("Kody Lee");
    expect(
      hostNameFromPayload({
        payload: {
          scheduled_event: {
            event_memberships: [{ user_name: "A" }, { user_name: "B" }],
          },
        },
      }),
    ).toBe("A, B");
  });

  it("returns null instead of guessing", () => {
    expect(hostNameFromPayload(null)).toBeNull();
    expect(hostNameFromPayload({ source: "embed_postmessage" })).toBeNull();
    expect(
      hostNameFromPayload({ scheduled_event: { event_memberships: [{}] } }),
    ).toBeNull();
  });
});
