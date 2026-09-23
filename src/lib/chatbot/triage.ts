/**
 * What a chat is FOR, from what the visitor typed: a sales conversation, an
 * existing member who needs support, or someone who already has a call on the
 * calendar. One definition, read by the chat route (whether the calendar is
 * forced open), the learning engine (whether a sales follow-up is drafted) and
 * the admin dashboard (whether the chat belongs in the sales funnel).
 *
 * Biased hard toward sales. A phrase only leaves sales when it plainly refers
 * to THEIR membership, login, payment or booked call with us: "my membership",
 * "cancel my subscription", "refund my payment", "reschedule my call". A
 * prospect asking "can I get a refund if it doesn't work out?", "I'm a member
 * of your Facebook group" or "I have a meeting with a location manager" stays
 * sales. Missing a support chat costs a misfiled draft; misfiling a prospect
 * costs a booking.
 *
 * ponytail: regex, not a model. Upgrade path is the LLM digest's per-chat
 * label if these patterns start missing real support chats.
 */

export type ChatTriage = "sales" | "support" | "booked_already";

const SUPPORT_PATTERNS: readonly RegExp[] = [
  /\b(can'?t|cannot|unable\s+to|trouble|problems?)\s+(logging|log|signing|sign)\s*(in|into|on)\b/i,
  /\b(log\s*in|login|sign\s*in)\s+(to\s+)?(my\s+account|the\s+(portal|course|platform|community)|my\s+(course|portal))\b/i,
  /\bmy\s+(vendingpreneurs\s+)?(login|log\s*in|password|portal)\b/i,
  /\b(reset|forgot|change|lost)\s+(my\s+)?password\b/i,
  /\bcancel\w*\s+(my|our)\s+(subscription|membership|enrollment|enrolment)\b/i,
  /\b(pause|freeze)\s+(my|our)\s+(subscription|membership)\b/i,
  /\bmy\s+(membership|subscription)\b/i,
  /\b(want|need|requesting|request|waiting\s+(on|for))\s+(a|my)\s+refund\b/i,
  /\brefund\s+(me|my)\b/i,
  /\bmy\s+refund\b/i,
  /\bmy\s+money\s+back\b/i,
  // "of" excluded: "a member of your Facebook group" is a prospect.
  /\b(already|existing|current|paying)\s+(a\s+)?(vendingpreneurs\s+)?member\b(?!\s+of\b)/i,
  /\b(charged|billed)\s+(me\s+)?(twice|double)\b/i,
  /\bdouble[-\s](charged|billed)\b/i,
];

const BOOKED_ALREADY_PATTERNS: readonly RegExp[] = [
  /\bcancel\s+(my|our)\s+(call|meeting|appointment|consult\w*)\b/i,
  /\breschedul\w*\s+(my|our)\s+(call|meeting|appointment|consult\w*)\b/i,
  /\breschedul\w*\s+(an?|the)\s+(appointment)\b/i,
  // "I have a call ON/AT/FOR <when>", never "with my wife" / "with a locator".
  /\bi\s+(already\s+)?have\s+(a|my|an)\s+(call|meeting|appointment|consult\w*)\s+(on|at|scheduled|booked|set|for\s+(mon|tue|wed|thu|fri|sat|sun|tomorrow|today|tonight|next|this))\b/i,
  /\balready\s+(booked|scheduled)\b/i,
  /\bmy\s+(call|meeting|appointment)\s+(is|was)\s+(on|at|for|tomorrow|today|scheduled|booked|supposed)\b/i,
];

/** "If I book, can I reschedule later?" is a prospect asking about policy. */
const HYPOTHETICAL = /\bif\s+i\s+(book|schedule|sign\s+up|join)\b/i;

/**
 * A plain request to book or talk to a person. Lives here, not in tools.ts,
 * because a later booking request also turns a chat back into sales (a member
 * who wants to renew or upgrade IS a call worth booking).
 */
const BOOKING_INTENT_PATTERNS: readonly RegExp[] = [
  /\bbook(ing)?\s+(a|the|my)?\s*(call|time|slot|meeting|appointment|consult\w*)\b/i,
  /\b(schedule|set\s*up|grab|pick|get)\s+(a|the|my)?\s*(call|time|slot|meeting|appointment)\b/i,
  /\blet'?s\s+book\b/i,
  /\bcalendar\b/i,
  /\b(talk|speak|chat|hop\s*on|jump\s*on)\s+(to|with|on)\s+(someone|somebody|a\s+(real\s+)?(person|human|rep|advisor))\b/i,
  /\b(available|availability|open)\s+(times?|slots?)\b/i,
  /\bwhen\s+can\s+(i|we)\s+(talk|speak|meet)\b/i,
  // Missed in real chats, Aug 27-Sep 2: "I would like to take a call
  // tomorrow", "I'm looking to enroll", "how to start". None got a calendar.
  /\b(take|do)\s+(a|the)\s+call\b/i,
  /\b(enroll|enrol|sign\s+(me\s+)?up)\b/i,
  /\bhow\s+(do|can)\s+i\s+(start|get\s+started|begin|join)\b/i,
  /^\s*how\s+to\s+(start|get\s+started|begin|join)\b/i,
  /\b(first|next)\s+steps?\b/i,
];

/**
 * True when the visitor has plainly asked to book or to talk to a person.
 * Callers must also check the calendar has not already been shown.
 */
export function hasExplicitBookingIntent(message: string): boolean {
  return BOOKING_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Narrower than hasExplicitBookingIntent: only an explicit request to BOOK
 * puts a support chat back in sales. "Can I talk to someone" from a member
 * locked out of the portal is still support.
 */
const RESUMES_SALES: readonly RegExp[] = [
  /\bbook(ing)?\s+(a|the|my)?\s*(call|time|slot|meeting|appointment|consult\w*)\b/i,
  /\b(schedule|set\s*up|grab)\s+(a|the)\s*(call|time|slot|meeting|appointment)\b/i,
  /\blet'?s\s+book\b/i,
];

/** One visitor message. Support outranks booked-already. */
export function triageMessage(text: string): ChatTriage {
  if (SUPPORT_PATTERNS.some((pattern) => pattern.test(text))) return "support";
  if (HYPOTHETICAL.test(text)) return "sales";
  if (BOOKED_ALREADY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "booked_already";
  }
  return "sales";
}

type TriageMessage = { role?: unknown; content?: unknown; kind?: unknown };

/**
 * A whole transcript. Reads visitor messages only, and only up to an in-chat
 * booking: "can I reschedule?" after booking from the chat's own calendar is a
 * sales chat that worked, not a support chat.
 *
 * Not sticky: a later plain booking request ("yes let's book", "book a call")
 * puts the chat back in sales. Support outranks booked-already until then.
 */
export function triageConversation(messages: unknown): ChatTriage {
  if (!Array.isArray(messages)) return "sales";
  let result: ChatTriage = "sales";
  for (const raw of messages as TriageMessage[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.kind === "booking_confirmed") break;
    if (raw.role !== "user" || typeof raw.content !== "string") continue;
    const text = raw.content;
    const verdict = triageMessage(text);
    if (verdict === "support") result = "support";
    else if (verdict === "booked_already") {
      if (result !== "support") result = "booked_already";
    } else if (RESUMES_SALES.some((pattern) => pattern.test(text))) {
      result = "sales";
    }
  }
  return result;
}
