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

type AttributionClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

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

  const existing = await loadConversation(client, conversationId);
  if (!existing) {
    // A utm_content that looks like a conversation id but isn't one — a
    // recycled link, a test booking, a deleted conversation. Not an error.
    return { matched: false };
  }

  const canceled = event.eventKind === "invitee.canceled";

  // Calendly retries failed deliveries and does not guarantee ordering, so a
  // create can arrive AFTER its own cancellation (create delivery fails on a
  // cold start, the cancel lands, the create is retried). Re-stamping then
  // would resurrect a cancelled call and count it in callsBooked30d forever.
  // A cleared call_booked_at with the same booked_event_uri is exactly the
  // "this event was already cancelled" fingerprint.
  if (
    !canceled &&
    existing.booked_event_uri === event.scheduledEventUri &&
    existing.call_booked_at === null &&
    existing.hasV2Columns
  ) {
    return { matched: false };
  }

  // Only clear on a cancellation for the event that is actually booked — a
  // stale cancel for a previous, already-rebooked event must not wipe the
  // live one.
  if (
    canceled &&
    existing.hasV2Columns &&
    existing.booked_event_uri !== null &&
    existing.booked_event_uri !== event.scheduledEventUri
  ) {
    return { matched: false };
  }

  const update: Database["public"]["Tables"]["chatbot_conversations"]["Update"] =
    canceled
      ? { call_booked_at: null }
      : {
          call_booked_at: new Date().toISOString(),
          booked_event_uri: event.scheduledEventUri,
        };

  const applied = await updateTolerantly(client, conversationId, update);

  // On a booking, drop a confirmation card into the transcript so a visitor
  // still sitting in the chat sees it land. Skipped when one is already there
  // (Calendly redelivers webhooks) and skipped entirely on a cancellation —
  // rewriting the transcript to say "cancelled" is not this system's job.
  if (!canceled) {
    const messages = toChatbotMessages(existing.messages);
    const alreadyConfirmed = messages.some(
      (message) =>
        message.kind === "booking_confirmed" &&
        message.data?.event_uri === event.scheduledEventUri,
    );
    if (!alreadyConfirmed) {
      await appendConfirmationCard(client, conversationId, event);
    }
  }

  if (!applied) return { matched: false };

  return {
    matched: true,
    conversationId,
    action: canceled ? "canceled" : "booked",
  };
}

type ExistingConversation = {
  messages: Json;
  call_booked_at: string | null;
  booked_event_uri: string | null;
  /** False before the v2 migration is applied — the redelivery guards above cannot run without them. */
  hasV2Columns: boolean;
};

async function loadConversation(
  client: AttributionClient,
  conversationId: string,
): Promise<ExistingConversation | null> {
  const full = await client
    .from("chatbot_conversations")
    .select("id,messages,call_booked_at,booked_event_uri")
    .eq("id", conversationId)
    .maybeSingle();

  if (!full.error) {
    if (!full.data) return null;
    return {
      messages: full.data.messages,
      call_booked_at: full.data.call_booked_at,
      booked_event_uri: full.data.booked_event_uri,
      hasV2Columns: true,
    };
  }
  if (!isMissingColumnError(full.error.message)) return null;

  const legacy = await client
    .from("chatbot_conversations")
    .select("id,messages")
    .eq("id", conversationId)
    .maybeSingle();
  if (legacy.error || !legacy.data) return null;
  return {
    messages: legacy.data.messages,
    call_booked_at: null,
    booked_event_uri: null,
    hasV2Columns: false,
  };
}

/**
 * Appends via the chatbot_append_message SQL function rather than a
 * read-modify-write.
 *
 * The chat route rewrites the WHOLE messages array once per turn, from a
 * snapshot taken before its model calls — a window of up to a minute. A
 * read-then-write here that interleaved with that would delete the visitor's
 * turn and the assistant's reply outright. The SQL append cannot.
 *
 * The card can still be lost the other way (a chat turn's whole-array write
 * landing after this append overwrites it). That is cosmetic and deliberate:
 * every consumer of booking state reads call_booked_at, which is written
 * separately above and is never clobbered.
 */
async function appendConfirmationCard(
  client: AttributionClient,
  conversationId: string,
  event: CalendlyWebhookEvent,
): Promise<void> {
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

  const { error } = await client.rpc("chatbot_append_message", {
    p_conversation_id: conversationId,
    p_message: confirmation as unknown as Json,
  });
  if (error) {
    // Function not created yet (ships ahead of the migration). The booking is
    // already recorded; only the in-chat card is missing.
    console.warn("chatbot: could not append booking confirmation", {
      conversationId,
      error: error.message,
    });
  }
}

function matchedConversationId(event: CalendlyWebhookEvent): string | null {
  if (event.utmSource !== CHATBOT_BOOKING_UTM_SOURCE) return null;
  const candidate = event.utmContent?.trim();
  if (!candidate || !UUID_PATTERN.test(candidate)) return null;
  return candidate;
}

/**
 * Applies the column update, and reports whether it landed. Before the v2
 * migration is applied there are no columns to write, so this is a no-op that
 * returns false — the confirmation card is appended separately either way.
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

  return false;
}
