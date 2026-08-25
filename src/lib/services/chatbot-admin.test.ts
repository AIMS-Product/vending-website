import { describe, expect, it } from "vitest";
import { adminListConversations } from "@/lib/services/chatbot-admin";

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
}) {
  const bookedLeadIds = new Set(options.bookedLeadIds ?? []);

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
