/**
 * What a chat is FOR, from what the visitor typed: a sales conversation, an
 * existing member who needs support, or someone who already has a call on the
 * calendar. One definition, read by the chat route (whether the calendar is
 * forced open), the learning engine (whether a sales follow-up is drafted) and
 * the admin dashboard (whether the chat belongs in the sales funnel).
 *
 * Deliberately narrow. A prospect asking "is there a refund policy?" or "can I
 * cancel later?" is still a sales chat; only a visitor talking about THEIR
 * account, charge, membership or call is triaged out. Missing a support chat
 * costs a misfiled draft; misfiling a prospect costs a booking.
 *
 * ponytail: regex, not a model. Upgrade path is the LLM digest's per-chat
 * label if these patterns start missing real support chats.
 */

export type ChatTriage = "sales" | "support" | "booked_already";

const SUPPORT_PATTERNS: readonly RegExp[] = [
  /\b(log\s*in|login|sign\s*in)\b.*\b(account|portal|course|platform|can'?t|cannot|won'?t|unable|trouble|problem)\b/i,
  /\b(can'?t|cannot|unable to|trouble|problem)\b.*\b(log\s*in|login|sign\s*in|access)\b/i,
  /\bpassword\b/i,
  /\bcancel\s+(my|our|the)\s+(subscription|membership|account|plan|program|enrollment|enrolment)\b/i,
  /\b(pause|freeze)\s+(my|our|the)\s+(subscription|membership|account|plan)\b/i,
  /\b(want|need|get|request\w*|issue|process\w*|waiting\s+(on|for))\s+(a\s+|my\s+|the\s+)?refund\b/i,
  /\b(my|a full)\s+refund\b/i,
  /\brefund\s+me\b/i,
  /\b(already|current|existing|paying)\s+(a\s+)?(member|customer|student|client)\b/i,
  /\bi('?m| am)\s+(a\s+)?(current|existing|paying)?\s*(member|customer|student)\s+(of|in|with|already)\b/i,
  /\b(was|been|got)\s+(double\s+)?(charged|billed)\b/i,
  /\bcharged\s+twice\b/i,
  /\bmy\s+(membership|billing|invoice|account)\b/i,
];

const BOOKED_ALREADY_PATTERNS: readonly RegExp[] = [
  /\bcancel\s+(my|our|the)\s+(call|meeting|appointment|consult\w*)\b/i,
  /\breschedul\w*\b/i,
  /\b(i|we)\s+(have|had)\s+(a|my|the|an)\s+(call|meeting|appointment|consult\w*)\b/i,
  /\balready\s+(booked|scheduled|have\s+a\s+(call|meeting|appointment))\b/i,
  /\bmy\s+(call|meeting|appointment)\s+(is|was)\b/i,
];

/** One visitor message. Support outranks booked-already. */
export function triageMessage(text: string): ChatTriage {
  if (SUPPORT_PATTERNS.some((pattern) => pattern.test(text))) return "support";
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
 */
export function triageConversation(messages: unknown): ChatTriage {
  if (!Array.isArray(messages)) return "sales";
  let result: ChatTriage = "sales";
  for (const raw of messages as TriageMessage[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.kind === "booking_confirmed") break;
    if (raw.role !== "user" || typeof raw.content !== "string") continue;
    const verdict = triageMessage(raw.content);
    if (verdict === "support") return "support";
    if (verdict === "booked_already") result = "booked_already";
  }
  return result;
}
