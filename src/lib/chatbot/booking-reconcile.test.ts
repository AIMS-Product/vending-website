import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileChatbotBookings } from "./booking-reconcile";

// The Close note reaches OUT to the CRM, so the dry-run guard on it cannot be
// proven by counting Supabase writes the way the other dry-run assertions are.
const stampCloseNote = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/chatbot/close-booking-note", () => ({
  stampChatbotBookingOnCloseLead: stampCloseNote,
}));

beforeEach(() => {
  stampCloseNote.mockClear();
});

const ORG_URI = "https://api.calendly.com/organizations/org-1";
const EVENT_URI = "https://api.calendly.com/scheduled_events/e1";
const CONVERSATION_ID = "11111111-1111-1111-1111-111111111111";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildCalendlyFetch(invitees: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/users/me")) {
      return jsonResponse({ resource: { current_organization: ORG_URI } });
    }
    if (url.startsWith("https://api.calendly.com/scheduled_events?")) {
      return jsonResponse({
        collection: [
          {
            uri: EVENT_URI,
            name: "Discovery Call",
            start_time: "2026-08-01T15:00:00Z",
            end_time: "2026-08-01T15:30:00Z",
            status: "active",
          },
        ],
        pagination: { next_page: null },
      });
    }
    if (url.startsWith(`${EVENT_URI}/invitees`)) {
      return jsonResponse({
        collection: invitees,
        pagination: { next_page: null },
      });
    }
    throw new Error(`Unexpected URL in test: ${url}`);
  }) as unknown as typeof fetch;
}

/**
 * A fake Supabase client that supports exactly the call chains
 * recordCalendlyBooking and applyChatbotBookingAttribution make, so the real
 * functions run unmodified against it -- same approach as
 * calendly-bookings.test.ts, extended to cover the attribution table too.
 */
function buildFakeSupabase({
  existingBookingUris = new Set<string>(),
  matchingLeadId = null as string | null,
  upsertShouldFailForUri = null as string | null,
  emailMatchRows = [] as Array<{ id: string; created_at: string }>,
}) {
  const calls = {
    upserts: [] as unknown[],
    updates: [] as unknown[],
    rpcs: [] as unknown[],
  };

  const from = vi.fn((table: string) => {
    if (table === "calendly_bookings") {
      return {
        select: () => ({
          eq: (_col: string, uri: string) => ({
            maybeSingle: async () => ({
              data: existingBookingUris.has(uri) ? { invitee_uri: uri } : null,
              error: null,
            }),
          }),
        }),
        upsert: async (row: { invitee_uri: string }) => {
          calls.upserts.push(row);
          if (
            upsertShouldFailForUri &&
            row.invitee_uri === upsertShouldFailForUri
          ) {
            return { error: { message: "boom" } };
          }
          return { error: null };
        },
      };
    }

    if (table === "lead_submissions") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: matchingLeadId ? { id: matchingLeadId } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "chatbot_conversations") {
      return {
        select: (columns: string) => {
          if (columns.includes("created_at")) {
            return {
              // booking-attribution now bounds the email-match window in SQL,
              // so the chain has to accept gte/lte as well.
              ilike: () => {
                const chain: Record<string, unknown> = {
                  order: () => ({
                    limit: async () => ({ data: emailMatchRows, error: null }),
                  }),
                };
                chain.gte = () => chain;
                chain.lte = () => chain;
                return chain;
              },
            };
          }
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: CONVERSATION_ID,
                  messages: [],
                  call_booked_at: null,
                  booked_event_uri: null,
                  attribution_source: null,
                },
                error: null,
              }),
            }),
          };
        },
        update: (payload: unknown) => {
          calls.updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const rpc = vi.fn(async (name: string, args: unknown) => {
    calls.rpcs.push({ name, args });
    return { error: null };
  });

  return { client: { from, rpc } as never, calls };
}

