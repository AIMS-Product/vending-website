type Stat = {
  value: string;
  label: string;
};

export type Benefit = {
  title: string;
  body: string;
  icon: "trend" | "people" | "percent" | "globe";
};

type AcceleratorPoint = string;

export type PartnerLogo = {
  name: string;
  src: string;
  /** Intrinsic logo width in pixels (taller logos can rely on h-* utility). */
  width: number;
  height: number;
};

export const hero = {
  title: ["Start Your", "Vending Business", "With Coaching"],
  body: [
    "Starting a vending business takes the right strategy: where to place machines, what to stock, and how to win locations.",
    "At Vendingpreneurs, we provide aspiring entrepreneurs with the mentorship, tools, and exclusive discounts they need to launch and scale a vending machine business.",
  ],
  image: {
    src: "/images/sections/hero.avif",
    alt: "An entrepreneur stocking a smart vending machine",
  },
  cta: { label: "See if your market is a fit", href: "/contact" },
} as const;

export const partnerStrip = {
  title: "Trusted Vendingpreneur Partners",
} as const;

/** Order matches the live Webflow strip: 365, Alani, Cantaloupe, Micromart, PepsiCo, Prime, Poppi, Doritos. */
export const partnerLogos: ReadonlyArray<PartnerLogo> = [
  {
    name: "365 Retail Markets",
    src: "/images/partners/365-markets.png",
    width: 200,
    height: 80,
  },
  {
    name: "Alani Nu",
    src: "/images/partners/alani-nu.png",
    width: 200,
    height: 80,
  },
  {
    name: "Cantaloupe",
    src: "/images/partners/cantaloupe.png",
    width: 200,
    height: 80,
  },
  {
    name: "Micromart",
    src: "/images/partners/micromart.png",
    width: 200,
    height: 80,
  },
  {
    name: "PepsiCo",
    src: "/images/partners/pepsico.png",
    width: 200,
    height: 80,
  },
  {
    name: "Prime",
    src: "/images/partners/prime.png",
    width: 200,
    height: 80,
  },
  {
    name: "Poppi",
    src: "/images/partners/poppi.png",
    width: 200,
    height: 80,
  },
  {
    name: "Doritos",
    src: "/images/partners/doritos.png",
    width: 200,
    height: 80,
  },
];

export const benefits = {
  title: "Why Vendingpreneurs?",
  body: "Building a vending machine business without expert guidance can lead to wasted time and costly mistakes. We eliminate the guesswork by providing a structured roadmap.",
  image: {
    src: "/images/sections/why.avif",
    alt: "A customer paying at a smart vending machine with a smartwatch",
  },
  items: [
    {
      title: "A Step-by-Step System",
      body: "A clear process that walks complete beginners through every stage.",
      icon: "trend",
    },
    {
      title: "Expert Coaching & Support",
      body: "Learn directly from seasoned vending professionals.",
      icon: "people",
    },
    {
      title: "Exclusive Discounts",
      body: "Access discounted vending machines and bulk product deals from our partners.",
      icon: "percent",
    },
    {
      title: "A Community of Entrepreneurs",
      body: "Network with others on the same journey, sharing insights and experiences.",
      icon: "globe",
    },
  ] satisfies ReadonlyArray<Benefit>,
} as const;

export const accelerator = {
  title: "The Vending Accelerator Program",
  body: "Our flagship Vending Accelerator Program is designed for both beginners and experienced entrepreneurs looking to optimize their vending routes.",
  image: {
    src: "/images/sections/accelerator.avif",
    alt: "An entrepreneur using a Cantaloupe-branded vending kiosk",
  },
  stats: [
    { value: "Live", label: "Coaching from active operators" },
    { value: "Hands-on", label: "Help finding and winning locations" },
    { value: "Member", label: "Pricing on machines and product" },
  ] satisfies ReadonlyArray<Stat>,
  statsDisclaimer:
    "Earnings may vary and are not guaranteed. Individual outcomes depend on personal investment, your market, and adherence to the program.",
  points: [
    "How to start a vending business and what to budget for",
    "Which vending machines and products fit your locations",
    "How to secure high-traffic locations and keep them",
    "Automation and scaling strategies to make the most of your time",
    "Common mistakes new vending entrepreneurs make—and how to avoid them",
  ] satisfies ReadonlyArray<AcceleratorPoint>,
  bonus: {
    label: "Bonus:",
    body: "Get access to discounted vending machines and bulk product deals.",
  },
  cta: { label: "See if your market is a fit", href: "/contact" },
} as const;

export const finalCta = {
  title: "Curious if your market is a fit?",
  body: "Book a free 15-minute call and we will look at your market with you. No purchase required.",
  image: {
    src: "/images/sections/cta.avif",
    alt: "A customer tapping a phone to pay at a smart vending machine",
  },
  cta: { label: "Book here", href: "/contact" },
} as const;
