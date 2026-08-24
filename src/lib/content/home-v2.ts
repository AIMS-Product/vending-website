/**
 * Copy that exists only on the /home-v2 redesign preview. Shared copy
 * (hero body, benefits, accelerator, final CTA, testimonials) still comes
 * from ./home and ./case-studies so the two homepages never drift.
 */

type HeroTitleSegment = {
  text: string;
  highlight?: boolean;
};

export const heroV2 = {
  eyebrow: "The Vending Accelerator Program",
  titleLines: [
    [{ text: "Turn vending" }],
    [{ text: "into " }, { text: "financial", highlight: true }],
    [{ text: "freedom", highlight: true }],
  ] satisfies ReadonlyArray<ReadonlyArray<HeroTitleSegment>>,
  badges: [
    {
      value: "$36K/mo",
      label: "Graham & Katie · After one year",
      tilt: "-4deg",
    },
  ],
  secondaryCta: {
    label: "Get your free 90-day roadmap",
    href: "/vending-route-blueprint",
  },
} as const;

export const tickerV2 = {
  srSummary:
    "Vendingpreneurs: passive income, done right. Real people, real results. Trusted brands in our machines. Beginner friendly.",
  items: [
    "Passive income, done right",
    "Real people, real results",
    "Trusted brands in our machines",
    "Beginner friendly",
  ],
} as const;

export const statsBandV2 = {
  eyebrow: "Proof over promises",
  title: "The numbers behind the program",
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
  title: "Real people, real results",
  body: "Real members, filmed in their own words, with the numbers they actually hit.",
  allStoriesLabel: "See every story",
} as const;

/**
 * The written reviews further down the page. Headed differently from the video
 * strip above on purpose: two bands both titled "Real people, real results"
 * reads as a duplicate rather than a second kind of proof.
 */
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
  titleLines: ["Let's see if your", "market is a fit"],
  ghostWord: "Freedom",
} as const;
