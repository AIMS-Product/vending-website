import { chicagoHour } from "@/lib/content/masterclass";

// Copy and wiring for the four webinar replay pages, rebuilt from the GHL
// funnel "How to Build a Smart Vending Business in 2026"
// (webinar.vendingpreneurs.com/masterclass-replay-{dna,adnb,meta,advisory-team-798452}).
// Copy is verbatim from GHL (income claims are legal-approved): shorten by
// omission only. The two GHL emoji (the down arrow on DNA, the warning sign on
// the advisory page) are omitted.

export type ReplayVariantKey = "dna" | "adnb" | "meta" | "advisory";

export type ReplayVideo =
  | {
      kind: "vidalytics";
      embedId: string;
      /** Still shown behind the play button until the player loads. */
      poster?: string;
    }
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

/**
 * The "Replay expires" strip shows only while the expiry is ahead. Past it the
 * replay still plays and booking still works until the next room, so the
 * strip disappears rather than claiming the replay has ended. Used on the
 * server (an expired strip is never rendered) and in the browser (an ISR copy
 * or a tab left open past the expiry drops the strip at that second).
 */
export function replayCountdownLive(
  expiresAt: string | null,
  now: number,
): expiresAt is string {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
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

/** UI label over the Calendly booking heading (adnb); not offer copy. */
export const REPLAY_BOOKING_EYEBROW = "Book a call";

export const REPLAY_ANCHORS = {
  video: "replay",
  cta: "book-call",
} as const;

export type ReplayCta =
  | { kind: "ghl-form" }
  | { kind: "calendly"; calendlyUrl: string };

/** One paragraph of booking copy; `lines` are set on separate lines. */
export type ReplayCtaParagraph = {
  lines: readonly string[];
  weight?: "black" | "semibold";
};

/** An under-video step; `target` makes it a link to that anchor. */
export type ReplayStep = { label: string; target?: "video" | "cta" };

export type ReplayVariant = {
  key: ReplayVariantKey;
  path: `/${string}`;
  /** Tab title; the root layout appends " | Vendingpreneurs". */
  metaTitle: string;
  heading: string;
  mainVideo: ReplayVideo;
  /** Lines under the heading. */
  sub: readonly string[];
  /** Numbered steps shown under the video (DNA only). */
  steps: readonly ReplayStep[];
  /** Replay-hero button: scrolls to the anchor named by `target`. */
  hero: { label: string; target: "video" | "cta" } | null;
  /** Booking section; null on the advisory page, which has none on GHL. */
  cta: {
    heading: string;
    /** Set larger and darker above the paragraphs. */
    lead?: string;
    paragraphs: readonly ReplayCtaParagraph[];
    action: ReplayCta;
  } | null;
  /** Repeat button after the testimonials. */
  closing: { label: string; target: "video" | "cta" } | null;
  testimonialVideos: readonly ReplayVideo[];
};

const youtube = (id: string): ReplayVideo => ({ kind: "youtube", id });
/**
 * Vidalytics shows nothing until its player loads, so each meta testimonial
 * borrows the YouTube thumbnail of the same member's story as its poster.
 * maxresdefault (1280x720, no letterbox) rather than hqdefault (480x360,
 * letterboxed), which was soft at the ~400px card width on retina. Resolved
 * by hand rather than at runtime: all five ids served a real maxresdefault on
 * 2026-09-30. A new id must be checked the same way (`curl -I`), or fall back
 * to sddefault.jpg.
 */
export const youtubePoster = (id: string) =>
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

const vidalytics = (embedId: string, posterOf: string): ReplayVideo => ({
  kind: "vidalytics",
  embedId,
  poster: youtubePoster(posterOf),
});

// Same five member videos as GHL, in the order of the five testimonials below
// (Michael, Joe, Shannon, Mallorie, Katie + Graham).
const YOUTUBE_TESTIMONIAL_VIDEOS = [
  youtube("U7KKbZHqBvg"),
  youtube("gvvz2nMax0w"),
  youtube("yP4Y_BBAvq4"),
  youtube("io1Jkei-yFs"),
  youtube("heSbv_uG734"),
] as const;

const META_TESTIMONIAL_VIDEOS = [
  vidalytics("JcjYb4jILP6zsniI", "U7KKbZHqBvg"),
  vidalytics("U1unfH4Jvr6TjBrS", "gvvz2nMax0w"),
  vidalytics("OHz6S1sB3ahBvu8D", "yP4Y_BBAvq4"),
  vidalytics("5IT3tUDRQOJfSJ2m", "io1Jkei-yFs"),
  vidalytics("LchE9_kgP012adAZ", "heSbv_uG734"),
] as const;

/**
 * DNA's and Meta's booking copy. GHL's DNA paragraph said "schedule a
 * Strategy Call", but both pages' steps, hero and buttons offer a "free
 * advisory call", so the form copy names that same call. Process copy only.
 */
const READY_TO_BUILD = {
  heading: "Ready to Build Something You Actually Own?",
  lead: "You've seen the strategy. Now let's see if it's the right fit for you.",
  paragraphs: [
    {
      lines: [
        "Complete the short application below and schedule your free advisory call. We'll learn about your goals, answer your questions, and if it makes sense, show you the fastest path to building your own vending business.",
      ],
    },
  ],
  action: { kind: "ghl-form" },
} as const;

export const replayVariants: Record<ReplayVariantKey, ReplayVariant> = {
  dna: {
    key: "dna",
    path: REPLAY_PATHS.dna,
    metaTitle: "Masterclass Replay (DNA)",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading: "If you want an income stream you're in control of, watch this.",
    sub: [
      "Inside, you'll see how entrepreneurs, professionals, and families are building recurring revenue through one of America's most overlooked business models.",
    ],
    steps: [
      { label: "Watch the replay" },
      {
        label: "Set up call below to get your free advisory call",
        target: "cta",
      },
    ],
    hero: null,
    cta: READY_TO_BUILD,
    closing: { label: "I am ready for my free advisory call", target: "cta" },
    testimonialVideos: YOUTUBE_TESTIMONIAL_VIDEOS,
  },
  adnb: {
    key: "adnb",
    path: REPLAY_PATHS.adnb,
    metaTitle: "Masterclass Replay (ADNB)",
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
        {
          lines: [
            "Most people don't book a strategy call because they're still trying to figure out whether this business makes sense for their situation.",
          ],
        },
        { lines: ["That's exactly what the call is for."], weight: "black" },
        {
          lines: [
            "We'll look at your goals, timeline, available capital, and market to determine whether building a vending business is a realistic fit.",
          ],
        },
        {
          lines: [
            "If it isn't, we'll tell you.",
            "If it is, we'll show you what the next steps look like.",
          ],
          weight: "semibold",
        },
        {
          lines: [
            "The replay won't be available forever, but the bigger question is whether you want clarity on whether this opportunity is right for you.",
          ],
        },
      ],
      action: { kind: "calendly", calendlyUrl: REPLAY_ADVISORY_CALENDLY },
    },
    closing: { label: "BOOK YOUR FREE STRATEGY CALL", target: "cta" },
    testimonialVideos: YOUTUBE_TESTIMONIAL_VIDEOS,
  },
  meta: {
    key: "meta",
    path: REPLAY_PATHS.meta,
    metaTitle: "Masterclass Replay (Meta)",
    mainVideo: REPLAY_MAIN_VIDEO,
    heading:
      "See why professionals, entrepreneurs, and families are choosing vending over other business opportunities.",
    sub: [
      "After you watch the replay, reserve your free advisory call. We'll answer your questions, learn about your goals, and help you decide whether building a vending business is the right fit for you.",
    ],
    steps: [],
    hero: { label: "RESERVE MY FREE ADVISORY CALL", target: "cta" },
    cta: READY_TO_BUILD,
    closing: { label: "Reserve my free advisory call", target: "cta" },
    testimonialVideos: META_TESTIMONIAL_VIDEOS,
  },
  advisory: {
    key: "advisory",
    path: REPLAY_PATHS.advisory,
    metaTitle: "Masterclass Replay (Advisory)",
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

/**
 * Share and search description, from the page's own copy: the line under the
 * heading, led by the heading when that line alone is too short to say what
 * the page is (advisory's "available for a limited time").
 */
export function replayDescription(variant: ReplayVariant): string {
  const sub = variant.sub.join(" ");
  if (sub.length >= 80) return sub;
  const heading = /[.!?]$/.test(variant.heading)
    ? variant.heading
    : `${variant.heading}.`;
  return `${heading} ${sub}`;
}

export const replayExpiresLabel = "Replay Expires";

export const replayTestimonialsCopy = {
  eyebrow: "TESTIMONIALS",
  heading: "What Others Are Saying",
} as const;

export type ReplayTestimonial = {
  tag: string;
  quote: string;
  name: string;
  /** Two figures joined by " | "; the card splits them at render. */
  result: string;
};

// GHL's five, reordered (wording untouched): on desktop the first row is
// three full-length quotes and the second row pairs Mallorie's one-liner
// with Katie + Graham.
export const replayTestimonials: readonly ReplayTestimonial[] = [
  {
    tag: "Scaling With a W2",
    quote:
      "Joining Vendingpreneurs is one of the best business decisions I've ever had or ever made — simply because it's given me way more than I put into it. Way more.",
    name: "Michael",
    result: "18 locations | ~$54K/mo",
  },
  {
    tag: "Building Momentum",
    quote:
      "If I hadn't found Mike and the community, there's no way I would have started this on my own. Had no idea what to do or how good or bad it was.",
    name: "Joe",
    result: "15 locations | ~$5.5K/mo",
  },
  {
    tag: "Scaling With a W2",
    quote:
      "I was really lucky to have Mike kind of walk me through a bunch of different areas and different steps — what does it really look like? How do you start your own business from the ground up?",
    name: "Shannon",
    result: "4 locations | ~$25K/mo",
  },
  {
    tag: "Just Getting Started",
    quote:
      "This community has been crucial in us building our business properly.",
    name: "Mallorie",
    result: "6 locations | ~$4K/mo",
  },
  {
    tag: "Scaling Up Couple",
    quote:
      "Vendingpreneurs felt safer than the house thing. And I really liked it — I like to organize and do logistics and bookkeeping. This kind of falls within my wheelhouse.",
    name: "Katie + Graham",
    result: "16 machines | ~$36K/mo",
  },
];
