// Copy for /portal/[token] (Client Journey Portal). New copy, not marketing's:
// it needs Jess's pass before a real prospect sees it. Step titles live in
// the journey definition (src/lib/portal/journey.ts), not here.

import type { PortalStage } from "@/lib/portal/types";
import { WINS_WALL_URL } from "@/lib/portal/wins";

export const portalMeta = {
  title: "Your Vendingpreneurs plan",
} as const;

type HeroInput = {
  repFirstName: string | null;
  daysUntilCall: number | null;
  callDay: string | null;
};

function inDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * Hero copy per stage. The headline is split around the prospect's name so
 * the page can highlight it: `${before}${name}${after}`.
 */
export function portalHero(
  stage: PortalStage,
  { repFirstName, daysUntilCall, callDay }: HeroInput,
): { eyebrow: string; before: string; after: string; body: string } {
  const withRep = repFirstName ? ` with ${repFirstName}` : "";
  switch (stage) {
    case "pre_call":
      return {
        eyebrow:
          daysUntilCall != null
            ? `Your call${withRep} is ${inDays(daysUntilCall)}`
            : `Your call${withRep} is booked`,
        before: "We built this for you, ",
        after: ".",
        body: callDay
          ? `People who started where you are, what's around you, and what to bring. A few minutes before ${callDay} is all it takes.`
          : "People who started where you are, what's around you, and what to bring to the call.",
      };
    case "post_call":
      return {
        eyebrow: `After your call${withRep}`,
        before: "Here's where we landed, ",
        after: ".",
        body: "What we covered, the answers to your questions, and exactly what comes next.",
      };
    case "won":
      return {
        eyebrow: "You're in",
        before: "Welcome to the community, ",
        after: ".",
        body: "Work down your checklist and you'll be set up and searching for locations this week.",
      };
    case "lost":
      return {
        eyebrow: "Your resources",
        before: "This page stays yours, ",
        after: ".",
        body: "Everything we put together for you is still here, and it keeps updating as members post new wins.",
      };
  }
}

export const portalCopy = {
  goalLead: "Your goal",
  stepsHeading: "Your next steps",
  weekLabel: "Your week",
  callDay: "Call",
  joinDay: "Day 1",
  today: "Today",
  autoDone: "Completes on its own",
  allDone: "You're all set.",
  mobileNext: "Next:",
  mobileAll: "All steps",
  askHeading: (rep: string | null) =>
    rep ? `Questions? Ask ${rep}.` : "Questions? Ask us.",
  askBody: "Anything at all. You'll get the answer here and by email.",
  askPlaceholder: "e.g. Can I run this around a 9-to-5?",
  askSubmit: "Send question",
  mapCaption:
    "Real places near you, nearest first. Healthcare, offices, gyms and apartments are the location types members pitch first. Nothing here is a signed spot.",
  storyNote: (name: string) =>
    `${name}'s own numbers, in their words. Results depend on locations, machines and the work behind them.`,
  readStory: "Read the full story",
  winsWall: {
    label: "See every win on the community wall",
    href: WINS_WALL_URL,
  },
  verifyBody: (hint: string | null | undefined) =>
    `Your call notes are private. We'll send a 6-digit code to ${hint ?? "the email you booked with"} to unlock them.`,
  verifyDemoHint: "Demo page: any 6 digits work.",
  replay: "Re-listen to your call",
  followUpCta: "Book my follow-up",
  rebookCta: "Book a call",
  confirmCta: "Confirm my call",
  addToCalendar: "Add to calendar",
  reschedule: "Need a different time?",
  joinCall: "Join the call",
} as const;

