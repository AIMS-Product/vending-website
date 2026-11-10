type NewsSeoMeta = { title: string; description: string };

// Search titles and descriptions, separate from the on-page headline because
// news_posts has no SEO columns. Titles fit 60 characters and lead with the
// term the page already gets impressions for in Search Console. Descriptions
// say what the page covers and add no figures of their own.
const NEWS_SEO_META: Readonly<Record<string, NewsSeoMeta>> = {
  "how-much-money-do-vending-machines-make-2026": {
    title: "How Much Do Vending Machines Make? 2026 Profit Guide",
    description:
      "How much money vending machines make: revenue and profit per machine, what drives income, real running costs, and how to calculate your own numbers.",
  },
  "top-10-profitable-products-to-stock-in-your-vending-machine": {
    title: "Most Profitable Vending Machine Items and Snacks (2026)",
    description:
      "The most profitable vending machine items and snacks, why they sell, and how to choose the right product mix for your location.",
  },
  "best-vending-locations": {
    title: "Best Vending Machine Locations and How to Secure Them",
    description:
      "How to find the best vending machine locations, judge whether a spot will sell, and win the placement from the property owner.",
  },
  "expected-costs-earnings-roi-vending-machines-2025": {
    title: "Vending Machine ROI: Realistic Costs and Earnings",
    description:
      "What vending machines cost, what they can earn, and how to work out a realistic return on investment before you buy.",
  },
  "from-zero-to-first-vending-machine-guide": {
    title: "How to Get Your First Vending Machine: Step-by-Step",
    description:
      "A step-by-step guide from zero to your first vending machine: startup costs, business setup, choosing a machine, and securing a location.",
  },
  "how-to-build-a-self-managed-route-so-you-can-work-less": {
    title: "How to Build a Self-Managed Vending Route",
    description:
      "How to build a self-managed vending route: telemetry, smarter restocking, and the systems that cut the time you spend servicing machines.",
  },
  "smart-vending-cashless-payments-iot": {
    title: "Smart Vending: Cashless Payments and IoT Machines",
    description:
      "How cashless payments and IoT machines are changing the vending business, and what smart vending means for new and existing operators.",
  },
  "top-5-questions-vending-entrepreneurship-program": {
    title: "5 Questions to Ask Before Joining a Vending Program",
    description:
      "Five questions to ask before joining a vending program: training quality, help securing locations, startup costs, track record, and ongoing tools.",
  },
  "top-8-vendpreneur-mistakes-how-to-fix-them": {
    title: "8 Vending Business Mistakes and How to Fix Them",
    description:
      "The eight mistakes new vending operators make most often, from location research to contracts, and exactly how to fix each one.",
  },
  "vending-business-taxes-us-beginners-guide": {
    title: "Vending Business Taxes: A US Beginner's Guide",
    description:
      "A beginner's guide to vending business taxes in the US: sales tax, income and self-employment tax, deductions, and common pitfalls.",
  },
  "vending-machine-business-legal-tax-licensing-2025": {
    title: "Vending Business Legal, Tax and Licensing Guide (US)",
    description:
      "The legal, tax, and licensing basics of starting a vending machine business in the US: business structure, permits, and compliance.",
  },
  "vending-machine-business-passive-income": {
    title: "Is a Vending Machine Business Passive Income?",
    description:
      "Is a vending machine business really passive income? What the work actually involves, where the myths come from, and what to expect.",
  },
};

export function newsSeoMeta(slug: string): NewsSeoMeta | undefined {
  return NEWS_SEO_META[slug];
}

export const newsSeoMetaEntries = Object.entries(NEWS_SEO_META);
