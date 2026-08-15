/**
 * Every word on the page lives here so copy edits never mean touching layout.
 * Mike's team edits this file; the components below it just render it.
 */

export const site = {
  name: "Mike Hoffmann",
  publication: "Entrepreneurship Collective",
  domain: "mikehoffmann.co",
  title: "Entrepreneurship Collective — a newsletter by Mike Hoffmann",
  description:
    "Two emails a week on vending and the other unglamorous, cash-flowing businesses that build real income. Free, from a founder running 150+ machines and four companies.",
} as const;

export const hero = {
  eyebrow: "A free newsletter by Mike Hoffmann",
  heading: "Build Real Wealth the Boring Way",
  subhead:
    "Weekly insights, stories, and resources from a founder who turned one overlooked, unglamorous business into a real portfolio — guiding you from zero businesses to owning the ones that actually pay.",
  formNote: "Free. Two emails a week. Unsubscribe anytime.",
  portraitCaption: "Mike Hoffmann — founder, Vendingpreneurs and VendHub",
} as const;

export const stats = [
  { value: "1,200+", label: "Readers" },
  { value: "2×", label: "Emails a week" },
  { value: "150+", label: "Machines run" },
  { value: "$0", label: "To subscribe" },
] as const;

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
  issues: [
    {
      number: "01",
      title: "The vending issue",
      body: "Walks you through vending — the exact business Mike broke into first, from picking your first location to running your first real route.",
      image: "/images/hero.avif",
      alt: "An operator restocking a smart cooler on a vending route.",
    },
    {
      number: "02",
      title: "The portfolio issue",
      body: "Pulls back further: what it actually takes to build income through cash-flowing, unglamorous businesses beyond vending — the ones that build real income, not the ones that just look good online.",
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
    "Built from real calls with active operators, not theory or secondhand advice.",
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
  companies: [
    { name: "Vendingpreneurs", note: "Mentorship for new operators" },
    { name: "Modern Amenities", note: "Unattended retail" },
    { name: "VendHub", note: "Machines, parts and supply" },
  ],
  portrait: "/images/mike-hoffmann.webp",
} as const;

export const closing = {
  heading:
    "Ready for a newsletter that actually helps you build something real — even if you're starting from zero?",
  body: "Join 1,200+ people getting Entrepreneurship Collective twice a week. It's free, straight to your inbox.",
} as const;

export const footer = {
  tagline: "Boring businesses. Real income. Twice a week.",
  links: [
    { label: "Vendingpreneurs", href: "https://www.vendingpreneurs.com" },
    { label: "Privacy", href: "/privacy" },
  ],
} as const;
