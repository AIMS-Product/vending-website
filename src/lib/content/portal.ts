// Copy for /portal/[token] (Client Journey Portal). New copy, not marketing's:
// it needs Jess's pass before a real prospect sees it. Step titles live in
// the journey definition (src/lib/portal/journey.ts), not here.

import type { PortalStage } from "@/lib/portal/types";
import { WINS_WALL_URL } from "@/lib/portal/wins";

export const portalMeta = {
  title: "Your Vendingpreneurs plan",
} as const;

type HeroInput = {
  firstName: string;
  repFirstName: string | null;
  daysUntilCall: number | null;
  callTime: string | null;
};

function inDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** The headline and the one line under it, per stage. Person first, plan second. */
export function portalHero(
  stage: PortalStage,
  input: HeroInput,
): { title: string; body: string } {
  const { firstName, repFirstName, daysUntilCall, callTime } = input;
  const withRep = repFirstName ? ` with ${repFirstName}` : "";
  switch (stage) {
    case "pre_call":
      return daysUntilCall != null && callTime
        ? {
            title: `${firstName}, your call${withRep} is ${inDays(daysUntilCall)}.`,
            body: `${callTime}. Here's a short plan to get the most out of it: a few minutes a day, one step at a time.`,
          }
        : {
            title: `${firstName}, your call${withRep} is booked.`,
            body: "Your confirmation email has the time. Here's a short plan to get the most out of it.",
          };
    case "post_call":
      return {
        title: `${firstName}, here's where we landed.`,
        body: `Everything from your call${withRep} is below, along with what to do next and when.`,
      };
    case "won":
      return {
        title: `Welcome in, ${firstName}.`,
        body: "Four steps this week get you set up and searching for your first location.",
      };
    case "lost":
      return {
        title: `${firstName}, this page stays yours.`,
        body: "Everything we put together for you is still here, and the community wins keep updating.",
      };
  }
}

export const portalCopy = {
  goalLead: "You told us",
  goalTail: "Everything below was picked with that in mind.",
  planHeading: "Your plan",
  calendarLabel: "Your days",
  anytimeLabel: "Whenever you're ready",
  callDay: "Call day",
  joinDay: "Day one",
  today: "Today",
  tomorrow: "Tomorrow",
  doneNext: "Done, next step",
  undo: "Mark not done",
  autoDone: "Completes on its own",
  allDone: "You're all set. See you on the call.",
  askHeading: (rep: string | null) =>
    rep ? `Questions? Ask ${rep}.` : "Questions? Ask us.",
  askBody: "Anything at all. You'll get the answer here and by email.",
  askPlaceholder: "e.g. Can I run this around a 9-to-5?",
  askSubmit: "Send question",
  prepItems: [
    "The city or area where you'd want to place machines.",
    "Any location, machine or financing questions you already have.",
    "Your budget and the timeline you'd like to work toward.",
    "Why you want income you own. It's your north star through the program.",
  ],
  mapCaption:
    "Real places near you, nearest first. Healthcare, offices, gyms and apartments are the location types members pitch first. Nothing here is a signed spot.",
  mapEmpty:
    "Add your ZIP code in the first step and this turns into a live map of places near you.",
  storyNote: (name: string) =>
    `${name}'s own numbers, in their words. Results depend on locations, machines and the work behind them.`,
  readStory: "Read the full story",
  winsWall: {
    label: "See every win on the community wall",
    href: WINS_WALL_URL,
  },
  winsEmpty: "The community feed is resting. See every win on the wall.",
  verifyBody: (hint: string | null | undefined) =>
    `Your call notes are private. We'll send a 6-digit code to ${hint ?? "the email you booked with"} to unlock them.`,
  verifyDemoHint: "Demo page: any 6 digits work.",
  summaryLocked: "Unlock your call notes in the step above first.",
  replay: "Re-listen to your call",
  followUpBody: (rep: string | null) =>
    `Pick a time that works${rep ? ` with ${rep}` : ""}. Bring the three spots you picked from your map.`,
  followUpCta: "Book my follow-up",
  rebookCta: "Book a call",
  confirmCta: "Confirm my call",
  addToCalendar: "Add to my calendar",
  reschedule: "Need a different time?",
  joinCall: "Join the call",
  callBody:
    "We'll walk through your area, your questions and your plan. No pressure, no script.",
  open: "Open",
} as const;
