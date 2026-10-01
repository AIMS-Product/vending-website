// Journeys and scheduling. Pure functions, no I/O.
//
// DEFAULT_JOURNEYS are the stand-in for the arch doc's published
// `journey_definition` rows: marketing owns the real steps later, and
// SteelTrap sends them as `PortalData.journey`. Until then these defaults
// render. Titles may use {rep} and {story}; the page fills them.

import type {
  JourneyDefinition,
  JourneyStep,
  PortalData,
  PortalStage,
} from "./types";

export const PORTAL_TIME_ZONE = "America/Chicago";

export const DEFAULT_JOURNEYS: Record<PortalStage, JourneyDefinition> = {
  pre_call: {
    key: "vp-pre-call",
    version: 1,
    steps: [
      {
        key: "about-you",
        title: "Tell us a little about you",
        detail: "Three quick answers so this page fits you.",
        minutes: 1,
        dayOffset: -3,
        content: "intake",
        completedBy: "prospect",
      },
      {
        key: "confirm-call",
        title: "Confirm your call with {rep}",
        detail: "One click so we know you're coming.",
        minutes: 1,
        dayOffset: -3,
        content: "confirm_call",
        completedBy: "prospect",
      },
      {
        key: "watch-story",
        title: "Watch {story}'s story",
        detail: "Someone who started where you are.",
        minutes: 6,
        dayOffset: -2,
        content: "persona_story",
        completedBy: "prospect",
      },
      {
        key: "see-map",
        title: "See what's around you",
        detail: "Real places near you that members pitch first.",
        minutes: 4,
        dayOffset: -2,
        content: "local_map",
        completedBy: "prospect",
      },
      {
        key: "first-question",
        title: "Get the first question answered",
        detail: "A two-minute answer from Mike.",
        minutes: 3,
        dayOffset: -1,
        content: "objection_video",
        completedBy: "prospect",
      },
      {
        key: "community",
        title: "See what members posted this week",
        detail: "Real wins, in their words.",
        minutes: 3,
        dayOffset: -1,
        content: "wins",
        completedBy: "prospect",
      },
      {
        key: "prep",
        title: "Jot down your questions",
        detail: "Four things that make the call about you.",
        minutes: 5,
        dayOffset: 0,
        content: "call_prep",
        completedBy: "prospect",
      },
      {
        key: "call",
        title: "Your call with {rep}",
        dayOffset: 0,
        content: "call",
        completedBy: "system",
      },
    ],
  },
  post_call: {
    key: "vp-post-call",
    version: 1,
    steps: [
      {
        key: "verify",
        title: "Unlock your call notes",
        detail: "A quick email check keeps your notes private.",
        minutes: 1,
        dayOffset: 0,
        content: "verify_email",
        completedBy: "system",
      },
      {
        key: "summary",
        title: "Read your call summary",
        detail: "What we covered and what we recommended.",
        minutes: 4,
        dayOffset: 0,
        content: "call_summary",
        completedBy: "prospect",
      },
      {
        key: "main-question",
        title: "Watch the answer to your main question",
        minutes: 3,
        dayOffset: 1,
        content: "main_question",
        completedBy: "prospect",
      },
      {
        key: "pick-spots",
        title: "Pick three spots from your map",
        detail: "Bring them to your follow-up.",
        minutes: 10,
        dayOffset: 2,
        content: "local_map",
        completedBy: "prospect",
      },
      {
        key: "follow-up",
        title: "Book your follow-up with {rep}",
        minutes: 1,
        dayOffset: 3,
        content: "book_follow_up",
        completedBy: "prospect",
      },
    ],
  },
  won: {
    key: "vp-onboarding",
    version: 1,
    steps: [
      {
        key: "skool",
        title: "Accept your community invite",
        detail: "Calls, trainings, and every member who did this before you.",
        minutes: 2,
        dayOffset: 0,
        content: "link",
        href: "onboarding.skoolInviteUrl",
        completedBy: "prospect",
      },
      {
        key: "walkthrough",
        title: "Complete the VendHub walkthrough",
        detail: "Your tools, set up before coaching.",
        minutes: 10,
        dayOffset: 1,
        content: "link",
        href: "onboarding.walkthroughUrl",
        completedBy: "prospect",
      },
      {
        key: "location-search",
        title: "Shortlist 25 locations",
        detail: "Start on the map; bring the list to coaching.",
        minutes: 30,
        dayOffset: 2,
        content: "link",
        href: "onboarding.locationSearchUrl",
        completedBy: "prospect",
      },
      {
        key: "coaching",
        title: "Book your first coaching call",
        minutes: 2,
        dayOffset: 3,
        content: "link",
        href: "onboarding.coachingCalendarUrl",
        completedBy: "prospect",
      },
    ],
  },
  lost: {
    key: "vp-evergreen",
    version: 1,
    steps: [
      {
        key: "answers",
        title: "Rewatch the answers",
        detail: "Costs, financing, locations and earnings.",
        minutes: 10,
        dayOffset: 0,
        content: "objection_video",
        completedBy: "prospect",
      },
      {
        key: "community",
        title: "See what members posted lately",
        minutes: 3,
        dayOffset: 0,
        content: "wins",
        completedBy: "prospect",
      },
      {
        key: "rebook",
        title: "Talk to us again when you're ready",
        minutes: 1,
        dayOffset: 0,
        content: "book_follow_up",
        completedBy: "prospect",
      },
    ],
  },
};

