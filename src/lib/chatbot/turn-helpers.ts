import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { CHATBOT_INPUT_LIMITS } from "@/lib/chatbot/input-budget";

// Aggregate-chars trim only — checkChatbotInputBudget already rejected the
// request outright if it exceeded the hard ceiling. This is a second, softer
// pass that keeps the most recent turns when a long-but-under-the-limit
// history would otherwise push the OpenAI request needlessly large.
export function trimToBudget(messages: ChatbotMessage[]): ChatbotMessage[] {
  let total = 0;
  const kept: ChatbotMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    total += messages[i].content.length;
    if (total > CHATBOT_INPUT_LIMITS.maxAggregateChars && kept.length > 0)
      break;
    kept.unshift(messages[i]);
  }
  return kept;
}

/**
 * Visitor turns taken since the in-chat calendar last appeared, or null if it
 * never has. Drives the one-time "did you find a time?" nudge in the system
 * prompt; see bookingFollowThroughSection.
 */
export function userTurnsSinceCalendar(
  priorMessages: readonly ChatbotMessage[],
): number | null {
  const lastCalendarIndex = priorMessages.findLastIndex(
    (m) => m.kind === "calendar",
  );
  if (lastCalendarIndex === -1) return null;
  return priorMessages
    .slice(lastCalendarIndex + 1)
    .filter((m) => m.role === "user").length;
}