/** Section eyebrows, titles and intros. */
export const portalSections = {
  intake: {
    title: "Three quick questions so we can tailor this page",
    body: "Takes 20 seconds. Your ZIP turns on your local map; your job and goal pick the stories and videos.",
  },
  local: {
    eyebrow: (zip: string) => `Your local opportunity · ${zip}`,
    title: (city: string) => `What a route near ${city} could look like`,
    emptyTitle: "Every metro has a route in it",
    emptyBody:
      "Members run routes in big cities, suburbs and small towns. Add your ZIP code above and this turns into a live map of places near you.",
    metros: [
      "Dallas",
      "Atlanta",
      "Phoenix",
      "Charlotte",
      "Denver",
      "Tampa",
      "Columbus",
      "Seattle",
    ],
  },
  people: { eyebrow: (label: string) => `People like you · ${label}` },
  wins: {
    eyebrow: "Community wins",
    byStage: {
      pre_call: {
        title: "First machines and new locations",
        intro: "Posted by members in the community, newest first.",
      },
      post_call: {
        title: "Where members go from there",
        intro:
          "Revenue milestones and scale-ups, posted by members, newest first.",
      },
      won: {
        title: "What the people you just joined are doing",
        intro:
          "Revenue milestones and scale-ups, posted by members, newest first.",
      },
      lost: {
        title: "New wins from the community",
        intro: "This keeps updating as members post. Newest first.",
      },
    } satisfies Record<PortalStage, { title: string; intro: string }>,
  },
  faq: {
    eyebrow: "What to expect",
    title: "The questions everyone asks first",
    intro:
      "Short answers from Mike. Watch the one we picked for you; the rest are here if you want them.",
    prepTitle: "Bring these to the call",
    prepItems: [
      "The city or area where you'd want to place machines.",
      "Any location, machine or financing questions you already have.",
      "Your budget and the timeline you'd like to work toward.",
      "Why you want income you own. It's your north star through the program.",
    ],
  },
  summary: {
    eyebrow: "Your call summary",
    title: "What we covered together",
    intro: (rep: string | null) =>
      rep
        ? `Written up from your call with ${rep}. The important parts are highlighted.`
        : "The important parts are highlighted.",
    lockedTitle: "Unlock your call notes",
    mainQuestion: "The video that answers your main question",
    followUpTitle: "Ready for the next conversation?",
    followUpBody: (rep: string | null) =>
      `Pick a time that works${rep ? ` with ${rep}` : ""}. Bring the three spots you liked on your map.`,
  },
  onboarding: {
    eyebrow: "Your onboarding plan",
    title: "Four steps to your first location search",
    detail: {
      skool:
        "Your home base: calls, trainings, and every member who has done this before you.",
      walkthrough:
        "Ten minutes in VendHub so your tools are set up before your first coaching call.",
      "location-search":
        "Open the map, shortlist your first 25 spots, and bring them to coaching.",
      coaching: "Pick a time that works. Bring your shortlist.",
    } as Record<string, string>,
    start: "Start",
    done: "Done",
  },
  resources: {
    eyebrow: "Collateral and resources",
    title: "Keep these handy",
    byStage: {
      pre_call: [
        {
          label: "All pre-call videos",
          detail: "The six answers plus seven operator stories.",
          href: "/pre-call-resources",
        },
        {
          label: "Member success stories",
          detail: "Filter by who they were before they started.",
          href: "/case-studies",
        },
        {
          label: "Community wins wall",
          detail: "Every win, as members posted it.",
          href: WINS_WALL_URL,
        },
      ],
      post_call: [
        {
          label: "All pre-call videos",
          detail: "Rewatch any answer from the call.",
          href: "/pre-call-resources",
        },
        {
          label: "Member success stories",
          detail: "More people who started where you are.",
          href: "/case-studies",
        },
        {
          label: "Community wins wall",
          detail: "Every win, as members posted it.",
          href: WINS_WALL_URL,
        },
      ],
      won: [
        {
          label: "VendHub walkthrough",
          detail: "Your tools, step by step.",
          href: "https://vendhubhq.com/walkthrough",
        },
        {
          label: "Member success stories",
          detail: "How others ran their first 90 days.",
          href: "/case-studies",
        },
        {
          label: "Community wins wall",
          detail: "Post yours here when it happens.",
          href: WINS_WALL_URL,
        },
      ],
      lost: [
        {
          label: "All pre-call videos",
          detail: "Costs, financing, locations and earnings.",
          href: "/pre-call-resources",
        },
        {
          label: "Member success stories",
          detail: "Filter by who they were before they started.",
          href: "/case-studies",
        },
        {
          label: "Community wins wall",
          detail: "Every win, as members posted it.",
          href: WINS_WALL_URL,
        },
      ],
    } satisfies Record<
      PortalStage,
      Array<{ label: string; detail: string; href: string }>
    >,
  },
  locked: {
    summary: {
      title: "Your call summary",
      note: "Unlocks after your call: what we covered, your questions answered, and a replay.",
    },
    onboarding: {
      title: "Your onboarding plan",
      note: "Unlocks when you join: community invite, VendHub walkthrough, and your first coaching call.",
    },
  },
} as const;
