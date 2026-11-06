import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";

/** A day after the last automatic email with no answer, the sequence has failed. */
export const QUIET_AFTER_FINAL_HOURS = 24;
/** Two days after Mia's last reply with no answer, a live thread has gone cold. */
export const QUIET_AFTER_REPLY_HOURS = 48;

export type QuietKind = "no_reply" | "replied_then_quiet";

const hoursSince = (ts: string, now: Date) =>
  (now.getTime() - Date.parse(ts)) / 3_600_000;

/**
 * Whether Mia's email thread with this lead has ended without a booking, so a
 * setter should pick it up. Null while the sequence is still running, after a
 * booking, or after they asked us to stop. Pure: callers check bookings.
 */
export function wentQuiet(
  messages: readonly ChatbotMessage[],
  now: Date,
): QuietKind | null {
  if (messages.some((m) => m.kind === "booking_confirmed")) return null;
  const received = messages.filter((m) => m.kind === "email_received");
  if (received.some((m) => m.data?.stop === true)) return null;

  const last = messages[messages.length - 1];
  if (!last) return null;
  if (received.length > 0) {
    // They answered at least once; Mia had the last word and it went cold.
    return last.role === "assistant" &&
      hoursSince(last.ts, now) >= QUIET_AFTER_REPLY_HOURS
      ? "replied_then_quiet"
      : null;
  }
  const finalSent = messages.find(
    (m) => m.kind === "email_sent" && m.data?.step === "final",
  );
  return finalSent && hoursSince(finalSent.ts, now) >= QUIET_AFTER_FINAL_HOURS
    ? "no_reply"
    : null;
}
