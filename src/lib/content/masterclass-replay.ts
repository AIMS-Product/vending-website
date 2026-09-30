import { chicagoHour } from "@/lib/content/masterclass";

// Copy and wiring for the four webinar replay pages, rebuilt from the GHL
// funnel "How to Build a Smart Vending Business in 2026"
// (webinar.vendingpreneurs.com/masterclass-replay-{dna,adnb,meta,advisory-team-798452}).
// Copy is verbatim from GHL (income claims are legal-approved): shorten by
// omission only. The two GHL emoji (the down arrow on DNA, the warning sign on
// the advisory page) are omitted.

export type ReplayVariantKey = "dna" | "adnb" | "meta" | "advisory";

export type ReplayVideo =
  | { kind: "vidalytics"; embedId: string }
  | { kind: "youtube"; id: string };

export const REPLAY_PATHS: Record<ReplayVariantKey, `/${string}`> = {
  dna: "/masterclass-replay-dna",
  adnb: "/masterclass-replay-adnb",
  meta: "/masterclass-replay-meta",
  advisory: "/masterclass-replay-advisory",
};

/**
 * GHL hand-edits a fixed countdown weekly. The observed rule: the replay
 * expires the Sunday BEFORE the next webinar at 23:00 America/Chicago (Oct 4
 * 23:00 CT for the Oct 6 room). Derived here from the next event start, which
 * masterclass-event.ts reads from the GHL "Webinar Date n Time" value.
 * Returns null when there is no usable start, so the page hides the countdown
 * rather than showing a wrong one.
 */
export function replayExpiry(startsAt: string | null): string | null {
  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    })
      .formatToParts(start)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  // Strictly before the event day: a Sunday event expires the prior Sunday.
  const back = weekday === 0 ? 7 : weekday;
  const sunday = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) - back,
    ),
  );
  for (const offsetHours of [5, 6]) {
    const candidate = new Date(
      Date.UTC(
        sunday.getUTCFullYear(),
        sunday.getUTCMonth(),
        sunday.getUTCDate(),
        23 + offsetHours,
      ),
    );
    if (chicagoHour(candidate) === 23) return candidate.toISOString();
  }
  return null;
}

/** The GHL "Lead Scoring -> Book a Call" form, embedded as-is on DNA and Meta. */
export const REPLAY_GHL_FORM_ID = "0vrICJhXXOmSC9aGHj3P";
export const REPLAY_GHL_FORM_SRC = `https://api.leadconnectorhq.com/widget/form/${REPLAY_GHL_FORM_ID}`;
export const REPLAY_GHL_FORM_SCRIPT =
  "https://link.msgsndr.com/js/form_embed.js";

/** Every GHL "Lead Scoring -> Book a Call" score band redirects to this page. */
export const REPLAY_L1_BOOKING_CALENDLY =
  "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";

/** The Calendly GHL embeds inline on the ADNB page (the site's /start calendar). */
export const REPLAY_ADVISORY_CALENDLY =
  "https://calendly.com/d/cxwj-zxk-2z4/vending-route-advisory-call";

/** The main replay, a Vidalytics embed on every GHL replay page. */
export const REPLAY_MAIN_VIDEO: ReplayVideo = {
  kind: "vidalytics",
  embedId: "cARihXjwCxR3xiJ0",
};

export const REPLAY_ANCHORS = {
  video: "replay",
  cta: "book-call",
} as const;

export type ReplayCta =
  | { kind: "ghl-form" }
  | { kind: "calendly"; calendlyUrl: string };

export type ReplayVariant = {
  key: ReplayVariantKey;
  path: `/${string}`;
  metaTitle: string;
  heading: string;
  mainVideo: ReplayVideo;
  /** Lines under the heading. */
  sub: readonly string[];
  /** Numbered steps shown under the video (DNA only). */
  steps: readonly string[];
  /** Replay-hero button: scrolls to the anchor named by `target`. */
  hero: { label: string; target: "video" | "cta" } | null;
  /** Booking section; null on the advisory page, which has none on GHL. */
  cta: {
    heading: string;
    paragraphs: readonly string[];
    action: ReplayCta;
  } | null;
  /** Repeat button after the testimonials. */
  closing: { label: string; subLabel?: string; target: "video" | "cta" } | null;
  testimonialVideos: readonly ReplayVideo[];
};

const youtube = (id: string): ReplayVideo => ({ kind: "youtube", id });
const vidalytics = (embedId: string): ReplayVideo => ({
  kind: "vidalytics",
  embedId,
});

// Same five member videos as GHL, in the order of the five testimonials below.
const YOUTUBE_TESTIMONIAL_VIDEOS = [
  youtube("U7KKbZHqBvg"),
  youtube("yP4Y_BBAvq4"),
  youtube("heSbv_uG734"),
  youtube("gvvz2nMax0w"),
  youtube("io1Jkei-yFs"),
] as const;

const META_TESTIMONIAL_VIDEOS = [
  vidalytics("JcjYb4jILP6zsniI"),
  vidalytics("OHz6S1sB3ahBvu8D"),
  vidalytics("LchE9_kgP012adAZ"),
  vidalytics("U1unfH4Jvr6TjBrS"),
  vidalytics("5IT3tUDRQOJfSJ2m"),
] as const;

