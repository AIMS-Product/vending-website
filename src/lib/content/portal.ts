// Copy for /portal/[token] (Client Journey Portal). New copy, not marketing's:
// needs Jess's pass before a real prospect sees it.
import type { PortalStage } from "@/lib/portal/types";
import { WINS_WALL_URL } from "@/lib/portal/wins";

export const PORTAL_STAGE_LABEL: Record<PortalStage, string> = {
  pre_call: "Before your call",
  post_call: "After your call",
  won: "Getting started",
  lost: "Your resources",
};

export const PORTAL_HERO_SUBLINE: Record<PortalStage, string> = {
  pre_call:
    "Everything here was picked for you: people who started where you are, what is around you, and what to bring to the call.",
  post_call:
    "Here is what we covered, the answers to your questions, and exactly what comes next.",
  won: "Welcome in. Work down the checklist and you will be set up and searching for locations this week.",
  lost: "Everything we put together for you stays right here, and it keeps updating as members post new wins.",
};

export const PORTAL_LOCKED = {
  summaryPending: {
    title: "Your call summary",
    note: "Your summary is being written up. Check back shortly.",
  },
  summary: {
    title: "Your call summary",
    note: "Unlocks after your call: what we covered, your questions answered, and a replay.",
  },
  onboarding: {
    title: "Your onboarding plan",
    note: "Unlocks when you join: community invite, VendHub walkthrough, and your first coaching call.",
  },
} as const;

export const PORTAL_WINS_COPY: Record<
  PortalStage,
  { title: string; intro: string }
> = {
  pre_call: {
    title: "First machines and new locations this month",
    intro: "Posted by members in the community, newest first.",
  },
  post_call: {
    title: "Where members go from there",
    intro: "Revenue milestones and scale-ups, posted by members, newest first.",
  },
  won: {
    title: "What the people you just joined are doing",
    intro: "Revenue milestones and scale-ups, posted by members, newest first.",
  },
  lost: {
    title: "New wins from the community",
    intro: "This keeps updating as members post. Newest first.",
  },
};

export const PORTAL_ONBOARDING_DETAIL: Record<string, string> = {
  skool:
    "Your home base: calls, trainings, and every member who has done this before you.",
  walkthrough:
    "Ten minutes in VendHub so your tools are set up before your first coaching call.",
  "location-search":
    "Open the map, shortlist your first 25 spots, and bring them to coaching.",
  coaching: "Pick a time that works. Bring your shortlist.",
};

export const PORTAL_RESOURCES: Record<
  PortalStage,
  Array<{ label: string; detail: string; href: string }>
> = {
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
      detail: "See how others ran their first 90 days.",
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
};
