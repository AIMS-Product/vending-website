export const NEWSLETTER_PAGE_TITLE =
  "Sign Up for the Route | Vendingpreneurs Newsletter";

export const NEWSLETTER_META_DESCRIPTION =
  "Get weekly insights, case studies, and musings on vending, ownership, and practical entrepreneurship from Mike Hoffmann and Anthony Kolodziej.";

export const NEWSLETTER_FORM_ID = "7f5d8f76-2e5a-4e50-9b6f-8e92b3d9a401";

export const NEWSLETTER_QUESTION_IDS = {
  emailConsent: "newsletter_email_consent",
  programUpdatesConsent: "program_updates_consent",
  smsUpdatesConsent: "sms_updates_consent",
  pullToLaunch: "pull_to_launch",
  learnMost: "learn_most",
} as const;

export const NEWSLETTER_EMAIL_CONSENT_LABEL =
  "Yes — send me The Route each week. I can unsubscribe anytime.";
export const NEWSLETTER_PROGRAM_UPDATES_CONSENT_LABEL =
  "Also send me occasional Vendingpreneurs program updates and event invites.";
export const NEWSLETTER_SMS_CONSENT_LABEL =
  "Text me occasional updates at this number. Message and data rates may apply.";

export const NEWSLETTER_PULL_OPTIONS = [
  { value: "replace_job", label: "Replace my full-time job" },
  { value: "generational_wealth", label: "Build generational wealth" },
  { value: "diversify_income", label: "Diversify my income" },
  { value: "life_event", label: "A life event" },
  { value: "other", label: "Other" },
] as const;

export const NEWSLETTER_LEARN_OPTIONS = [
  { value: "getting_started", label: "Getting started the right way" },
  { value: "machines_products", label: "Machines & products" },
  { value: "locations", label: "Finding & securing locations" },
  { value: "financing", label: "Financing & funding" },
  { value: "legal", label: "Permits, legal & state rules" },
] as const;

export const newsletterPageContent = {
  hero: {
    eyebrow: "The Route by Vendingpreneurs",
    heading: "Learn to Build Something That Earns Without You",
    body: "Weekly insights on vending, ownership, and practical entrepreneurship.",
    stats: [
      { value: "1,200+", label: "Subscribers" },
      { value: "2x", label: "Emails per week" },
      { value: "100%", label: "Free" },
    ],
  },
  proof: [
    {
      name: "Investor's Podcast Network",
      image: "/images/newsletter/investors-podcast-network.webp",
    },
    {
      name: "Millennial Investing",
      image: "/images/newsletter/millennial-investing.jpg",
    },
    { name: "UpFlip", image: "/images/newsletter/upflip.svg" },
    {
      name: "Wealth Without Wall Street",
      image: "/images/newsletter/wealth-without-wall-street.webp",
    },
    {
      name: "Side Hustle Nation",
      image: "/images/newsletter/side-hustle-nation.webp",
    },
  ],
  expertsHeading: "Two experts. One inbox. All business.",
  experts: [
    {
      name: "Anthony Kolodziej",
      publication: "Vendingpreneur Pulse",
      image: "/images/newsletter/anthony-kolodziej.webp",
      body: 'Weekly tips, guidance, and real stories to help you launch your first machine, land better locations, and grow past the "one machine in a breakroom" stage.',
    },
    {
      name: "Mike Hoffmann",
      publication: "Entrepreneurship Collective",
      image: "/images/newsletter/mike-hoffmann.webp",
      body: 'Expert insight on turning vending and other "boring businesses" into lasting income streams that go beyond a traditional vending route.',
    },
  ],
  closingHeading:
    "Ready for a newsletter that helps you run machines and build a business?",
  closingBody:
    "Get the only resource that takes you from one machine to building passive income streams — all for free.",
} as const;
