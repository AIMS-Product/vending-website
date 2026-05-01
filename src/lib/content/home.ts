export type Stat = {
  value: string;
  label: string;
};

export type Benefit = {
  title: string;
  body: string;
  icon: "trend" | "people" | "percent" | "globe";
};

export type AcceleratorPoint = string;

export type PartnerLogo = {
  name: string;
  src: string;
  /** Intrinsic logo width in pixels (taller logos can rely on h-* utility). */
  width: number;
  height: number;
};

export const hero = {
  title: ["Turn Vending", "Into Your Path", "to Financial Freedom"],
  body: [
    "Breaking free from the traditional job structure isn't just a dream—it's a real possibility with the right strategy.",
    "At Vendingpreneurs, we provide aspiring entrepreneurs with the mentorship, tools, and exclusive discounts they need to launch and scale a profitable vending machine business with minimal time investment.",
  ],
  image: {
    src: "/images/sections/hero.avif",
    alt: "An entrepreneur stocking a smart vending machine",
  },
  cta: { label: "Apply Now", href: "/apply" },
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
  body: "Building a vending machine business without expert guidance can lead to wasted time and costly mistakes. We eliminate the guesswork by providing a structured roadmap to success.",
  image: {
    src: "/images/sections/why.avif",
    alt: "A customer paying at a smart vending machine with a smartwatch",
  },
  items: [
    {
      title: "Proven Success Strategies",
      body: "A step-by-step system designed to get results, even for complete beginners.",
      icon: "trend",
    },
    {
      title: "Expert Coaching & Support",
      body: "Learn directly from seasoned vending professionals.",
      icon: "people",
    },
    {
      title: "Exclusive Discounts",
      body: "Save money on vending machines and bulk product deals to boost profitability.",
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
    { value: "500+", label: "Entrepreneurs launched" },
    { value: "$3M+", label: "Snack/Drink sales in Vendingpreneur machines" },
    { value: "3,000+", label: "Vending locations w/our guidance" },
  ] satisfies ReadonlyArray<Stat>,
  points: [
    "How to start a vending business with little upfront investment compared to Real Estate",
    "Which vending machines and products generate the highest profits",
    "How to secure high-traffic locations that guarantee consistent income",
    "Automation & scaling strategies to maximize your time and revenue",
    "Common mistakes new vending entrepreneurs make—and how to avoid them",
  ] satisfies ReadonlyArray<AcceleratorPoint>,
  bonus: {
    label: "Bonus:",
    body: "Get access to discounted vending machines and bulk product deals to increase your bottom line.",
  },
  cta: { label: "Apply Now", href: "/apply" },
} as const;

export const finalCta = {
  title: "Take Action Today",
  body: "The vending industry is one of the most accessible ways to build passive income, but success doesn't happen by chance—it happens by taking the right steps with the right guidance.",
  image: {
    src: "/images/sections/cta.avif",
    alt: "A customer tapping a phone to pay at a smart vending machine",
  },
  cta: { label: "Apply Now", href: "/apply" },
} as const;
