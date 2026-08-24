import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config, publicConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type NoteClient = Pick<SupabaseClient<Database>, "from">;

export type ChatbotBookingAttributionSource = "in_chat" | "email_match";

export type StampChatbotBookingOnCloseLeadInput = {
  conversationId: string;
  attributionSource: ChatbotBookingAttributionSource;
  scheduledEventName: string | null;
  eventStartAt: string | null;
};

/**
 * Puts the chatbot -> booked call link where a rep will actually see it: a
 * note on the Close lead, not just our own admin page.
 *
 * Deliberately a NOTE only. `entry_source` is a strict `choices` field in
 * Close that fails the whole lead update on an unexpected value, and Recapture
 * State / Ever Had Call are owned by Close's own automation (see the comments
 * around `closeTaggingPayload` in close/client.ts) -- writing any of those
 * from here could park a lead or steal a lead from that automation. A note is
 * additive: it cannot fail a lead update and cannot change which leads any
 * Close workflow picks up.
 *
 * Fails soft end to end -- no configured API key, a missing Close lead, a
 * Close 4xx, a network error -- none of it throws. This runs inside a webhook
 * handler's non-fatal boundary, and a reconciliation sweep may call it again
 * for the same booking; either one throwing would make Calendly retry a
 * booking that is already recorded.
 */
export async function stampChatbotBookingOnCloseLead(
  input: StampChatbotBookingOnCloseLeadInput,
  deps: { client?: NoteClient; closeClient?: CloseClient } = {},
): Promise<void> {
  if (!config.CLOSE_API_KEY) return;

  try {
    const client = deps.client ?? createAdminClient();
    const leadId = await resolveCloseLeadId(client, input.conversationId);
    if (!leadId) return; // No CRM record yet -- normal, not an error.

    const closeClient =
      deps.closeClient ??
      createCloseClient({
        apiKey: config.CLOSE_API_KEY,
        baseUrl: config.CLOSE_API_BASE_URL,
      });

    const marker = noteMarker(input);

    // ponytail: check-then-act against Close's live notes, not an atomic
    // reservation. Close's note-create endpoint has no idempotency key or
    // server-side dedupe (checked against developer.close.com), and this
    // function is called directly from a webhook handler rather than through
    // the close_sync_events outbox that gives lead writes their dedupe
    // guarantee (dedupe.ts) -- so there is no queue row to make this atomic.
    // Two deliveries landing at the exact same instant could both pass this
    // check and post twice; a redelivery minutes apart or a scheduled
    // reconciliation sweep will not. Upgrade path if that race ever matters:
    // a unique constraint on a small "close_booking_notes" table keyed by the
    // same marker.
    // ponytail: the marker is looked for in the newest page of notes only
    // (client.ts sends _limit=50, unpaginated). A lead that accumulates 50
    // newer notes could take a second copy of this one. Acceptable: a booking
    // note is written within minutes of the booking, and the sweep is
    // idempotent on the same day. Upgrade path is the dedupe table below.
    const alreadyNoted = await hasExistingNote(closeClient, leadId, marker);
    if (alreadyNoted) return;

    await closeClient.createNote({
      lead_id: leadId,
      note_html: noteHtml(input, marker),
    });
  } catch (error) {
    console.warn("chatbot: could not stamp Close lead with booking note", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function resolveCloseLeadId(
  client: NoteClient,
  conversationId: string,
): Promise<string | null> {
  const conversation = await client
    .from("chatbot_conversations")
    .select("lead_submission_id")
    .eq("id", conversationId)
    .maybeSingle();

  const leadSubmissionId = conversation.data?.lead_submission_id;
  if (conversation.error || !leadSubmissionId) return null;

  const lead = await client
    .from("lead_submissions")
    .select("close_lead_id")
    .eq("id", leadSubmissionId)
    .maybeSingle();

  if (lead.error || !lead.data?.close_lead_id) return null;
  return lead.data.close_lead_id;
}

async function hasExistingNote(
  closeClient: CloseClient,
  leadId: string,
  marker: string,
): Promise<boolean> {
  const result = await closeClient.listLeadNotes(leadId);
  return (result.data ?? []).some(
    (note) => note.note_html?.includes(marker) || note.note?.includes(marker),
  );
}

/**
 * Stable per-booking marker embedded in the note text. Keyed on the
 * conversation and the event's start time (not just the conversation) so a
 * genuinely separate booking from the same conversation -- a reschedule to a
 * new time, a second call booked later -- still gets its own note instead of
 * being silently swallowed by the first one's marker.
 */
function noteMarker(input: {
  conversationId: string;
  eventStartAt: string | null;
}): string {
  return `chatbot-booking-ref:${input.conversationId}:${input.eventStartAt ?? "no-start-time"}`;
}

function noteHtml(
  input: StampChatbotBookingOnCloseLeadInput,
  marker: string,
): string {
  const lines = [
    input.attributionSource === "in_chat"
      ? "This lead booked their call directly from the calendar inside the site chatbot."
      : "This lead chatted with the site chatbot first, then booked their call later through a different link (matched by email).",
    input.scheduledEventName
      ? `Event: ${escapeHtml(input.scheduledEventName)}`
      : null,
    input.eventStartAt
      ? `Scheduled for: ${escapeHtml(input.eventStartAt)}`
      : null,
    `Full chat transcript: ${escapeHtml(conversationUrl(input.conversationId))}`,
    `Reference: ${escapeHtml(marker)}`,
  ].filter((line): line is string => line !== null);

  return `<body>${lines.map((line) => `<p>${line}</p>`).join("")}</body>`;
}

function conversationUrl(conversationId: string): string {
  return `${publicConfig.siteUrl}/admin/chatbot/conversations/${conversationId}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
