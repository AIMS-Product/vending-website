import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";

export type SequenceStep = "follow_up" | "nudge" | "final";

const NUDGE_AFTER_HOURS = 24;
const FINAL_AFTER_HOURS = 48;

/**
 * Which automatic email is due, if any: the follow-up once the chat has been
 * quiet, a nudge a day later, a last one two days after that. Any reply from
 * them ends the sequence; from then on the agent only answers.
 */
export function nextSequenceStep(
  messages: readonly ChatbotMessage[],
  now: Date,
): SequenceStep | null {
  if (messages.some((m) => m.kind === "email_received")) return null;
  const sent = messages.filter(
    (m) => m.kind === "email_sent" && m.data?.step !== "reply",
  );
  if (sent.length === 0) return "follow_up";
  const last = sent[sent.length - 1];
  const hours = (now.getTime() - Date.parse(last.ts)) / 3_600_000;
  if (last.data?.step === "follow_up" && hours >= NUDGE_AFTER_HOURS)
    return "nudge";
  if (last.data?.step === "nudge" && hours >= FINAL_AFTER_HOURS) return "final";
  return null;
}
