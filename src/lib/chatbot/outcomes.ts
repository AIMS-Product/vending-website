import { hasCostIntent } from "@/lib/chatbot/tools";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";

/**
 * What actually happened in a conversation, derived from the stored transcript
 * rather than a new column. The team's daily question is "who asked, who saw a
 * calendar, and who left holding nothing", and every input for it is already
 * persisted: the transcript carries the visitor's questions and every calendar
 * card the bot opened, and the row carries capture + booking.
 *
 * Derived, not stored, on purpose: migrations here are hand-applied to
 * production one at a time, and a status column would need backfilling for
 * every conversation that already happened. This reads the same history.
 */
export type ChatbotConversationOutcome =
  /** A call is on the calendar. The only good ending. */
  | "booked"
  /** The calendar was opened in the chat, nothing was booked, and the chat has gone quiet. */
  | "calendar_abandoned"
  /** We hold an email or phone, no booking. Recoverable by a human. */
  | "captured_no_booking"
  /** No calendar, no contact details, and the chat has gone quiet. Lost. */
  | "left_no_contact"
  /** Still moving — too recent to call. */
  | "open";

/** How long a chat sits quiet before an unfinished outcome counts as over. */
export const CONVERSATION_IDLE_MINUTES = 30;

export type OutcomeInput = {
  messages: unknown;
  capturedEmail: string | null;
  capturedPhone: string | null;
  callBookedAt: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
};

function messageList(messages: unknown): ChatbotMessage[] {
  return Array.isArray(messages) ? (messages as ChatbotMessage[]) : [];
}

function textOf(message: ChatbotMessage): string {
  return typeof message.content === "string" ? message.content : "";
}

/** Did the bot open a booking calendar inside this chat? */
export function calendarWasShown(messages: unknown): boolean {
  return messageList(messages).some((message) => message.kind === "calendar");
}

/**
 * Did the visitor ask what it costs? Uses the same detector that forces the
 * calendar open (tools.ts), so the dashboard counts exactly the population the
 * bot treats as a cost question — no second, drifting definition.
 */
export function askedAboutCost(messages: unknown): boolean {
  return messageList(messages).some(
    (message) => message.role === "user" && hasCostIntent(textOf(message)),
  );
}

/** The visitor's first message, for grouping "everyone asked the same thing". */
export function openingQuestion(messages: unknown): string | null {
  const first = messageList(messages).find(
    (message) => message.role === "user" && textOf(message).trim().length > 0,
  );
  return first ? textOf(first).trim() : null;
}

/** Timestamp of the newest message in the transcript, if it carries one. */
export function lastMessageTs(messages: unknown): string | null {
  const list = messageList(messages);
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const ts = list[index]?.ts;
    if (typeof ts === "string" && ts.length > 0) return ts;
  }
  return null;
}

function isIdle(input: OutcomeInput, now: Date): boolean {
  const stamp =
    input.lastMessageAt ?? lastMessageTs(input.messages) ?? input.createdAt;
  if (!stamp) return false;
  const at = new Date(stamp).getTime();
  if (Number.isNaN(at)) return false;
  return now.getTime() - at >= CONVERSATION_IDLE_MINUTES * 60_000;
}

export function deriveConversationOutcome(
  input: OutcomeInput,
  now: Date = new Date(),
): ChatbotConversationOutcome {
  if (input.callBookedAt) return "booked";

  // Trimmed, to match isCaptured in analytics.ts: a whitespace-only value
  // counting as captured on one surface and not the other put two different
  // numbers for the same thing on one admin page.
  const captured = Boolean(
    input.capturedEmail?.trim() || input.capturedPhone?.trim(),
  );
  if (captured) return "captured_no_booking";

  if (!isIdle(input, now)) return "open";
  return calendarWasShown(input.messages)
    ? "calendar_abandoned"
    : "left_no_contact";
}