const READY_TO_BUILD = {
  heading: "Ready to Build Something You Actually Own?",
  paragraphs: [
    "You've seen the strategy.",
    "Now let's see if it's the right fit for you.",
    "Complete the short application below and schedule a Strategy Call. We'll learn about your goals, answer your questions, and if it makes sense, show you the fastest path to building your own vending business.",
    "Fill out the application below to reserve your call.",
  ],
  action: { kind: "ghl-form" },
} as const;

export const replayVariants: Record<ReplayVariantKey, ReplayVariant> = {
  dna: {
    key: "dna",
    path: REPLAY_PATHS.dna,
    metaTitle: "Masterclass Replay",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading: "If you want an income stream you're in control of, watch this.",
    sub: [
      "Inside, you'll see how entrepreneurs, professionals, and families are building recurring revenue through one of America's most overlooked business models.",
    ],
    steps: [
      "1. Watch the replay",
      "2. Set up call below to get your free advisory call",
    ],
    hero: null,
    cta: READY_TO_BUILD,
    closing: {
      label: "I am ready for my free advisory call",
      subLabel: "click here",
      target: "cta",
    },
    testimonialVideos: YOUTUBE_TESTIMONIAL_VIDEOS,
  },
  adnb: {
    key: "adnb",
    path: REPLAY_PATHS.adnb,
    metaTitle: "Masterclass Replay",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading: "Miss Something?",
    sub: [
      "Whether you had to leave early, got distracted, or simply want to revisit a few sections, the full replay is available below for a limited time.",
    ],
    steps: [],
    hero: null,
    cta: {
      heading: "Still Have Questions?",
      paragraphs: [
        "Most people don't book a strategy call because they're still trying to figure out whether this business makes sense for their situation.",
        "That's exactly what the call is for.",
        "We'll look at your goals, timeline, available capital, and market to determine whether building a vending business is a realistic fit.",
        "If it isn't, we'll tell you.",
        "If it is, we'll show you what the next steps look like.",
        "The replay won't be available forever, but the bigger question is whether you want clarity on whether this opportunity is right for you.",
      ],
      action: { kind: "calendly", calendlyUrl: REPLAY_ADVISORY_CALENDLY },
    },
    closing: { label: "BOOK YOUR FREE STRATEGY CALL", target: "cta" },
    testimonialVideos: YOUTUBE_TESTIMONIAL_VIDEOS,
  },
  meta: {
    key: "meta",
    path: REPLAY_PATHS.meta,
    metaTitle: "Masterclass Replay",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading:
      "See why professionals, entrepreneurs, and families are choosing vending over other business opportunities.",
    sub: [
      "After you watch the replay, reserve your free advisory call. We'll answer your questions, learn about your goals, and help you decide whether building a vending business is the right fit for you.",
    ],
    steps: [],
    hero: { label: "RESERVE MY FREE ADVISORY CALL", target: "cta" },
    cta: READY_TO_BUILD,
    closing: null,
    testimonialVideos: META_TESTIMONIAL_VIDEOS,
  },
  advisory: {
    key: "advisory",
    path: REPLAY_PATHS.advisory,
    metaTitle: "Masterclass Replay",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading:
      "See How Professionals Are Building an Additional Income Stream With Vending",
    sub: ["This replay will only be available for a limited time."],
    steps: [],
    hero: null,
    cta: null,
    closing: { label: "Watch the Replay", target: "video" },
    testimonialVideos: YOUTUBE_TESTIMONIAL_VIDEOS,
  },
};

export const replayExpiresLabel = "Replay Expires";

export const replayTestimonialsCopy = {
  eyebrow: "TESTIMONIALS",
  heading: "What Others Are Saying",
} as const;

export type ReplayTestimonial = {
  tag: string;
  quote: string;
  name: string;
  result: string;
};

// GHL order, top to bottom.
export const replayTestimonials: readonly ReplayTestimonial[] = [
  {
    tag: "Scaling With a W2",
    quote:
      "Joining Vendingpreneurs is one of the best business decisions I've ever had or ever made — simply because it's given me way more than I put into it. Way more.",
    name: "Michael",
    result: "18 locations | ~$54K/mo",
  },
  {
    tag: "Scaling With a W2",
    quote:
      "I was really lucky to have Mike kind of walk me through a bunch of different areas and different steps — what does it really look like? How do you start your own business from the ground up?",
    name: "Shannon",
    result: "4 locations | ~$25K/mo",
  },
  {
    tag: "Scaling Up Couple",
    quote:
      "Vendingpreneurs felt safer than the house thing. And I really liked it — I like to organize and do logistics and bookkeeping. This kind of falls within my wheelhouse.",
    name: "Katie + Graham",
    result: "16 machines | ~$36K/mo",
  },
  {
    tag: "Building Momentum",
    quote:
      "If I hadn't found Mike and the community, there's no way I would have started this on my own. Had no idea what to do or how good or bad it was.",
    name: "Joe",
    result: "15 locations | ~$5.5K/mo",
  },
  {
    tag: "Just Getting Started",
    quote:
      "This community has been crucial in us building our business properly.",
    name: "Mallorie",
    result: "6 locations | ~$4K/mo",
  },
];
