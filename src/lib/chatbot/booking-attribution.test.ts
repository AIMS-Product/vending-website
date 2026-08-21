import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyChatbotBookingAttribution } from "./booking-attribution";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { Database, Json } from "@/types/database";

type AttributionClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

const CONVERSATION_ID = "11111111-2222-4333-8444-555555555555";

/**
 * Records the column update and any RPC-appended message, and serves one
 * conversation row. `found: false` simulates a utm_content that looks like a
 * conversation id but is not one.
 */
function fakeClient(
  options: {
    messages?: Json;
    found?: boolean;
    callBookedAt?: string | null;
    bookedEventUri?: string | null;
  } = {},
) {
  const updates: Array<Record<string, unknown>> = [];
  const appended: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table !== "chatbot_conversations") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data:
                      options.found === false
                        ? null
                        : {
                            id: CONVERSATION_ID,
                            messages: options.messages ?? [],
                            call_booked_at: options.callBookedAt ?? null,
                            booked_event_uri: options.bookedEventUri ?? null,
                          },
                    error: null,
                  }),
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
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
  return { updates, appended, client };
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

describe("applyChatbotBookingAttribution", () => {
  it("stamps the conversation and appends a confirmation card", async () => {
    const { updates, appended, client } = fakeClient();

    const result = await applyChatbotBookingAttribution(client, makeEvent());

    expect(result).toMatchObject({ matched: true, action: "booked" });
    expect(updates).toHaveLength(1);
    expect(updates[0].call_booked_at).toEqual(expect.any(String));
    expect(updates[0].booked_event_uri).toBe(
      "https://api.calendly.com/scheduled_events/x",
    );
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
      makeEvent({ utmContent: null }),
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
});
