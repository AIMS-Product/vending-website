import "server-only";

/**
 * The post-pass that makes a reply read like a teammate typing, applied to
 * every assistant reply before it is shown or stored.
 *
 * The prompt already forbids all of this. Across 43 live conversations
 * gpt-4o-mini opened with "That's awesome!" / "Absolutely!" anyway and put
 * three or more exclamation marks in 12 of them. Rules the model ignores get
 * enforced in code.
 */

const FORBIDDEN_OPENERS =
  /^(?:(?:that'?s|thats)\s+(?:awesome|great|exciting|fantastic|wonderful|amazing)(?:\s+to\s+hear)?|absolutely|awesome|great(?:\s+(?:question|choice))?|perfect|fantastic|wonderful|amazing|excellent|i\s+totally\s+understand|great\s+to\s+hear|good\s+question)\s*[!.,:]+\s*/i;

export function humanizeChatbotReply(
  text: string,
  options: { exclamationsAlreadyUsed: number },
): string {
  let output = text.trim();

  // Strip a forbidden opener once, then again in case two are stacked
  // ("That's great! Absolutely!").
  for (let i = 0; i < 2; i += 1) {
    const stripped = output.replace(FORBIDDEN_OPENERS, "");
    if (stripped === output) break;
    output = stripped.length ? stripped : output;
  }
  output = output.charAt(0).toUpperCase() + output.slice(1);

  // One exclamation mark per conversation, total. Every further one becomes
  // a full stop.
  let remaining = Math.max(0, 1 - options.exclamationsAlreadyUsed);
  output = output.replace(/!+/g, () => {
    if (remaining > 0) {
      remaining -= 1;
      return "!";
    }
    return ".";
  });

  return output.trim();
}

export function countExclamations(texts: readonly string[]): number {
  return texts.reduce((sum, t) => sum + (t.match(/!/g)?.length ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Calendar guard
// ---------------------------------------------------------------------------

const BOOK_NOW_LINK = /\[([^\]\n]+)\]\(\/book-now[^)\s]*\)/g;
// A /g regex is stateful under .test(); use this one for detection.
const HAS_BOOK_NOW_LINK = /\[[^\]\n]+\]\(\/book-now[^)\s]*\)/;

/**
 * Prose that promises a calendar or points off-page for one. Seven live
 * conversations got one of these instead of the inline calendar. Each is a
 * booking the visitor asked for and did not get.
 */
const CALENDAR_PROMISE =
  /\b(?:i'?ll|i\s+will|let\s+me|going\s+to|gonna|i\s+can)\s+(?:open|pull\s+up|bring\s+up|get)\s+(?:the|a|that)\s+calendar\b|\bone\s+moment\b|\bjust\s+a\s+moment\b|\bcan'?t\s+(?:show|open|send)\s+(?:you\s+)?(?:the\s+)?(?:\w+\s+)?(?:calendar|calendly)\b/i;

/** True when the reply should have opened the calendar and did not. */
export function needsCalendarGuard(text: string): boolean {
  return HAS_BOOK_NOW_LINK.test(text) || CALENDAR_PROMISE.test(text);
}

/**
 * Rewrites the reply for a calendar that is now actually open underneath it:
 * booking links become "right here", and promise sentences are removed.
 */
export function rewriteForOpenCalendar(text: string): string {
  let output = text.replace(BOOK_NOW_LINK, "right here in the chat");
  output = output
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !CALENDAR_PROMISE.test(sentence))
    .join(" ")
    .trim();
  if (!output) return "The calendar is right here in the chat, grab whichever time works for you.";
  return output;
}