describe("reconcileChatbotBookings", () => {
  it("reports not configured when no token is available", async () => {
    const result = await reconcileChatbotBookings(
      {},
      { token: undefined, fetchImpl: vi.fn() as unknown as typeof fetch },
    );

    expect(result).toMatchObject({ configured: false, eventsScanned: 0 });
  });

  it("attributes an in_chat match, skips a no-utm invitee, records an error, and keeps going", async () => {
    const inChatInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/1",
      email: "jane@example.com",
      name: "Jane",
      status: "active",
      created_at: "2026-08-01T14:00:00Z",
      tracking: {
        utm_source: "chatbot",
        utm_content: CONVERSATION_ID,
      },
    };
    const noUtmInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/2",
      email: "no-match@example.com",
      name: "No Match",
      status: "active",
      created_at: "2026-08-01T14:05:00Z",
      tracking: null,
    };
    const failingInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/3",
      email: "fails@example.com",
      name: "Fails",
      status: "active",
      created_at: "2026-08-01T14:10:00Z",
      tracking: null,
    };
    const trailingInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/4",
      email: "trailing@example.com",
      name: "Trailing",
      status: "active",
      created_at: "2026-08-01T14:15:00Z",
      tracking: null,
    };

    const fetchImpl = buildCalendlyFetch([
      inChatInvitee,
      noUtmInvitee,
      failingInvitee,
      trailingInvitee,
    ]);
    const { client, calls } = buildFakeSupabase({
      upsertShouldFailForUri: failingInvitee.uri,
    });

    const result = await reconcileChatbotBookings(
      {},
      { token: "tok", fetchImpl, supabaseClient: client },
    );

    expect(result.configured).toBe(true);
    expect(result.eventsScanned).toBe(1);
    expect(result.inviteesSeen).toBe(4);
    expect(result.bookingsRecorded).toBe(3); // in-chat, no-utm, trailing -- failing one errors before counting
    expect(result.attributed).toEqual({ inChat: 1, emailMatch: 0 });
    expect(result.skipped).toBe(2); // no-utm + trailing, both unmatched
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].inviteeUri).toBe(failingInvitee.uri);
    expect(calls.upserts).toHaveLength(4);
    // The matched booking gets the same "came via chatbot" note in Close that
    // the live webhook writes, so a backfilled call is as visible to a rep.
    expect(stampCloseNote).toHaveBeenCalledTimes(1);
    expect(stampCloseNote).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        attributionSource: "in_chat",
      }),
    );
  });

  it("performs zero writes in dry run while still predicting the outcome", async () => {
    const inChatInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/1",
      email: "jane@example.com",
      name: "Jane",
      status: "active",
      created_at: "2026-08-01T14:00:00Z",
      tracking: {
        utm_source: "chatbot",
        utm_content: CONVERSATION_ID,
      },
    };

    const fetchImpl = buildCalendlyFetch([inChatInvitee]);
    const { client, calls } = buildFakeSupabase({});

    const result = await reconcileChatbotBookings(
      { dryRun: true },
      { token: "tok", fetchImpl, supabaseClient: client },
    );

    expect(result.dryRun).toBe(true);
    expect(result.bookingsRecorded).toBe(1);
    expect(result.attributed).toEqual({ inChat: 1, emailMatch: 0 });
    expect(calls.upserts).toHaveLength(0);
    expect(calls.updates).toHaveLength(0);
    expect(calls.rpcs).toHaveLength(0);
    // A rehearsal must not write a real CRM note. createDryRunClient only
    // intercepts Supabase calls, so this is the one dry-run leak it cannot
    // catch on its own.
    expect(stampCloseNote).not.toHaveBeenCalled();
  });

  it("honours an explicit window and stores the webhook payload shape", async () => {
    const calendlyFetch = buildCalendlyFetch([
      {
        uri: "https://api.calendly.com/scheduled_events/e1/invitees/i1",
        email: "june@example.com",
        name: "June Lead",
        status: "active",
        created_at: "2026-06-20T10:00:00Z",
        scheduled_by: "https://api.calendly.com/users/rep-1",
        tracking: null,
      },
    ]);
    const { client, calls } = buildFakeSupabase({});
    await reconcileChatbotBookings(
      { from: "2026-06-01", to: "2026-07-01" },
      { fetchImpl: calendlyFetch, supabaseClient: client, token: "tok" },
    );
    const listUrl = (
      calendlyFetch as unknown as { mock: { calls: Array<[string]> } }
    ).mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes("/scheduled_events?"))!;
    expect(listUrl).toContain("min_start_time=2026-06-01T00%3A00%3A00.000Z");
    expect(listUrl).toContain("max_start_time=2026-07-01T00%3A00%3A00.000Z");
    const booking = calls.upserts.find((row) =>
      (row as { invitee_uri?: string }).invitee_uri?.endsWith("/i1"),
    ) as { raw_payload: { event: string; payload: Record<string, unknown> } };
    expect(booking.raw_payload.event).toBe("invitee.created");
    expect(booking.raw_payload.payload.invitee_scheduled_by).toBe(
      "https://api.calendly.com/users/rep-1",
    );
    expect(booking.raw_payload.payload.created_at).toBe("2026-06-20T10:00:00Z");
    expect(
      (booking.raw_payload.payload.scheduled_event as { uri: string }).uri,
    ).toBe(EVENT_URI);
  });

  it("skips a canceled invitee without recording it as booked", async () => {
    const canceledInvitee = {
      uri: "https://api.calendly.com/scheduled_events/e1/invitees/1",
      email: "canceled@example.com",
      name: "Canceled",
      status: "canceled",
      created_at: "2026-08-01T14:00:00Z",
      tracking: null,
    };

    const fetchImpl = buildCalendlyFetch([canceledInvitee]);
    const { client, calls } = buildFakeSupabase({});

    const result = await reconcileChatbotBookings(
      {},
      { token: "tok", fetchImpl, supabaseClient: client },
    );

    expect(result.inviteesSeen).toBe(1);
    expect(result.bookingsRecorded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(calls.upserts).toHaveLength(0);
  });
});
