import "server-only";

import { safeTimeZone, upcomingDays } from "@/lib/chatbot/availability";

/**
 * Checks every availability claim in a reply against the real open slots
 * before the visitor sees it. The model is never the source of truth for a
 * day or a time: on 2026-09-11 it told a visitor five days running were full
 * while the calendar had them open, and called Tuesday the 15th "Monday".
 *
 * Three rules, each rewriting only the sentence that broke it:
 * 1. A "full / booked / no openings" sentence becomes that day's real open
 *    times, or the nearest ones. Mia only ever says what IS open.
 * 2. A weekday named next to a date ("Monday the 15th") gets the real one.
 * 3. A clock time must be a real open slot on the day the sentence names (or
 *    on any day, when none is named); otherwise the sentence becomes the real
 *    times.
 * Sentences confirming a booking are left alone: a booked slot is no longer
 * open, and "you're set for 10:00" must survive.
 */

const WEEKDAY =
  /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
// Full names or exact abbreviations only, so "decided 2" or "market 5" is
// never read as a date.
const MONTH =
  "(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
const MONTH_DAY = new RegExp(
  `\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
  "i",
);
const ORDINAL = /\b(\d{1,2})(?:st|nd|rd|th)\b/i;
const CLOCK_TIME =
  /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b\.?|\b(\d{1,2}):(\d{2})\b/gi;
/** Non-global twin of CLOCK_TIME for .test(), which is stateful on /g. */
const HAS_CLOCK_TIME = new RegExp(CLOCK_TIME.source, "i");

const NEGATIVE_CLAIM =
  /\b(?:fully\s+booked|booked\s+(?:up|solid)|(?:is|are|also|all|looks|be)\s+(?:all\s+)?full\b|no\s+(?:open\s+|available\s+|more\s+|\d{1,2}(?::\d{2})?\s*(?:[ap]m\s+)?)?(?:slots?|times?|openings?|availability|spots?)\b|not\s+(?:any\s+)?(?:available|open)\b|unavailable|nothing\s+(?:is\s+)?(?:open|available)|(?:isn'?t|aren'?t|wasn'?t)\s+(?:any(?:thing)?\s+)?(?:open|available)|there\s+(?:aren'?t|are\s+no)\s+any\b|don'?t\s+(?:see|have)\s+any\s+(?:open|slots?|times?|openings?))/i;

/** A sentence is only about scheduling when it names a day or a slot. */
const SCHEDULING_CONTEXT = new RegExp(
  `\\b(?:today|tomorrow|tonight|morning|afternoon|evening|week|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday|slots?|openings?|calendar|booked|spots?|\\d{1,2}(?:st|nd|rd|th)|${MONTH}\\.?\\s+\\d{1,2})\\b`,
  "i",
);
const CONDITIONAL = /\b(?:if|in\s+case|whether)\b/i;
const BOOKED_CONTEXT =
  /\b(?:you'?re\s+(?:all\s+)?set|you'?re\s+booked|you\s+booked|booked\s+(?:in|for)|confirmed|see\s+you|your\s+call\s+(?:is|on))\b/i;

type Day = { iso: string; weekday: string; label: string; dom: number };
type Input = { slots: readonly string[]; timeZone: string; now: Date };

/** Cheap pre-check, so a turn only fetches slots when a rule could fire. */
export function mentionsAvailability(text: string): boolean {
  return (
    NEGATIVE_CLAIM.test(text) ||
    HAS_CLOCK_TIME.test(text) ||
    (WEEKDAY.test(text) && (MONTH_DAY.test(text) || ORDINAL.test(text)))
  );
}

export function checkAvailabilityClaims(text: string, input: Input): string {
  const tz = safeTimeZone(input.timeZone);
  const days = windowDays(tz, input.now);
  const open = openMinutesByDay(input.slots, tz);
  let saidAvailability = false;

  const fixSentence = (sentence: string): string => {
    if (BOOKED_CONTEXT.test(sentence)) return sentence;
    const fixed = fixWeekday(sentence, days);
    if (!SCHEDULING_CONTEXT.test(fixed) && !HAS_CLOCK_TIME.test(fixed)) {
      return fixed;
    }
    const day = resolveDay(fixed, days);

    if (NEGATIVE_CLAIM.test(fixed) && !CONDITIONAL.test(fixed)) {
      if (saidAvailability) return "";
      saidAvailability = true;
      return (day && dayLine(day, open)) ?? nearestLine(days, open);
    }

    const times = namedTimes(fixed);
    if (times.length > 0 && SCHEDULING_CONTEXT.test(fixed)) {
      const allOpen = times.every((candidates) => isOpen(candidates, day, open));
      if (!allOpen) {
        if (saidAvailability) return "";
        saidAvailability = true;
        return (day && dayLine(day, open)) ?? nearestLine(days, open);
      }
    }
    return fixed;
  };

  return text
    .split("\n")
    .map((paragraph) =>
      paragraph
        .split(/(?<=[.!?])\s+/)
        .map(fixSentence)
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function windowDays(tz: string, now: Date): Day[] {
  const long = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  });
  return upcomingDays(tz, now).map((day) => ({
    ...day,
    weekday: long.format(new Date(`${day.iso}T12:00:00Z`)),
    dom: Number(day.iso.slice(8)),
  }));
}

function openMinutesByDay(
  slots: readonly string[],
  tz: string,
): Map<string, number[]> {
  const isoDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const byDay = new Map<string, number[]>();
  for (const iso of slots) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    const [hour, minute] = clock.format(date).split(":").map(Number);
    const key = isoDay.format(date);
    byDay.set(key, [...(byDay.get(key) ?? []), (hour % 24) * 60 + minute]);
  }
  return byDay;
}

function fixWeekday(sentence: string, days: Day[]): string {
  const named = sentence.match(WEEKDAY)?.[1];
  const dom = Number((sentence.match(MONTH_DAY) ?? sentence.match(ORDINAL))?.[1]);
  if (!named || !dom) return sentence;
  const day = days.find((d) => d.dom === dom);
  if (!day || day.weekday.toLowerCase() === named.toLowerCase()) return sentence;
  const replacement =
    named[0] === named[0].toUpperCase() ? day.weekday : day.weekday.toLowerCase();
  return sentence.replace(WEEKDAY, replacement);
}

function resolveDay(sentence: string, days: Day[]): Day | null {
  if (/\btoday\b/i.test(sentence)) return days[0];
  if (/\btomorrow\b/i.test(sentence)) return days[1];
  const dom = Number((sentence.match(MONTH_DAY) ?? sentence.match(ORDINAL))?.[1]);
  if (dom) {
    const byDate = days.find((d) => d.dom === dom);
    if (byDate) return byDate;
  }
  const named = sentence.match(WEEKDAY)?.[1]?.toLowerCase();
  return named ? (days.find((d) => d.weekday.toLowerCase() === named) ?? null) : null;
}

/** Each named time as its possible minutes-of-day (a bare "10:30" may be am or pm). */
function namedTimes(sentence: string): number[][] {
  const times: number[][] = [];
  for (const match of sentence.matchAll(CLOCK_TIME)) {
    if (match[3]) {
      const hour = Number(match[1]);
      if (hour < 1 || hour > 12) continue;
      const minute = Number(match[2] ?? 0);
      const pm = match[3].toLowerCase() === "p";
      times.push([((hour % 12) + (pm ? 12 : 0)) * 60 + minute]);
    } else {
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      if (hour > 23 || minute > 59) continue;
      times.push(
        hour < 12
          ? [hour * 60 + minute, (hour + 12) * 60 + minute]
          : [hour * 60 + minute],
      );
    }
  }
  return times;
}

function isOpen(
  candidates: number[],
  day: Day | null,
  open: Map<string, number[]>,
): boolean {
  const pools = day ? [open.get(day.iso) ?? []] : [...open.values()];
  return pools.some((minutes) => candidates.some((c) => minutes.includes(c)));
}

function dayLine(day: Day, open: Map<string, number[]>): string | null {
  const minutes = open.get(day.iso);
  if (!minutes?.length) return null;
  const times = minutes.slice(0, 3).map(clockLabel);
  return `${fullLabel(day)} has ${joinOr(times)} open. ${times.length > 1 ? "Would one of those work?" : "Would that work?"}`;
}

function nearestLine(days: Day[], open: Map<string, number[]>): string {
  for (const day of days) {
    const minutes = open.get(day.iso);
    if (!minutes?.length) continue;
    const times = minutes.slice(0, 2).map(clockLabel);
    return `The closest open times are ${fullLabel(day)} at ${joinOr(times)}. ${times.length > 1 ? "Would one of those work?" : "Would that work?"}`;
  }
  return "The team can fit around you: would a callback today or tomorrow work, or a text from a teammate to lock in a time?";
}

function fullLabel(day: Day): string {
  return `${day.weekday}, ${day.label.slice(5)}`;
}

function clockLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "am" : "pm"}`;
}

function joinOr(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}
