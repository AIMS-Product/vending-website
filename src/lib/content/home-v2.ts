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

export const testimonialsV2 = {
  eyebrow: "Success stories",
  title: "Real people, real results",
  body: "See how others have built profitable vending businesses with our coaching.",
} as const;

export const finalCtaV2 = {
  marqueeWord: "Apply now",
  // Two lines because the band renders them as stacked display type; the second
  // line carries the highlight.
  titleLines: ["Join the Vending", "Accelerator Program"],
  ghostWord: "Freedom",
} as const;
