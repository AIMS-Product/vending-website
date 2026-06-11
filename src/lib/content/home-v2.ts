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
    { value: "500+", label: "Entrepreneurs launched", tilt: "-5deg" },
    { value: "$3M+", label: "In machine sales", tilt: "4deg" },
  ],
  secondaryCta: { label: "See real results", href: "#success-stories" },
} as const;

export const tickerV2 = {
  srSummary:
    "Vendingpreneurs: 500+ entrepreneurs launched. $3M+ in machine sales. 3,000+ vending locations secured. Beginner friendly.",
  items: [
    "Passive income, done right",
    "500+ entrepreneurs launched",
    "$3M+ in machine sales",
    "3,000+ locations secured",
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
} as const;

export const testimonialsV2 = {
  eyebrow: "Success stories",
  title: "Real people, real results",
  body: "See how others have built profitable vending businesses with our coaching.",
} as const;

export const finalCtaV2 = {
  marqueeWord: "Apply now",
  titleLines: ["Take action", "today"],
  ghostWord: "Freedom",
} as const;
