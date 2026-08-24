import "server-only";

import type { CloseClient } from "@/lib/close/client";
import {
  escapeHtml,
  writeLeadNoteOnce,
  type NoteClient,
} from "@/lib/chatbot/close-note";
import { publicConfig } from "@/lib/config";

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
 * The lead resolution, the do-not-double-post check and the fail-soft
 * boundary all live in close-note.ts, shared with the engagement note. This
 * file is now only the marker and the wording.
 */
export async function stampChatbotBookingOnCloseLead(
  input: StampChatbotBookingOnCloseLeadInput,
  deps: { client?: NoteClient; closeClient?: CloseClient } = {},
): Promise<void> {
  await writeLeadNoteOnce(
    {
      conversationId: input.conversationId,
      marker: noteMarker(input),
      buildHtml: (marker) => noteHtml(input, marker),
    },
    deps,
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
