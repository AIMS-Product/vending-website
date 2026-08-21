import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CHATBOT_BOOKING_UTM_SOURCE } from "@/lib/chatbot/booking";
import {
  toChatbotMessages,
  type ChatbotMessage,
} from "@/lib/chatbot/conversation-store";
import type { CalendlyWebhookEvent } from "@/lib/services/calendly-webhook";
import type { Database, Json } from "@/types/database";

/**
 * The chat -> booked call attribution link, and the only place it is made.
 *
 * The chain is two values wide: the in-chat calendar is loaded with
 * `utm_source=chatbot&utm_content=<conversation id>` (lib/chatbot/booking.ts),
 * and Calendly echoes both back on the invitee webhook. Matching them here is
 * what lets /admin/chatbot say a booked call came from a specific
 * conversation, which is the whole reason v2 exists.
 *
 * Everything in this file is fail-soft. A booking is already recorded in
 * calendly_bookings by the time this runs — failing to also stamp the
 * conversation must never turn a successful webhook into a 500 that makes
 * Calendly retry a booking we already have.
 */

type AttributionClient = Pick<SupabaseClient<Database>, "from">;

export type BookingAttributionResult =
  | { matched: false }
  | { matched: true; conversationId: string; action: "booked" | "canceled" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres "column does not exist" — this migration ships ahead of being applied. */
function isMissingColumnError(message: string): boolean {
  return (
    message.includes("call_booked_at") ||
    message.includes("booked_event_uri") ||
    message.includes("42703")
  );
}

/**
 * Stamps (or un-stamps, on a cancellation) the conversation a Calendly
 * invitee event came from. Returns `{ matched: false }` for every booking
 * that did not originate in the chat, which is most of them.
 */
export async function applyChatbotBookingAttribution(
  client: AttributionClient,
  event: CalendlyWebhookEvent,
): Promise<BookingAttributionResult> {
  const conversationId = matchedConversationId(event);
  if (!conversationId) return { matched: false };

  const { data, error } = await client
    .from("chatbot_conversations")
    .select("id,messages")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) {
    // A utm_content that looks like a conversation id but isn't one — a
    // recycled link, a test booking, a deleted conversation. Not an error.
    return { matched: false };
  }

  const canceled = event.eventKind === "invitee.canceled";
  const messages = toChatbotMessages(data.messages);

  const update: Database["public"]["Tables"]["chatbot_conversations"]["Update"] =
    canceled
      ? { call_booked_at: null }
      : {
          call_booked_at: new Date().toISOString(),
          booked_event_uri: event.scheduledEventUri,
        };

  // On a booking, drop a confirmation card into the transcript so a visitor
  // still sitting in the chat sees it land. Skipped when one is already there
  // (Calendly redelivers webhooks) and skipped entirely on a cancellation —
  // rewriting the transcript to say "cancelled" is not this system's job.
  const alreadyConfirmed = messages.some(
    (message) =>
      message.kind === "booking_confirmed" &&
      message.data?.event_uri === event.scheduledEventUri,
  );
  if (!canceled && !alreadyConfirmed) {
    const confirmation: ChatbotMessage = {
      role: "assistant",
      content: "Booked. Check your email for the calendar invite.",
      ts: new Date().toISOString(),
      kind: "booking_confirmed",
      data: {
        event_uri: event.scheduledEventUri,
        starts_at: event.eventStartAt,
      },
    };
    // ponytail: read-modify-write on the messages array, so a chat turn
    // completing in the same second can overwrite this card (the columns
    // above are never clobbered — persistConversationTurn does not touch
    // them, so the KPI and the funnel stay correct either way). Move to a
    // jsonb append in SQL if the card ever goes missing in practice.
    update.messages = [...messages, confirmation] as unknown as Json;
    update.message_count = messages.length + 1;
  }

  const applied = await updateTolerantly(client, conversationId, update);
  if (!applied) return { matched: false };

  return {
    matched: true,
    conversationId,
    action: canceled ? "canceled" : "booked",
  };
}

function matchedConversationId(event: CalendlyWebhookEvent): string | null {
  if (event.utmSource !== CHATBOT_BOOKING_UTM_SOURCE) return null;
  const candidate = event.utmContent?.trim();
  if (!candidate || !UUID_PATTERN.test(candidate)) return null;
  return candidate;
}

/**
 * Applies the update, retrying without the v2 columns if they do not exist
 * yet. The transcript card is worth writing on its own even before the
 * migration lands — it is what the visitor sees.
 */
async function updateTolerantly(
  client: AttributionClient,
  conversationId: string,
  update: Database["public"]["Tables"]["chatbot_conversations"]["Update"],
): Promise<boolean> {
  const { error } = await client
    .from("chatbot_conversations")
    .update(update)
    .eq("id", conversationId);

  if (!error) return true;

  if (!isMissingColumnError(error.message)) {
    console.warn("chatbot: could not attribute booking to conversation", {
      conversationId,
      error: error.message,
    });
    return false;
  }

  const {
    call_booked_at: _bookedAt,
    booked_event_uri: _eventUri,
    ...legacyUpdate
  } = update;
  if (Object.keys(legacyUpdate).length === 0) return false;

  const legacy = await client
    .from("chatbot_conversations")
    .update(legacyUpdate)
    .eq("id", conversationId);
  if (legacy.error) {
    console.warn("chatbot: could not write booking confirmation message", {
      conversationId,
      error: legacy.error.message,
    });
    return false;
  }
  return true;
}
