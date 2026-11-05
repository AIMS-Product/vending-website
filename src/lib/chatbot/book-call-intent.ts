import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";

/** Does the visitor name a day or a clock time ("Friday", "tomorrow", "2pm", "13:15")? */
export function namesATime(message: string): boolean {
  return /\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b|\b(today|tonight|tomorrow|noon|morning|afternoon|evening)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(
    message,
  );
}

/** A plain yes, with nothing else asked ("yes", "yep that works", "book it"). */
export function isPlainYes(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (text.length > 60 || text.includes("?")) return false;
  return /^(yes|yep|yeah|yup|sure|ok|okay|sounds good|perfect|great|that works|works|correct|confirmed?|do it|book it|let'?s do it)\b/.test(
    text,
  );
}

/** A proposal the visitor has not answered yet (no user turn after it). */
export function hasPendingProposal(prior: readonly ChatbotMessage[]): boolean {
  const index = prior.findLastIndex((m) => m.kind === "booking_proposed");
  if (index < 0) return false;
  if (prior.some((m) => m.kind === "booking_confirmed")) return false;
  return !prior.slice(index + 1).some((m) => m.role === "user");
}

/**
 * The reply says a call is booked / held / locked in. Used only when no
 * booking was confirmed, so a false claim never reaches the visitor
 * (2026-11-04 preview: "Locked in, I'll reserve you for Friday at 4:30 PM"
 * with nothing booked).
 */
export function claimsBooking(text: string): boolean {
  return /\blocked (it |you )?in\b|\byou'?re (all set|booked|confirmed)\b|\bi'?ve (booked|reserved|locked|scheduled)\b|\bi (booked|reserved|scheduled) (you|it|that)\b|\bbooked you\b|\breserved? you\b|\b(is|are) (now )?(booked|reserved|confirmed|scheduled)\b|\bi'?ll (reserve|hold) (you|it|that)\b|\bfor you now\b/i.test(
    text,
  );
}

export const NOT_BOOKED_LINE =
  "Quick note: nothing is booked yet. Tell me the day and time you want and I'll set it up, or grab a slot on the calendar.";

/**
 * Direct booking takes the decision away from the model at the two moments
 * that matter: a named time is always proposed (server-checked against the
 * calendar), and a plain yes to a pending proposal always books (with every
 * book_call check still applied). Otherwise the usual forced tool stands,
 * except a forced calendar when a time was named.
 */
export function directBookingForcedTool(input: {
  message: string;
  priorMessages: readonly ChatbotMessage[];
  chosenTool: string | undefined;
  booked: boolean;
}): string | undefined {
  if (input.booked) return input.chosenTool;
  if (hasPendingProposal(input.priorMessages) && isPlainYes(input.message)) {
    return "book_call";
  }
  if (namesATime(input.message)) return "propose_call_time";
  return input.chosenTool;
}
