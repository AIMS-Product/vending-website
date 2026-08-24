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
 * Two ways a booking gets tied back to a conversation:
 *
 * 1. `in_chat` -- exact evidence. The in-chat calendar is loaded with
 *    `utm_source=chatbot&utm_content=<conversation id>` (lib/chatbot/booking.ts),
 *    and Calendly echoes both back on the invitee webhook.
 * 2. `email_match` -- inferred fallback, for a visitor who chatted, left, and
 *    booked later through /book-now or an emailed link with no utm on it.
 *    Matched on `captured_email` within a trailing window. Weaker evidence,
 *    so it can never overwrite or clear an `in_chat` stamp.
 *
 * This is the only place either match is made, which is what lets
 * /admin/chatbot say a booked call came from a specific conversation.
 *
 * Everything in this file is fail-soft. A booking is already recorded in
 * calendly_bookings by the time this runs -- failing to also stamp the
 * conversation must never turn a successful webhook into a 500 that makes
 * Calendly retry a booking we already have.
 */

type AttributionClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

export type AttributionSource = "in_chat" | "email_match";

export type BookingAttributionResult =
  | { matched: false }
  | {
      matched: true;
      conversationId: string;
      action: "booked" | "canceled";
      attributionSource: AttributionSource;
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How far back a conversation's `created_at` may sit before a booking for the
 * email fallback to still credit it. Long enough to cover "chatted, thought
 * about it, booked from an email a couple weeks later"; short enough that an
 * old visitor who happens to share an email with a new one (shared inbox,
 * re-contact months later) does not get wrongly credited.
 */
export const EMAIL_MATCH_WINDOW_DAYS = 30;

/** Small candidate page for the email lookup -- one email rarely has more than a few conversations. */
const EMAIL_MATCH_CANDIDATE_LIMIT = 5;

/** Postgres "column does not exist" -- this migration ships ahead of being applied. */
function isMissingColumnError(message: string): boolean {
  return (
    message.includes("call_booked_at") ||
    message.includes("booked_event_uri") ||
    message.includes("attribution_source") ||
    message.includes("42703")
  );
}

/**
 * Stamps (or un-stamps, on a cancellation) the conversation a Calendly
 * invitee event came from. Returns `{ matched: false }` for every booking
 * that did not originate in the chat (in_chat or email_match), which is most
 * of them.
 */
export async function applyChatbotBookingAttribution(
  client: AttributionClient,
  event: CalendlyWebhookEvent,
): Promise<BookingAttributionResult> {
  const utmConversationId = matchedConversationId(event);
  if (utmConversationId) {
    return applyMatchedAttribution(client, event, utmConversationId, "in_chat");
  }

  const emailConversationId = await findEmailMatchedConversationId(
    client,
    event,
  );
  if (!emailConversationId) return { matched: false };

  return applyMatchedAttribution(
    client,
    event,
    emailConversationId,
    "email_match",
  );
}

type ExistingConversation = {
  messages: Json;
  call_booked_at: string | null;
  booked_event_uri: string | null;
  attribution_source: string | null;
  /** False before the v2 migration is applied -- the redelivery guards below cannot run without those columns. */
  hasV2Columns: boolean;
};

/**
 * Applies one already-resolved match (either source) to the conversation it
 * points at. Everything below `matchedConversationId` /
 * `findEmailMatchedConversationId` is shared so both sources get the same
 * redelivery and out-of-order guards.
 */
async function applyMatchedAttribution(
  client: AttributionClient,
  event: CalendlyWebhookEvent,
  conversationId: string,
  source: AttributionSource,
): Promise<BookingAttributionResult> {
  const existing = await loadConversation(client, conversationId);
  if (!existing) {
    // A utm_content that looks like a conversation id but isn't one, or an
    // email match against a conversation that no longer exists. Not an error.
    return { matched: false };
  }

  const canceled = event.eventKind === "invitee.canceled";

  // An exact utm_content match is strictly better evidence than an inferred
  // email match. Once a conversation is stamped in_chat, an email match must
  // never touch it again -- not to overwrite a fresh booking, and not to
  // clear one on a cancel that may well belong to a different, unrelated
  // Calendly event for the same person.
  if (source === "email_match" && isInChatAttributed(existing)) {
    return { matched: false };
  }

  if (canceled) {
    if (isCancelGuarded(existing, event, source)) return { matched: false };
  } else if (
    // Calendly retries failed deliveries and does not guarantee ordering, so
    // a create can arrive AFTER its own cancellation (create delivery fails
    // on a cold start, the cancel lands, the create is retried). Re-stamping
    // then would resurrect a cancelled call and count it in callsBooked30d
    // forever. A cleared call_booked_at with the same booked_event_uri is
    // exactly the "this event was already cancelled" fingerprint.
    existing.booked_event_uri === event.scheduledEventUri &&
    existing.call_booked_at === null &&
    existing.hasV2Columns
  ) {
    return { matched: false };
  }

  const update: Database["public"]["Tables"]["chatbot_conversations"]["Update"] =
    canceled
      ? { call_booked_at: null }
      : {
          call_booked_at: new Date().toISOString(),
          booked_event_uri: event.scheduledEventUri,
          attribution_source: source,
        };

  const applied = await updateTolerantly(client, conversationId, update);

  // On a booking, drop a confirmation card into the transcript so a visitor
  // still sitting in the chat sees it land. Skipped when one is already there
  // (Calendly redelivers webhooks) and skipped entirely on a cancellation --
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
    attributionSource: source,
  };
}