/** The steps this prospect actually sees: drops steps whose job is already done by data. */
export function stepsFor(data: PortalData): JourneyStep[] {
  const steps = (data.journey ?? DEFAULT_JOURNEYS[data.stage]).steps;
  return steps.filter((step) => {
    if (step.content === "intake")
      return !data.prospect.occupation || !data.prospect.zip;
    if (step.content === "confirm_call") return Boolean(data.call);
    if (step.content === "call") return Boolean(data.call);
    return true;
  });
}

/** System steps complete from data, never from a click. */
export function isDone(
  step: JourneyStep,
  data: PortalData,
  ticked: ReadonlySet<string>,
): boolean {
  if (step.completedBy === "system") {
    if (step.content === "verify_email") return data.access === "verified";
    if (step.content === "call") return data.stage !== "pre_call";
    return data.completedSteps.includes(step.key);
  }
  return ticked.has(step.key);
}

/** YYYY-MM-DD of `date` in the portal time zone. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PORTAL_TIME_ZONE,
  }).format(date);
}

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type PlanDay = {
  key: string;
  isToday: boolean;
  isAnchor: boolean;
  stepKeys: string[];
};

/**
 * Lay steps on real days. Anchor = call day (pre/post call) or join day (won).
 * A step whose day already passed lands on today, so nothing is ever shown
 * as "due yesterday". No anchor = the first step starts today.
 */
export function schedule(
  steps: JourneyStep[],
  data: PortalData,
  now: Date,
): PlanDay[] {
  const today = dayKey(now);
  const anchorIso =
    data.stage === "won" ? data.joinedAt : data.call?.scheduledAt;
  const minOffset = Math.min(0, ...steps.map((s) => s.dayOffset));
  const anchor = anchorIso
    ? dayKey(new Date(anchorIso))
    : addDays(today, -minOffset);

  const byDay = new Map<string, string[]>();
  for (const step of steps) {
    const due = addDays(anchor, step.dayOffset);
    const key = due < today ? today : due;
    byDay.set(key, [...(byDay.get(key) ?? []), step.key]);
  }
  // Always show today and the anchor, even when nothing is due on them.
  for (const key of [today, anchor])
    if (key >= today && !byDay.has(key)) byDay.set(key, []);

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, stepKeys]) => ({
      key,
      isToday: key === today,
      isAnchor: key === anchor,
      stepKeys,
    }));
}

export function formatDay(key: string, style: "long" | "short"): string {
  const date = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat(
    "en-US",
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }
      : { weekday: "short", timeZone: "UTC" },
  ).format(date);
}

export function formatCallTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // ponytail: one zone for everyone; send a prospect time zone from SteelTrap when it matters.
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PORTAL_TIME_ZONE,
    timeZoneName: "short",
  }).format(date);
}

/** Whole days from today to the anchor day, in the portal zone. */
export function daysUntil(
  iso: string | null | undefined,
  now: Date,
): number | null {
  if (!iso) return null;
  const from = new Date(`${dayKey(now)}T12:00:00Z`).getTime();
  const to = new Date(`${dayKey(new Date(iso))}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}
