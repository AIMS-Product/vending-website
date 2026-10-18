import { buildStandardLink } from "@/lib/analytics/link-standard";

export const mikeBio = {
  name: "Mike Hoffmann",
  role: "Founder. Operator. Dad.",
  bio: "Build a business for your family’s future, with room to be part of their present.",
  bookingTitle: "Start your vending business",
  bookingDescription:
    "We'll pull up leads in your area and map out a plan to join the VP community and work toward your vending goals.",
  bookingAction: "Get your free market analysis",
  learnHeading: "Learn more on YouTube",
  videoTitle: "Everything You Need To Purchase Your First Vending Machine",
  videoAction: "Watch on YouTube",
  videoId: "3HDu68I0_-o",
  newsletterBrand: "Entrepreneurship Collective",
  newsletterTitle: "Get my newsletter",
  newsletterDescription:
    "Practical notes on ownership, business, and building alongside your job.",
  newsletterAction: "Join the newsletter",
  storiesAction: "See member stories",
  privacyLabel: "Privacy",
} as const;

const shared = {
  source: "instagram",
  medium: "organic",
  campaign: "mh-ig-bio",
} as const;

// Same validated builder used by /admin/links. Each placement has its own tuple.
export const mikeBioLinks = {
  entry: buildStandardLink({
    ...shared,
    baseUrl: "https://www.vendingpreneurs.com/mike",
    content: "bio-v1",
    destination: "none",
  }),
  booking: buildStandardLink({
    ...shared,
    baseUrl: "https://www.vendingpreneurs.com/booking-t5-socials",
    content: "bio-v1-book-call",
    destination: "book-call",
  }),
  video: buildStandardLink({
    ...shared,
    baseUrl: "https://www.youtube.com/watch?v=3HDu68I0_-o",
    content: "bio-v1-video-first-machine",
    destination: "content",
  }),
  newsletter: buildStandardLink({
    ...shared,
    baseUrl: "https://www.mikehoffmann.co/",
    content: "bio-v1-newsletter",
    destination: "lead-magnet",
  }),
  stories: buildStandardLink({
    ...shared,
    baseUrl: "https://www.vendingpreneurs.com/case-studies",
    content: "bio-v1-case-studies",
    destination: "content",
  }),
} as const;

// Relative internal links let the existing tracker carry the session and CTA
// source into the booking form, without sending preview visitors to production.
export function mikeBioInternalHref(href: string) {
  const url = new URL(href);
  return `${url.pathname}${url.search}`;
}
