/**
 * Who gets credit for a chatbot lead's booked call.
 *
 * Two separate credits, and the whole point of this module is that they are
 * never collapsed into one:
 *
 * - ENTRY credit is the chatbot's, for every conversation that exists. If they
 *   talked to the bot, the bot brought them in. Nothing takes that away.
 * - BOOKING credit belongs to whoever actually got them onto the calendar.
 *
 * Booking credit precedence, strongest evidence first:
 *
 * 1. `in_chat` -- Calendly echoed back the chat calendar's own
 *    `utm_content=<conversation id>`. Exact proof of which calendar was
 *    clicked, so the chatbot booked it.
 * 2. A setter name from Close -- a human worked the lead by call/SMS/VM and
 *    booked it. This is the Gerald Winslow case: chatbot first touch Sep 6,
 *    Connor George called and booked Sep 10.
 * 3. Neither -- unknown. Say so. The bug this replaces was rendering exactly
 *    this state as if the chatbot had booked the call.
 *
 * Setters share one round-robin Lane 2 calendar with the chatbot, so the
 * booking link itself can never tell these apart -- only the utm (1) or
 * Close's own setter field (2) can.
 */

export type BookingCreditInput = {
  /** Our own stamp from the Calendly webhook. Null when never recorded. */
  attributionSource: "in_chat" | "email_match" | null;
  /** Close's "Reactivation - Setter Name", mirrored onto the lead. */
  bookedBySetter: string | null;
};

export type BookingCredit =
  | { kind: "in_chat"; label: "Booked in chat"; setter: string | null }
  | { kind: "setter"; label: string; setter: string }
  | { kind: "unknown"; label: "Booked elsewhere"; setter: null };

/**
 * Resolves booking credit for a conversation that has a booked call.
 *
 * `setter` is carried on the `in_chat` result too rather than dropped: a lead
 * can have been worked by a setter AND have booked from the chat calendar
 * itself, and hiding either half is how attribution arguments start.
 */
export function resolveBookingCredit(input: BookingCreditInput): BookingCredit {
  const setter = input.bookedBySetter?.trim() || null;

  if (input.attributionSource === "in_chat") {
    return { kind: "in_chat", label: "Booked in chat", setter };
  }
  if (setter) {
    return { kind: "setter", label: `Set by ${setter}`, setter };
  }
  return { kind: "unknown", label: "Booked elsewhere", setter: null };
}