/** True once a conversation already carries an in_chat stamp, including the pre-column legacy shape. */
function isInChatAttributed(existing: ExistingConversation): boolean {
  if (existing.call_booked_at === null) return false;
  if (existing.attribution_source === "in_chat") return true;
  // Rows written before this column existed: a still-booked row with no
  // label but a booked_event_uri can only be an in_chat stamp -- email_match
  // did not exist yet when it was written.
  return (
    existing.attribution_source === null && existing.booked_event_uri !== null
  );
}

/** Whether a cancellation should be ignored rather than clearing the conversation's booking. */
function isCancelGuarded(
  existing: ExistingConversation,
  event: CalendlyWebhookEvent,
  source: AttributionSource,
): boolean {
  if (!existing.hasV2Columns) return false;
  if (source === "email_match") {
    // Only clear a booking THIS email match produced -- never a different
    // event, and never one it never booked in the first place.
    return existing.booked_event_uri !== event.scheduledEventUri;
  }
  // Only clear on a cancellation for the event that is actually booked -- a
  // stale cancel for a previous, already-rebooked event must not wipe the
  // live one. A never-booked conversation (booked_event_uri null) falls
  // through: there is nothing to wipe, so the clear below is a harmless
  // no-op.
  return (
    existing.booked_event_uri !== null &&
    existing.booked_event_uri !== event.scheduledEventUri
  );
}

async function loadConversation(
  client: AttributionClient,
  conversationId: string,
): Promise<ExistingConversation | null> {
  const full = await client
    .from("chatbot_conversations")
    .select("id,messages,call_booked_at,booked_event_uri,attribution_source")
    .eq("id", conversationId)
    .maybeSingle();

  if (!full.error) {
    if (!full.data) return null;
    return {
      messages: full.data.messages,
      call_booked_at: full.data.call_booked_at,
      booked_event_uri: full.data.booked_event_uri,
      attribution_source: full.data.attribution_source,
      hasV2Columns: true,
    };
  }
  if (!isMissingColumnError(full.error.message)) return null;

  // attribution_source ships in its own migration after call_booked_at /
  // booked_event_uri, so it can be the one column missing while the rest of
  // v2 is already applied. Try that shape before falling all the way back.
  const v2WithoutSource = await client
    .from("chatbot_conversations")
    .select("id,messages,call_booked_at,booked_event_uri")
    .eq("id", conversationId)
    .maybeSingle();

  if (!v2WithoutSource.error) {
    if (!v2WithoutSource.data) return null;
    return {
      messages: v2WithoutSource.data.messages,
      call_booked_at: v2WithoutSource.data.call_booked_at,
      booked_event_uri: v2WithoutSource.data.booked_event_uri,
      attribution_source: null,
      hasV2Columns: true,
    };
  }
  if (!isMissingColumnError(v2WithoutSource.error.message)) return null;

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
    attribution_source: null,
    hasV2Columns: false,
  };
}

