/**
 * Who gets credit for a chatbot lead's booked call.
 *
 * Two separate credits, and the whole point of this module is that they are
 * never collapsed into one:
 *
 * - FIRST touch: whatever brought them in. The chatbot only when the chat came
 *   before any other record of them in Close -- see resolveFirstTouch.
 * - LAST touch (BOOKING credit): whoever actually got them onto the calendar.
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

/**
 * Close's "Resource Tag" on a lead the site chatbot created. Mirrors
 * CLOSE_RESOURCE_TAGS.chatbot, copied rather than imported so this module
 * stays safe to import from client components.
 */
const CHATBOT_RESOURCE_TAG = "chatbot";

export type FirstTouchInput = {
  /** When this chat started. */
  conversationCreatedAt: string;
  /** When Close created the linked lead. Null until the reconciler has read it. */
  closeLeadCreatedAt: string | null;
  /** Close "Resource Tag". Set once when Close creates the lead; never overwritten. */
  entryResourceTag: string | null;
};

export type FirstTouch =
  | { kind: "chatbot"; label: "Chatbot" }
  | { kind: "earlier"; label: string; at: string }
  | { kind: "unknown"; label: "Not checked yet" };

/**
 * What touched this person first: the chat, or something that put them in
 * Close before it.
 *
 * Order comes from Close's own `date_created`, which Close sets once and
 * nothing rewrites. A Close lead that already existed when the chat started
 * means the chat was a middle touch (a webinar signup, a Typeform applicant, a
 * setter's Instagram lead) -- unless that earlier record was itself a chat,
 * tagged `chatbot`, in which case the chatbot still came first.
 */
export function resolveFirstTouch(input: FirstTouchInput): FirstTouch {
  if (!input.closeLeadCreatedAt) {
    return { kind: "unknown", label: "Not checked yet" };
  }
  const tag = input.entryResourceTag?.trim() || null;
  const closeCameFirst =
    new Date(input.closeLeadCreatedAt).getTime() <
    new Date(input.conversationCreatedAt).getTime();
  if (!closeCameFirst || tag === CHATBOT_RESOURCE_TAG) {
    return { kind: "chatbot", label: "Chatbot" };
  }
  return {
    kind: "earlier",
    label: tag ? humanizeTag(tag) : "An earlier source",
    at: input.closeLeadCreatedAt,
  };
}

/** `internal-webinar` -> `Internal webinar`. */
function humanizeTag(tag: string): string {
  const words = tag.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
