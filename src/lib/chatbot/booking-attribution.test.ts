import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyChatbotBookingAttribution } from "./booking-attribution";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { Database, Json } from "@/types/database";

type AttributionClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";
const NEWEST_EMAIL_MATCH_ID = "22222222-3333-4444-8555-666666666666";
const OLDER_EMAIL_MATCH_ID = "33333333-4444-4555-8666-777777777777";

/**
 * Records the column update and any RPC-appended message, and serves one
 * conversation row plus a canned email-match candidate list. `found: false`
 * simulates a utm_content that looks like a conversation id but is not one.
 * `attributionSourceMissing: true` simulates the attribution_source column
 * not existing yet, independent of the rest of the v2 columns.
 */
function fakeClient(
  options: {
    messages?: Json;
    found?: boolean;
    callBookedAt?: string | null;
    bookedEventUri?: string | null;
    attributionSource?: string | null;
    attributionSourceMissing?: boolean;
    emailMatches?: Array<{ id: string; created_at: string }>;
  } = {},
) {
  const updates: Array<Record<string, unknown>> = [];
  const appended: Array<Record<string, unknown>> = [];
  const ilikeCalls: Array<{ column: string; pattern: string }> = [];
  const emailMatches = options.emailMatches ?? [];

  const missingColumnError = {
    message: "column chatbot_conversations.attribution_source does not exist",
  };

  const client = {
    from(table: string) {
      if (table !== "chatbot_conversations") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select(columns: string) {
          const includesSource = columns.includes("attribution_source");
          return {
            eq() {
              return {
                maybeSingle: () => {
                  if (includesSource && options.attributionSourceMissing) {
                    return Promise.resolve({
                      data: null,
                      error: missingColumnError,
                    });
                  }
                  if (options.found === false) {
                    return Promise.resolve({ data: null, error: null });
                  }
                  return Promise.resolve({
                    data: {
                      id: CONVERSATION_ID,
                      messages: options.messages ?? [],
                      call_booked_at: options.callBookedAt ?? null,
                      booked_event_uri: options.bookedEventUri ?? null,
                      ...(includesSource
                        ? {
                            attribution_source:
                              options.attributionSource ?? null,
                          }
                        : {}),
                    },
                    error: null,
                  });
                },
              };
            },
            ilike(column: string, pattern: string) {
              ilikeCalls.push({ column, pattern });
              return {
                order() {
                  return {
                    limit: () =>
                      Promise.resolve({ data: emailMatches, error: null }),
                  };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          if (
            options.attributionSourceMissing &&
            "attribution_source" in patch
          ) {
            return { eq: () => Promise.resolve({ error: missingColumnError }) };
          }
          updates.push(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name !== "chatbot_append_message") {
        throw new Error(`unexpected rpc ${name}`);
      }
      appended.push(args);
      return Promise.resolve({ error: null });
    },
  } as unknown as AttributionClient;
  return { updates, appended, ilikeCalls, client };
}

function makeEvent(
  overrides: Partial<CalendlyWebhookEvent> = {},
): CalendlyWebhookEvent {
  return {
    eventKind: "invitee.created",
    inviteeUri: "https://api.calendly.com/scheduled_events/x/invitees/y",
    inviteeName: "Dana",
    inviteeEmail: "dana@example.com",
    cancelReason: null,
    utmSource: "chatbot",
    utmMedium: "site_chat",
    utmCampaign: null,
    utmTerm: null,
    utmContent: CONVERSATION_ID,
    scheduledEventUri: "https://api.calendly.com/scheduled_events/x",
    scheduledEventName: "Quick discovery",
    eventStartAt: "2026-09-01T15:00:00.000Z",
    eventEndAt: "2026-09-01T15:15:00.000Z",
    rawPayload: {},
    ...overrides,
  };
}

/** A booking/cancel event with no utm tag at all, forcing the email-match fallback path. */
function makeEmailOnlyEvent(
  overrides: Partial<CalendlyWebhookEvent> = {},
): CalendlyWebhookEvent {
  return makeEvent({
    utmSource: null,
    utmContent: null,
    ...overrides,
  });
}

describe("applyChatbotBookingAttribution", () => {
  it("stamps the conversation and appends a confirmation card", async () => {
    const { updates, appended, client } = fakeClient();

    const result = await applyChatbotBookingAttribution(client, makeEvent());

    expect(result).toMatchObject({
      matched: true,
      action: "booked",
      attributionSource: "in_chat",
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].call_booked_at).toEqual(expect.any(String));
    expect(updates[0].booked_event_uri).toBe(
      "https://api.calendly.com/scheduled_events/x",
    );
    expect(updates[0].attribution_source).toBe("in_chat");
    // Appended through SQL, never as a read-modify-write of `messages` — a
    // whole-array write here would delete any chat turn that landed since the
    // select above.
    expect(updates[0].messages).toBeUndefined();
    expect(appended).toHaveLength(1);
    expect((appended[0].p_message as Record<string, unknown>).kind).toBe(
      "booking_confirmed",
    );
  });

  it("ignores bookings that did not come from the chat", async () => {
    const { updates, client } = fakeClient();

    const fromAds = await applyChatbotBookingAttribution(
      client,
      makeEvent({ utmSource: "google_ads" }),
    );
    const noTag = await applyChatbotBookingAttribution(
      client,
      makeEmailOnlyEvent({ inviteeEmail: null }),
    );

    expect(fromAds).toEqual({ matched: false });
    expect(noTag).toEqual({ matched: false });
    expect(updates).toHaveLength(0);
  });

  it("ignores a utm_content that is not a conversation id", async () => {
    const { updates, client } = fakeClient();

    const result = await applyChatbotBookingAttribution(
      client,
      makeEvent({ utmContent: "spring-promo" }),
    );

    expect(result).toEqual({ matched: false });
    expect(updates).toHaveLength(0);
  });

  it("does not duplicate the card when Calendly redelivers the webhook", async () => {
    const { updates, appended, client } = fakeClient({
      messages: [
        {
          role: "assistant",
          content: "Booked.",
          ts: "2026-09-01T00:00:00.000Z",
          kind: "booking_confirmed",
          data: {
            event_uri: "https://api.calendly.com/scheduled_events/x",
            starts_at: "2026-09-01T15:00:00.000Z",
          },
        },
      ] as unknown as Json,
    });

    await applyChatbotBookingAttribution(client, makeEvent());

    expect(updates).toHaveLength(1);
    expect(updates[0].call_booked_at).toEqual(expect.any(String));
    expect(appended).toHaveLength(0);
  });

  it("clears the booking timestamp on a cancellation", async () => {
    const { updates, client } = fakeClient();

    const result = await applyChatbotBookingAttribution(
      client,
      makeEvent({ eventKind: "invitee.canceled" }),
    );

    expect(result).toMatchObject({ matched: true, action: "canceled" });
    expect(updates[0]).toEqual({ call_booked_at: null });
  });

  it("does not resurrect a cancelled call when Calendly retries the create", async () => {
    // Calendly does not guarantee ordering: a create whose delivery failed can
    // be retried after its own cancellation landed. Re-stamping would count a
    // cancelled call in callsBooked30d forever.
    const { updates, client } = fakeClient({
      callBookedAt: null,
      bookedEventUri: "https://api.calendly.com/scheduled_events/x",
    });

    const result = await applyChatbotBookingAttribution(client, makeEvent());

    expect(result).toEqual({ matched: false });
    expect(updates).toHaveLength(0);
  });

  it("ignores a stale cancel for an event that is no longer the booked one", async () => {
    const { updates, client } = fakeClient({
      callBookedAt: "2026-09-02T00:00:00.000Z",
      bookedEventUri: "https://api.calendly.com/scheduled_events/rebooked",
    });

    const result = await applyChatbotBookingAttribution(
      client,
      makeEvent({ eventKind: "invitee.canceled" }),
    );

    expect(result).toEqual({ matched: false });
    expect(updates).toHaveLength(0);
  });

  it("does nothing when the conversation no longer exists", async () => {
    const { updates, client } = fakeClient({ found: false });

    const result = await applyChatbotBookingAttribution(client, makeEvent());

    expect(result).toEqual({ matched: false });
    expect(updates).toHaveLength(0);
  });

  describe("email-match fallback", () => {
    it("books the most recent in-window conversation", async () => {
      const { updates, client } = fakeClient({
        emailMatches: [
          // Pre-sorted created_at desc, as the real query would return.
          { id: NEWEST_EMAIL_MATCH_ID, created_at: "2026-08-28T00:00:00.000Z" },
          { id: OLDER_EMAIL_MATCH_ID, created_at: "2026-08-25T00:00:00.000Z" },
        ],
      });

      const result = await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent(),
      );

      expect(result).toMatchObject({
        matched: true,
        action: "booked",
        conversationId: NEWEST_EMAIL_MATCH_ID,
        attributionSource: "email_match",
      });
      expect(updates).toHaveLength(1);
      expect(updates[0].attribution_source).toBe("email_match");
      expect(updates[0].call_booked_at).toEqual(expect.any(String));
    });

    it("does not match a conversation created outside the window", async () => {
      // eventStartAt anchors the booking time at 2026-09-01T15:00:00Z; this
      // conversation is well over 30 days before that.
      const { updates, client } = fakeClient({
        emailMatches: [
          { id: OLDER_EMAIL_MATCH_ID, created_at: "2026-07-01T00:00:00.000Z" },
        ],
      });

      const result = await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent(),
      );

      expect(result).toEqual({ matched: false });
      expect(updates).toHaveLength(0);
    });

    it("never overwrites an existing in_chat attribution", async () => {
      const { updates, client } = fakeClient({
        callBookedAt: "2026-08-20T00:00:00.000Z",
        bookedEventUri: "https://api.calendly.com/scheduled_events/original",
        attributionSource: "in_chat",
        emailMatches: [
          { id: CONVERSATION_ID, created_at: "2026-08-28T00:00:00.000Z" },
        ],
      });

      const result = await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent(),
      );

      expect(result).toEqual({ matched: false });
      expect(updates).toHaveLength(0);
    });

    it("ignores an email-matched cancel for a different event uri", async () => {
      const { updates, client } = fakeClient({
        callBookedAt: "2026-08-20T00:00:00.000Z",
        bookedEventUri: "https://api.calendly.com/scheduled_events/other",
        attributionSource: "email_match",
        emailMatches: [
          { id: CONVERSATION_ID, created_at: "2026-08-28T00:00:00.000Z" },
        ],
      });

      const result = await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent({ eventKind: "invitee.canceled" }),
      );

      expect(result).toEqual({ matched: false });
      expect(updates).toHaveLength(0);
    });

    it("still writes call_booked_at when attribution_source does not exist in the schema", async () => {
      const { updates, client } = fakeClient({
        attributionSourceMissing: true,
        emailMatches: [
          { id: CONVERSATION_ID, created_at: "2026-08-28T00:00:00.000Z" },
        ],
      });

      const result = await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent(),
      );

      expect(result).toMatchObject({ matched: true, action: "booked" });
      expect(updates).toHaveLength(1);
      expect(updates[0].call_booked_at).toEqual(expect.any(String));
      expect(updates[0]).not.toHaveProperty("attribution_source");
    });

    it("escapes % and _ in the invitee email instead of treating them as wildcards", async () => {
      const { ilikeCalls, client } = fakeClient({ emailMatches: [] });

      await applyChatbotBookingAttribution(
        client,
        makeEmailOnlyEvent({ inviteeEmail: "50%off_deal@example.com" }),
      );

      expect(ilikeCalls).toHaveLength(1);
      expect(ilikeCalls[0].column).toBe("captured_email");
      expect(ilikeCalls[0].pattern).toBe("50\\%off\\_deal@example.com");
    });
  });
});