/**
 * Appends via the chatbot_append_message SQL function rather than a
 * read-modify-write.
 *
 * The chat route rewrites the WHOLE messages array once per turn, from a
 * snapshot taken before its model calls -- a window of up to a minute. A
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

/** Escapes ILIKE metacharacters so an email is matched literally, never as a wildcard. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * The anchor point for the email-match window. Calendly's webhook does not
 * carry an "invitee created at" timestamp in the shape this integration
 * parses, so the scheduled call's own start time is the only timestamp on
 * the event to anchor on. Falls back to now when even that is missing/bad.
 *
 * ponytail: anchoring on eventStartAt (not the actual booking action time)
 * is a naive stand-in; upgrade path is parsing payload.created_at directly
 * in calendly-webhook.ts if this ever needs to be exact.
 */
function resolveBookingTime(event: CalendlyWebhookEvent): Date {
  const candidate = event.eventStartAt ? new Date(event.eventStartAt) : null;
  if (candidate && !Number.isNaN(candidate.getTime())) return candidate;
  return new Date();
}

/**
 * Finds the most recently created conversation whose captured_email matches
 * the invitee's email (case-insensitive), within EMAIL_MATCH_WINDOW_DAYS
 * before the booking. Returns null on no match, no email, or a lookup error
 * -- all treated the same as "this booking did not come from the chat".
 */
async function findEmailMatchedConversationId(
  client: AttributionClient,
  event: CalendlyWebhookEvent,
): Promise<string | null> {
  const email = event.inviteeEmail?.trim();
  if (!email) return null;

  const bookingTime = resolveBookingTime(event);
  const windowStart = new Date(
    bookingTime.getTime() - EMAIL_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const { data, error } = await client
    .from("chatbot_conversations")
    .select("id,created_at")
    .ilike("captured_email", escapeLikePattern(email))
    .order("created_at", { ascending: false })
    .limit(EMAIL_MATCH_CANDIDATE_LIMIT);

  if (error) {
    console.warn("chatbot: email-match lookup failed", {
      error: error.message,
    });
    return null;
  }
  if (!data) return null;

  const withinWindow = data.find((row) => {
    const createdAt = new Date(row.created_at);
    return (
      !Number.isNaN(createdAt.getTime()) &&
      createdAt >= windowStart &&
      createdAt <= bookingTime
    );
  });

  return withinWindow?.id ?? null;
}

/**
 * Applies the column update, and reports whether it landed. Before the v2
 * migration is applied there are no columns to write, so this is a no-op that
 * returns false -- the confirmation card is appended separately either way.
 *
 * If the write fails only because attribution_source specifically does not
 * exist yet (this migration ships ahead of the earlier one being hand
 * applied), retries without it so call_booked_at still lands -- losing the
 * booking stamp over a cosmetic label column would be a real regression.
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

  if ("attribution_source" in update) {
    const withoutSource: typeof update = { ...update };
    delete (withoutSource as Record<string, unknown>).attribution_source;

    const retry = await client
      .from("chatbot_conversations")
      .update(withoutSource)
      .eq("id", conversationId);

    if (!retry.error) return true;

    if (!isMissingColumnError(retry.error.message)) {
      console.warn("chatbot: could not attribute booking to conversation", {
        conversationId,
        error: retry.error.message,
      });
    }
    return false;
  }

  return false;
}
