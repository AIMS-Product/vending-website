/**
 * Every word on the page lives here so copy edits never mean touching layout.
 * Mike's team edits this file; the components below it just render it.
 *
 * The source of truth is Kody's brief. Where a line is condensed (the brief
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
  portraitCaption: "Mike Hoffmann — founder, Vendingpreneurs and VendHub",
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
  lede: "Weekly insights, stories, and resources from a founder who turned one overlooked, unglamorous business into a real portfolio — guiding you from zero businesses to owning the ones that actually pay.",
  issues: [
    {
      number: "01",
      title: "The vending issue",
      body: "Walks you through vending — the exact business Mike broke into first.",
      // Both beats are the brief's own words. Nothing about machines,
      // margins or products is claimed here, because the brief doesn't.
      points: [
        "Picking your first location",
        "Running your first real route",
      ],
      image: "/images/hero.avif",
      alt: "An operator restocking a smart cooler on a vending route.",
    },
    {
      number: "02",
      title: "The portfolio issue",
      body: "Pulls back further: what it actually takes to build income beyond vending.",
      points: [
        "Cash-flowing, unglamorous businesses",
        "The ones that build real income — not the ones that just look good online",
      ],
      image: "/images/accelerator.avif",
      alt: "A self-checkout kiosk in an office micro market.",
    },
  ],
} as const;

export const field = {
  eyebrow: "Straight from the field",
  heading: "No recycled fluff.",
  body: "Every issue comes from real conversations, real member wins, and what's actually happening in the field right now — vending routes, cash-flowing assets, and the unsexy operations most people scroll right past.",
  pullQuote:
    "Build from Mike's real experiences building his boring business portfolio.",
  image: "/images/why.avif",
  alt: "A customer paying at a smart cooler with a contactless watch tap.",
} as const;

export const meetMike = {
  eyebrow: "Meet Mike Hoffmann",
  heading: "He started at $1,200 a month.",
  body: [
    "Mike went from working 60 hours a week at a 9-to-5, barely clearing $1,200/month, to building 150+ vending machines generating $200,000+/month in a few years — proof that unglamorous businesses build real wealth.",
    "That was just the start. Mike used that first business to build three more. Entrepreneurship Collective is his playbook for going from zero businesses to boring business master.",
  ],
  companiesLabel: "The three that followed",
  companies: [
    { name: "Modern Amenities", href: "https://www.modern-amenities.com" },
    { name: "Vendingpreneurs", href: "https://www.vendingpreneurs.com" },
    { name: "VendHub", href: "https://www.vendhubhq.com" },
  ],
  portrait: "/images/mike-hoffmann.webp",
} as const;

export const closing = {
  heading:
    "Ready for a newsletter that actually helps you build something real — even if you're starting from zero?",
  body: "Join 28,000+ people getting Entrepreneurship Collective twice a week. It's free, straight to your inbox.",
  formLabel: "Subscribe to stay in the loop.",
} as const;

export const footer = {
  tagline: "Boring businesses. Real income. Twice a week.",
  links: [
    { label: "Vendingpreneurs", href: "https://www.vendingpreneurs.com" },
    { label: "Privacy", href: "/privacy" },
  ],
} as const;
