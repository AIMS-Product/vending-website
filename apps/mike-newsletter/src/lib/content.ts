/**
 * Every word on the page lives here so copy edits never mean touching layout.
 * Mike's team edits this file; the components below it just render it.
 *
 * Below the hero, copy comes from Mike's brand foundation (Entrepreneur
 * Collective project, docs/brand-foundation.md); numbers are used exactly as
 * written there. Vendingpreneurs is the partner's brand and is not sold here.
 *
 * The hero's source of truth is Kody's brief. Where a line is condensed (the brief
 * says "feel free to remove or condense") the wording still comes out of the
 * brief rather than being rewritten — no claim about the businesses, the
 * numbers, or what the emails contain is invented here.
 */

export const site = {
  name: "Mike Hoffmann",
  publication: "Entrepreneurship Collective",
  domain: "mikehoffmann.co",
  title: "Entrepreneurship Collective — a newsletter by Mike Hoffmann",
  description:
    "Weekly insights, stories, and resources from a founder who turned one overlooked, unglamorous business into a real portfolio. Two emails a week, free.",
} as const;

export const hero = {
  eyebrow: "A free newsletter by Mike Hoffmann",
  heading: "Build Real Wealth the Boring Way",
  // The brief's full subhead ran five lines here and pushed the signup field
  // under the fold on a 360px screen. This is its front half; the whole
  // sentence still appears intact as `whatYouGet.lede`.
  subhead:
    "Weekly insights, stories, and resources from a founder who turned one unglamorous business into a real portfolio.",
  formLabel: "Join Entrepreneurship Collective.",
  formNote: "Free. Two emails a week. Unsubscribe anytime.",
  proofLine: "28,000+ people already read it.",
  portraitCaption: "Mike Hoffmann — 300+ machines, built on the side of a W-2",
} as const;

export const stats = [
  { value: "28,000+", label: "Readers" },
  { value: "2×", label: "Emails a week" },
  { value: "$0", label: "To subscribe" },
] as const;

/** Copy for the bar that follows the reader up the page on small screens. */
export const stickyCta = {
  label: "Free · Two emails a week",
  button: "Subscribe",
} as const;

export const proof = {
  heading: "Ideas featured across",
  logos: [
    {
      name: "Investor's Podcast Network",
      src: "/logos/investors-podcast-network.webp",
    },
    { name: "Millennial Investing", src: "/logos/millennial-investing.jpg" },
    { name: "UpFlip", src: "/logos/upflip.svg" },
    {
      name: "Wealth Without Wall Street",
      src: "/logos/wealth-without-wall-street.webp",
    },
    { name: "Side Hustle Nation", src: "/logos/side-hustle-nation.webp" },
  ],
} as const;

export const whatYouGet = {
  eyebrow: "What you get",
  heading: "Two emails a week, straight to your inbox.",
  lede: "Real playbooks from a performance coach who trained elite athletes, then trained his money. Receipts over vibes: exact numbers, costs, and losses included — so you can build income that empties your calendar instead of filling it.",
  issues: [
    {
      number: "01",
      title: "The vending issue",
      body: "Modern vending, the business Mike broke into first — run as an amenity business, not a Saturday shift.",
      points: [
        "The apartment-complex pitch that worked after old-school machines were rejected",
        "The Asset-vs-Shift Test before you buy a single machine",
        "Hire-the-operator math: giving up about 5% margin to buy back your Saturdays",
      ],
      image: "/images/hero.avif",
      alt: "An operator restocking a smart cooler on a vending route.",
    },
    {
      number: "02",
      title: "The 5-to-9 issue",
      body: "Your 9-to-5 funds the 5-to-9. How to build ownership on the side of a W-2 without quitting first.",
      points: [
        "Ordering income streams by capital and time",
        "Why vending is the lower-capital gateway before real estate",
        "Real-estate receipts, starting with a $270,000 land-split flip",
      ],
      image: "/images/accelerator.avif",
      alt: "A self-checkout kiosk in an office micro market.",
    },
  ],
} as const;

export const field = {
  eyebrow: "Receipts over vibes",
  heading: "Most side hustles are jobs with worse benefits.",
  body: "Three machines stocked by the owner is a Saturday shift with a truck payment. Every issue shows the numbers behind ownership that actually buys time back — including the losses, like the used machine that died at month six and had to be paid for twice.",
  pullQuote:
    "If it requires you at a specific place at a specific time, it's a shift, not an asset.",
  image: "/images/why.avif",
  alt: "A customer paying at a smart cooler with a contactless watch tap.",
} as const;

export const meetMike = {
  eyebrow: "Meet Mike Hoffmann",
  heading: "He started at $1,200 a month.",
  body: [
    "Mike spent a decade making elite performers better — first as a collegiate strength coach earning $1,200/month, then implementing performance technology for special operations units, the NFL, and the All Blacks — while missing his own life three weeks a month.",
    "When his wife got pregnant and a $4 airport water bottle exposed the math of ownership, he built a modern vending business on the side of his W-2, left the job 18 months later, and scaled to 300+ machines producing $100K+/month in profit. Now he teaches W-2 parents to build income that funds presence — not another job with worse benefits.",
  ],
  timelineLabel: "The receipts",
  timeline: [
    { year: "2012", text: "First rental: $70,000 house, $14,000 down, about $280/month cash flow" },
    { year: "2020", text: "Denver Airport, 11 p.m.: a $4 water that cost the owner about $0.25" },
    { year: "2021", text: "First placement: smart coolers pitched as a modern amenity" },
    { year: "2022", text: "Left the W-2, 18 months after starting on the side" },
    { year: "2026", text: "300+ machines, $100K+/month profit, run by operators — not Mike's Saturdays" },
  ],
  portrait: "/images/mike-hoffmann.webp",
} as const;

export const closing = {
  heading:
    "Ready to build income that empties your calendar instead of filling it?",
  body: "Join 28,000+ people getting Entrepreneurship Collective twice a week. It's free, straight to your inbox.",
  formLabel: "Subscribe to stay in the loop.",
} as const;

export const footer = {
  tagline: "Ownership that buys back time. Twice a week.",
  links: [{ label: "Privacy", href: "/privacy" }],
} as const;
