import type { PortalData, PortalLocalMarket } from "./types";

// DEMO DATA ONLY. Every person, place and quote below is a placeholder that
// exists so the page can be reviewed before SteelTrap is wired. None of it may
// ship to a real prospect. Tokens are prefixed `demo` so they can never
// collide with a real portal token.

const austin: PortalLocalMarket = {
  zip: "78704",
  city: "Austin",
  state: "TX",
  center: { lat: 30.2433, lng: -97.7694 },
  brief: [
    "South Austin mixes dense apartment communities, medical offices and a steady stream of new gyms, which are three of the location types members sign first.",
    "Most of what is around you is within a 15-minute drive, so a first route here can stay tight: fewer miles between restocks, more time pitching.",
  ],
  first90Days: [
    {
      label: "Days 1-30",
      detail:
        "Set up your business, shortlist 25 locations from the map, start pop-ins.",
    },
    {
      label: "Days 31-60",
      detail:
        "Sign your first location agreement and order your first machine with member pricing.",
    },
    {
      label: "Days 61-90",
      detail: "First machine live, restock rhythm set, pitching location two.",
    },
  ],
  locations: [
    {
      rank: 1,
      name: "Medical office building",
      type: "Healthcare",
      distanceMi: 1.2,
      lat: 30.251,
      lng: -97.761,
      trafficScore: 88,
    },
    {
      rank: 2,
      name: "Apartment community, 300+ units",
      type: "Apartments",
      distanceMi: 0.8,
      lat: 30.236,
      lng: -97.778,
      trafficScore: 84,
    },
    {
      rank: 3,
      name: "24-hour gym",
      type: "Gym",
      distanceMi: 2.1,
      lat: 30.229,
      lng: -97.756,
      trafficScore: 79,
    },
    {
      rank: 4,
      name: "Office park, 4 tenants",
      type: "Office",
      distanceMi: 2.6,
      lat: 30.258,
      lng: -97.785,
      trafficScore: 74,
    },
    {
      rank: 5,
      name: "Auto dealership service center",
      type: "Auto",
      distanceMi: 3.4,
      lat: 30.221,
      lng: -97.79,
      trafficScore: 68,
    },
  ],
};

const rep = { name: "Jordan Ellis", title: "Vending Advisor", photoUrl: null };

function inDays(days: number, hourUtc: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

const base: PortalData = {
  token: "demo",
  stage: "pre_call",
  prospect: {
    firstName: "Sarah",
    lastName: "Mitchell",
    occupation: "High school teacher",
    zip: "78704",
    goal: "Replace my teaching income within two years",
  },
  call: {
    scheduledAt: inDays(1, 20),
    confirmed: false,
    confirmUrl: null,
    rescheduleUrl: "/contact",
    rep,
  },
  localMarket: austin,
  callSummary: null,
  onboarding: null,
  followUpUrl: "/contact",
};

export const PORTAL_FIXTURES: Record<string, PortalData> = {
  demo: base,

  // PRD §3: name only must still render a full page.
  "demo-sparse": {
    ...base,
    token: "demo-sparse",
    prospect: { firstName: "Chris" },
    call: { scheduledAt: null, confirmed: false, rep },
    localMarket: null,
  },

  "demo-post": {
    ...base,
    token: "demo-post",
    stage: "post_call",
    call: { ...base.call!, scheduledAt: inDays(-1, 20), confirmed: true },
    callSummary: {
      publishedAt: inDays(-1, 22),
      recordingUrl: "https://app.avoma.com/",
      mainQuestionId: "financing",
      discussed: [
        "How a first route usually fits around a full-time teaching schedule (restocks on weekends and after school).",
        "What the South Austin map shows: healthcare and apartment communities ranked highest near you.",
        "The program tiers and what onboarding looks like in the first two weeks.",
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
        "Start with one healthcare or apartment location from your map rather than spreading across types.",
        "Watch the financing video below before we talk again so the numbers are fresh.",
      ],
      highlights: [
        {
          timestamp: "12:40",
          quote:
            "Your first location does not need to be perfect. It needs to be signed.",
          why: "The point Jordan made about not over-researching before your first pop-in.",
        },
        {
          timestamp: "27:15",
          quote:
            "Weekends and one weekday evening is how most teachers in the program run it.",
          why: "Your question about time commitment.",
        },
      ],
    },
  },

  "demo-won": {
    ...base,
    token: "demo-won",
    stage: "won",
    onboarding: {
      skoolInviteUrl: "https://www.skool.com/",
      walkthroughUrl: "https://vendhubhq.com/walkthrough",
      locationSearchUrl: "https://vendhubhq.com/",
      coachingCalendarUrl: "/contact",
      machineSourcingUrl: null,
      completed: ["skool"],
    },
  },

  "demo-lost": {
    ...base,
    token: "demo-lost",
    stage: "lost",
    call: null,
  },
};
