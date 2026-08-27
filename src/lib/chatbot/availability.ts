import "server-only";

import {
  CHATBOT_CALENDARS,
  CHATBOT_CONSULTATION_EVENT_TYPE_URI,
  type ChatbotCalendar,
} from "@/lib/chatbot/booking";
import { config } from "@/lib/config";
import { createCalendlyApiClient } from "@/lib/services/calendly-api";

/**
 * Real open times for the consultation calendar, worded for the model.
 *
 * Until now Mia could only say "grab the first slot on there". Three visitors
 * in one week hit a calendar with no dates they could pick and the bot kept
 * inventing slots ("select the 10:00 AM on September 7"). This is the layer
 * that lets it say what is actually open, and say honestly when nothing is.
 */

export const AVAILABILITY_DAYS = 14;
/** Calendly caps event_type_available_times at 7 days per request. */
const WINDOW_DAYS = 7;
const CACHE_TTL_MS = 60_000;

// ponytail: one process-wide cache keyed by event type; per-instance on Fluid
// Compute, which is fine for a 60s TTL. Move to Redis if this ever fans out.
const cache = new Map<string, { at: number; slots: string[] }>();

export type AvailabilityInput = {
  timeZone: string;
  now?: Date;
  eventTypeUri?: string;
  fetchSlots?: (start: string, end: string) => Promise<string[]>;
};

export async function fetchChatbotAvailability(
  input: AvailabilityInput,
): Promise<string[]> {
  const eventTypeUri =
    input.eventTypeUri ?? CHATBOT_CONSULTATION_EVENT_TYPE_URI;
  const now = input.now ?? new Date();
  const cached = cache.get(eventTypeUri);
  if (cached && now.getTime() - cached.at < CACHE_TTL_MS) return cached.slots;

  const fetchSlots =
    input.fetchSlots ??
    (async (start: string, end: string) => {
      const client = createCalendlyApiClient({
        token: config.CALENDLY_API_TOKEN,
        maxRequests: 6,
      });
      return client.listAvailableTimes({
        eventTypeUri,
        startTime: start,
        endTime: end,
      });
    });

  const windows: Array<Promise<string[]>> = [];
  // Calendly rejects a start_time in the past; lead by a minute.
  let start = new Date(now.getTime() + 60_000);
  const horizon = new Date(now.getTime() + AVAILABILITY_DAYS * 86_400_000);
  while (start < horizon) {
    const end = new Date(
      Math.min(start.getTime() + WINDOW_DAYS * 86_400_000, horizon.getTime()),
    );
    windows.push(fetchSlots(start.toISOString(), end.toISOString()));
    start = end;
  }

  const slots = (await Promise.all(windows)).flat().sort();
  cache.set(eventTypeUri, { at: now.getTime(), slots });
  return slots;
}

/**
 * The first Lane 1 calendar with an open slot, and its slots. Primary first,
 * so the chat only moves to another calendar when the primary is empty.
 * Returns the primary with no slots when every calendar is empty (or
 * Calendly is unreachable), so callers always have a URL to render.
 */
export async function resolveBookingCalendar(
  input: Omit<AvailabilityInput, "eventTypeUri">,
): Promise<{ calendar: ChatbotCalendar; slots: string[] }> {
  for (const calendar of CHATBOT_CALENDARS) {
    try {
      const slots = await fetchChatbotAvailability({
        ...input,
        eventTypeUri: calendar.eventTypeUri,
      });
      if (slots.length > 0) return { calendar, slots };
    } catch (error) {
      console.warn("chatbot: availability lookup failed", {
        calendar: calendar.label,
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  return { calendar: CHATBOT_CALENDARS[0], slots: [] };
}

type DayBuckets = {
  label: string;
  morning: string[];
  afternoon: string[];
  evening: string[];
};

/**
 * Turns raw ISO start times into the sentence the model reads. Groups by the
 * VISITOR's day, buckets morning / afternoon / evening (so "after 6 so my
 * husband can join" has a real answer), and caps each bucket so the tool
 * result stays a few lines.
 */
export function describeAvailability(
  slots: readonly string[],
  timeZone: string,
  options: { perBucket?: number; maxDays?: number; day?: string | null } = {},
): string {
  const perBucket = options.perBucket ?? 4;
  const maxDays = options.maxDays ?? 7;
  const tz = safeTimeZone(timeZone);

  // A specific day: every slot on it, uncapped, so "can we do 2pm on the
  // 31st?" is answered from the full list. The capped summary below once made
  // the model deny a 2:00pm that existed because only 12:00-12:30 were shown.
  if (options.day) {
    return describeDay(slots, tz, options.day);
  }

  if (slots.length === 0) {
    return `The online calendar has no slot to show right now. NEVER tell the visitor there is no availability, that the team is booked up, or that nothing is open; that ends the conversation. Instead present two concrete choices as the team fitting around them: (1) a callback today or tomorrow, asking which works better for them, morning, afternoon or evening, and the best number to text; (2) a teammate texting them within the hour to lock a time in. Whichever they pick, call flag_for_team with their number and window. Never invent a clock time.`;
  }

  const dayFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const hourFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });

  const days = new Map<string, DayBuckets>();
  for (const iso of slots) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    const label = dayFormat.format(date);
    const hour = Number(hourFormat.format(date).replace(/\D/g, ""));
    const bucket: keyof Omit<DayBuckets, "label"> =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const day = days.get(label) ?? {
      label,
      morning: [],
      afternoon: [],
      evening: [],
    };
    if (day[bucket].length < perBucket) {
      day[bucket] = [...day[bucket], timeFormat.format(date).toLowerCase()];
    }
    days.set(label, day);
  }

  const lines = [...days.values()].slice(0, maxDays).map((day) => {
    const parts = [
      day.morning.length ? `morning ${day.morning.join(", ")}` : null,
      day.afternoon.length ? `afternoon ${day.afternoon.join(", ")}` : null,
      day.evening.length ? `evening ${day.evening.join(", ")}` : null,
    ].filter(Boolean);
    return `${day.label}: ${parts.join(" | ")}`;
  });

  const first = new Date(slots[0]);
  const tzLabel = tz.replace(/_/g, " ");
  return [
    `Open times on the team's calendar, shown in the visitor's time zone (${tzLabel}). Only ever name a time from this list.`,
    `IMPORTANT: this is a SUMMARY. Each part of the day shows only its first ${perBucket} times; more are usually open. Never tell a visitor a specific time is unavailable from this summary. When they ask about a particular day or time, call get_available_times again with that day (YYYY-MM-DD) to get every open slot before answering.`,
    ...lines,
    `Earliest: ${dayFormat.format(first)} at ${timeFormat.format(first).toLowerCase()}.`,
    days.size > maxDays
      ? `More days are open after these; the calendar in the chat shows them all.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function describeDay(
  slots: readonly string[],
  tz: string,
  day: string,
): string {
  const isoDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const times = slots
    .map((iso) => new Date(iso))
    .filter((d) => !Number.isNaN(d.getTime()) && isoDay.format(d) === day)
    .map((d) => timeFormat.format(d).toLowerCase());
  const tzLabel = tz.replace(/_/g, " ");
  if (times.length === 0) {
    return `No open times on ${day} (${tzLabel}). Do not offer a time on that day. Offer the nearest open day from the summary instead, or a callback via flag_for_team.`;
  }
  return `Every open time on ${day}, in the visitor's time zone (${tzLabel}): ${times.join(", ")}. This list is complete for that day: a time on it is bookable, a time not on it is not.`;
}

export function safeTimeZone(value: string | null | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "America/New_York";
  }
}
