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

export const hero = {
  eyebrow: undefined,
  title: ["Turn Vending", "Into Your Path", "to Financial Freedom"],
  body: [
    "Breaking free from the traditional job structure isn't just a dream—it's a real possibility with the right strategy.",
    "At Vendingpreneurs, we provide aspiring entrepreneurs with the mentorship, tools, and exclusive discounts they need to launch and scale a profitable vending machine business with minimal time investment.",
  ],
  cta: { label: "Apply Now", href: "/apply" },
} as const;

export const partnerLogos: ReadonlyArray<{ name: string; src?: string }> = [
  { name: "365 Markets" },
  { name: "Alani Nu" },
  { name: "Cantaloupe" },
  { name: "Micromart" },
  { name: "PepsiCo" },
  { name: "Prime" },
  { name: "Poppi" },
  { name: "Doritos" },
];

export const benefits = {
  eyebrow: undefined,
  title: "Why Vendingpreneurs?",
  body: "Building a vending machine business without expert guidance can lead to wasted time and costly mistakes. We eliminate the guesswork by providing a structured roadmap to success.",
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
  cta: { label: "Apply Now", href: "/apply" },
} as const;
