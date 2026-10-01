import type { PortalData, PortalLocalMarket } from "./types";

// DEMO DATA ONLY. The prospect, rep, call summary and brief are placeholders
// so the page can be reviewed before SteelTrap is wired. The six places are
// real (OpenStreetMap, looked up 2026-10-01) but their order is just nearest
// first, not a VendScout ranking. Tokens start with `demo` so they never
// collide with a real portal token.

const austin: PortalLocalMarket = {
  zip: "78704",
  city: "Austin",
  state: "TX",
  center: { lat: 30.2433, lng: -97.7694 },
  brief: [
    "South Austin packs medical offices, clinics and apartment communities into a few square miles, and healthcare is one of the location types members sign first.",
    "Everything below is inside a 10-minute drive, so a first route here can stay tight: fewer miles between restocks, more time for pop-ins.",
  ],
  locations: [
    {
      rank: 1,
      name: "CommUnityCare South Austin Health Center",
      type: "Healthcare",
      distanceMi: 0.6,
      lat: 30.23949,
      lng: -97.7607,
    },
    {
      rank: 2,
      name: "HealthSouth Rehabilitation Hospital",
      type: "Healthcare",
      distanceMi: 1.2,
      lat: 30.22589,
      lng: -97.76636,
    },
    {
      rank: 3,
      name: "Texas Sleep Medicine",
      type: "Medical office",
      distanceMi: 1.3,
      lat: 30.22711,
      lng: -97.77895,
    },
    {
      rank: 4,
      name: "St. David's South Austin Medical Center",
      type: "Hospital",
      distanceMi: 1.3,
      lat: 30.22564,
      lng: -97.77527,
    },
    {
      rank: 5,
      name: "Victory Medical",
      type: "Medical office",
      distanceMi: 1.5,
      lat: 30.23228,
      lng: -97.79098,
    },
    {
      rank: 6,
      name: "South Austin Gym",
      type: "Gym",
      distanceMi: 2.6,
      lat: 30.2157,
      lng: -97.79992,
    },
  ],
};

const rep = { name: "Jordan Ellis", title: "Vending Advisor", photoUrl: null };

/** Fixture dates move with the clock so the calendar always looks current. */
function inDays(days: number, hourUtc: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

const base: PortalData = {
  token: "demo",
  stage: "pre_call",
  access: "link",
  prospect: {
    firstName: "Sarah",
    lastName: "Mitchell",
    occupation: "High school teacher",
    zip: "78704",
    goal: "Replace my teaching income within two years",
    emailHint: "s•••@gmail.com",
  },
  call: {
    scheduledAt: inDays(3, 20),
    confirmUrl: null,
    rescheduleUrl: "/contact",
    joinUrl: null,
    rep,
  },
  localMarket: austin,
  callSummary: null,
  onboarding: null,
  followUpUrl: "/contact",
  journey: null,
  completedSteps: [],
};

const summary: NonNullable<PortalData["callSummary"]> = {
  publishedAt: inDays(-1, 22),
  recordingUrl: "https://app.avoma.com/",
  mainQuestionId: "financing",
  discussed: [
    "How a first route usually fits around a full-time teaching schedule: restocks on weekends and after school.",
    "What your South Austin map shows: healthcare and apartment communities closest to you.",
    "The program tiers and what the first two weeks of onboarding look like.",
  ],
  yourQuestions: [
    {
      question: "Can I start without quitting my job?",
      answer:
        "Yes. Most members start part-time. The plan we sketched assumes about 5-8 hours a week until location two.",
    },
    {
      question: "Do I need perfect credit to finance a machine?",
      answer:
        "No. There are lending partners with options that can include little to nothing down; your credit profile decides which ones are open to you.",
    },
  ],
  recommended: [
    "Start with one healthcare location from your map rather than spreading across types.",
    "Watch the financing answer before we talk again so the numbers are fresh.",
  ],
  highlights: [
    {
      timestamp: "12:40",
      quote:
        "Your first location does not need to be perfect. It needs to be signed.",
      why: "Jordan's point about not over-researching before your first pop-in.",
    },
  ],
};

const post: PortalData = {
  ...base,
  token: "demo-post",
  stage: "post_call",
  call: { ...base.call!, scheduledAt: inDays(-1, 20) },
};

export const PORTAL_FIXTURES: Record<string, PortalData> = {
  demo: base,

  // Name only: the page must still be complete.
  "demo-sparse": {
    ...base,
    token: "demo-sparse",
    prospect: { firstName: "Chris", emailHint: "c•••@yahoo.com" },
    call: { scheduledAt: null, rep },
    localMarket: null,
  },

  // Link access: the server sends NO summary until the email is verified.
  "demo-post": post,

  "demo-won": {
    ...base,
    token: "demo-won",
    stage: "won",
    access: "verified",
    joinedAt: inDays(-1, 18),
    onboarding: {
      skoolInviteUrl: "https://www.skool.com/",
      walkthroughUrl: "https://vendhubhq.com/walkthrough",
      locationSearchUrl: "https://vendhubhq.com/",
      coachingCalendarUrl: "/contact",
    },
    completedSteps: ["skool"],
  },

  "demo-lost": { ...base, token: "demo-lost", stage: "lost", call: null },
};

/** What the server would add once the bound email is verified (demo only). */
export const DEMO_VERIFIED_SUMMARY: Record<string, PortalData["callSummary"]> =
  {
    "demo-post": summary,
  };
