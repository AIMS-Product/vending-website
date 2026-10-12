/**
 * Homepage copy for the redesigned sections (hero, ticker, stats band, and
 * the rest of home-v2/*). Shared copy (hero body, benefits, accelerator,
 * final CTA, testimonials) comes from ./home and ./case-studies.
 */

type HeroTitleSegment = {
  text: string;
  highlight?: boolean;
};

export const heroV2 = {
  eyebrow: "The Vending Accelerator Program",
  titleLines: [
    [{ text: "Start your" }],
    [{ text: "vending " }, { text: "business", highlight: true }],
    [{ text: "with coaching" }],
  ] satisfies ReadonlyArray<ReadonlyArray<HeroTitleSegment>>,
  badges: [
    {
      value: "Live coaching",
      label: "From active operators",
      tilt: "-4deg",
    },
  ],
  secondaryCta: {
    label: "Get your free roadmap",
    // Jess, 2026-09-22: this pointed at /vending-route-blueprint, the old
    // watch-and-apply page, which has no roadmap on it. The download and the
    // email capture live on the roadmap lead-magnet page.
    href: "/resources/roadmap",
  },
} as const;

export const tickerV2 = {
  srSummary:
    "Vendingpreneurs: coaching from active operators. Real people, real stories. Trusted brands in our machines. Beginner friendly.",
  items: [
    "Coaching from active operators",
    "Real people, real stories",
    "Trusted brands in our machines",
    "Beginner friendly",
  ],
} as const;

export const statsBandV2 = {
  eyebrow: "What you get",
  title: "What's inside the program",
  ghostWord: "Vending",
} as const;

export const programV2 = {
  eyebrow: "What you'll learn",
} as const;

export const benefitsV2 = {
  eyebrow: "Why Vendingpreneurs",
  teamCta: { label: "Meet our team", href: "/about" },
} as const;

/** The video case-study strip directly under the partner ticker. */
export const caseStudiesStripV2 = {
  eyebrow: "Success stories",
  title: "Real people, real stories",
  body: "Real members, filmed in their own words, sharing how they got started.",
  allStoriesLabel: "See every story",
} as const;

/**
 * The written reviews further down the page. Headed differently from the video
 * strip above on purpose: two bands both titled "Real people, real results"
 * reads as a duplicate rather than a second kind of proof.
 */
/**
 * Written reviews safe for the homepage: the rest state location counts or
 * time-to-result, which Google Ads flags as "Unreliable claims". Add an id only
 * after checking the quote for figures.
 */
export const homeQuoteIds: ReadonlyArray<string> = [
  "dewitts",
  "bret-bourgeois",
  "nolan-mayfield",
  "adam-s",
];

export const testimonialsV2 = {
  eyebrow: "In their own words",
  title: "What members say",
  body: "Written reviews from operators who joined with no vending experience.",
} as const;

export const finalCtaV2 = {
  marqueeWord: "Find out",
  // Two lines because the band renders them as stacked display type; the second
  // line carries the highlight. Framed as a fit question rather than "join the
  // program": the ask is a low-commitment qualification, not a commitment.
  titleLines: ["Curious if your market", "is a fit?"],
  ghostWord: "Start",
} as const;
