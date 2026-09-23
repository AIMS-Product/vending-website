import { createHash } from "node:crypto";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import {
  hasCostIntent,
  hasExplicitBookingIntent,
  shouldForceBookingCalendar,
} from "@/lib/chatbot/tools";
import { triageConversation } from "@/lib/chatbot/triage";

/**
 * "Give value before asking for the call" (spec 2026-09-23, slice 3), behind
 * one switch: CHATBOT_VALUE_FIRST. Unset or anything unrecognised is OFF, and
 * production behaves exactly as before.
 *
 * - "on":    every conversation
 * - "split": half of conversations, by a stable hash of the conversation id,
 *            for the two-week comparison the spec asks for
 */
export function isValueFirstConversation(
  conversationId: string,
  flag: string | null | undefined,
): boolean {
  const mode = flag?.trim().toLowerCase();
  if (mode === "on") return true;
  if (mode !== "split") return false;
  const firstByte = createHash("sha256").update(conversationId).digest()[0];
  return (firstByte ?? 0) % 2 === 0;
}

/**
 * Visitor messages before the calendar may open on the model's own
 * initiative. Calendar opened at the visitor's 1st message booked 13%, at the
 * 4th or later 50% (30 days to 2026-09-23). A booking ask always overrides.
 */
export const VALUE_FIRST_MESSAGES_BEFORE_CALENDAR = 3;

/**
 * True when show_booking_calendar should decline this turn: value-first is on,
 * the visitor has sent fewer than three messages, has never asked to book,
 * and did not ask about cost on an EARLIER message (a cost question gets the
 * video first and the calendar on the next turn).
 *
 * `visitorMessages` includes the current message, last.
 */
export function shouldHoldCalendar(input: {
  valueFirst: boolean;
  visitorMessages: readonly string[];
}): boolean {
  if (!input.valueFirst) return false;
  const messages = input.visitorMessages;
  if (messages.length >= VALUE_FIRST_MESSAGES_BEFORE_CALENDAR) return false;
  if (messages.some(hasExplicitBookingIntent)) return false;
  if (messages.slice(0, -1).some(hasCostIntent)) return false;
  return true;
}

/**
 * The one tool the route requires this turn, if any. Off: today's rule (cost
 * or booking intent forces the calendar). On: an explicit booking ask still
 * forces the calendar; a cost question gets the cost video once instead.
 */
export function chooseForcedTool(input: {
  valueFirst: boolean;
  hasSeenCalendar: boolean;
  priorMessages: readonly ChatbotMessage[];
  message: string;
}): "show_booking_calendar" | "share_resource" | undefined {
  if (!input.valueFirst) {
    return !input.hasSeenCalendar &&
      shouldForceBookingCalendar(input.message, input.priorMessages)
      ? "show_booking_calendar"
      : undefined;
  }
  // Same whole-chat triage as the flag-off rule: a member-support or
  // already-booked chat gets neither the sales calendar nor the cost video.
  const triage = triageConversation([
    ...input.priorMessages,
    { role: "user", content: input.message },
  ]);
  if (triage !== "sales") return undefined;
  if (hasExplicitBookingIntent(input.message)) {
    return input.hasSeenCalendar ? undefined : "show_booking_calendar";
  }
  if (hasCostIntent(input.message)) {
    const videoShared = input.priorMessages.some(
      (m) => m.kind === "shared_resource" && m.data?.key === "cost_to_join",
    );
    return videoShared ? undefined : "share_resource";
  }
  return undefined;
}
