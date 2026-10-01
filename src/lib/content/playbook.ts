/**
 * Mike Hoffmann's Playbook (the Profit Machine System) low-ticket offer,
 * rebuilt from the GHL page webinar.vendingpreneurs.com/playbook
 * (captured 2026-09-30). Payments stay in GHL: every buy CTA goes to the GHL
 * order form. Income figures and testimonials are the approved GHL wording,
 * shortened by omission only, never reworded (including its own typos).
 */

export const PLAYBOOK_PATH = "/playbook";
export const GHL_CHECKOUT_URL = "https://webinar.vendingpreneurs.com/checkout";

export const PRICE = {
  anchor: "$199",
  today: "$67",
  save: "Save $132 today",
};

/** Ad-click parameters carried onto the checkout link. */
export const PLAYBOOK_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

/**
 * Order-form prefill. Verified in the GHL order-form bundle, which reads these
 * from the page query on mount: full_name, company_name, email, phone,
 * postal_code, address, state, city, country. Only the name is passed: email and
 * phone in a URL end up in logs, analytics and referrers (review 2026-09-30).
 */

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 200) || undefined;

/** The allowed attribution and prefill params, in a stable order. */
export function pickPlaybookParams(params: SearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of PLAYBOOK_ATTRIBUTION_KEYS) {
    const value = first(params[key]);
    if (value) out.set(key, value);
  }
  const fullName =
    first(params.full_name) ??
    first(params.name) ??
    [first(params.first_name), first(params.last_name)]
      .filter(Boolean)
      .join(" ");
  if (fullName) out.set("full_name", fullName);
  return out;
}

const withQuery = (base: string, query: URLSearchParams) =>
  query.size ? `${base}?${query.toString()}` : base;

export const checkoutHref = (params: SearchParams = {}) =>
  withQuery(GHL_CHECKOUT_URL, pickPlaybookParams(params));

export const playbookHref = (params: SearchParams = {}) =>
  withQuery(PLAYBOOK_PATH, pickPlaybookParams(params));

/** The one buy label above the final checkout card (which says "Get Instant Access"). */
export const BUY_CTA = "Yes, I Want Mike's Playbook";

export const images = {
  product: {
    src: "/images/playbook/hero-mockup.png",
    alt: "Mike Hoffmann's Playbook and its bonus kits",
    width: 1200,
    height: 630,
  },
  /** Same art with its transparent padding cropped, for tight tint panels. */
  productTrimmed: {
    src: "/images/playbook/playbook-mockup-trimmed.png",
    alt: "Mike Hoffmann's Playbook and its bonus kits",
    width: 1138,
    height: 514,
  },
  mike: {
    src: "/images/playbook/mike-family.webp",
    alt: "Mike Hoffmann",
    width: 800,
    height: 1074,
  },
  results: {
    src: "/images/playbook/testimonial-avatars.png",
    alt: "Anthony, Shannon and Thomas share their results",
    width: 1024,
    height: 923,
  },
} as const;

/** Site-owned member photos, the same people the story cards name. */
const storyPhotos = {
  anthony: {
    src: "/images/newsletter/anthony-kolodziej.webp",
    alt: "Anthony Kolodziej with his son",
    width: 720,
    height: 720,
  },
} as const;

export const hero = {
  eyebrow: "Get Mike Hoffmann's Playbook",
  headline: "Exact Course Anthony Used to exceed 120k$ in monthly revenue",
  highlight: "120k$",
  availability: "Now Available For Instant Access",
  /** GHL's line above the offer on its thank-you flow. */
  teaserHeadline: "Grab this bonus before the webinar",
  teaserBullets: [
    "Find it. Decide on a location in minutes with the same parking/availability/visibility checks Mike runs on every spot, before you spend a dollar on a machine.",
    "Close it. Walk in with Mike's own scripts, so the conversation with a property manager feels like offering an amenity, not begging for space.",
    "Run it. Stock, price, and restock using the exact margin rules that separate a 30% route from a 50% one.",
  ],
};

export const steps = {
  title: ["Find The Location.", "Close The Deal.", "Run The Route. Repeat."],
  items: [
    {
      label: "Find it",
      text: "Decide on a location in minutes with the same parking/availability/visibility checks Mike runs on every spot, before you spend a dollar on a machine.",
    },
    {
      label: "Close it",
      text: "Walk in with Mike's own scripts, so the conversation with a property manager feels like offering an amenity, not begging for space.",
    },
    {
      label: "Run it",
      text: "Stock, price, and restock using the exact margin rules that separate a 30% route from a 50% one.",
    },
    {
      label: "Repeat it",
      text: "Turn one happy location into your next one, using the same “land and expand” approach Mike uses to grow his own route.",
    },
  ],
};

export const curriculum = {
  title:
    "Here's Exactly What You Get Inside The Profit Machine System For Just",
  chapters: [
    {
      lessons: "Lessons 1-3",
      title: "Introduction & Opportunity Overview",
      points: [
        "Why vending looks fundamentally different in 2026 than it did a decade ago",
        "The unattended retail shift driving demand for smart machines right now",
        "A real side-by-side of smart machine versus a traditional vending setup, and what that difference means for your bottom line",
      ],
    },
    {
      lessons: "Lessons 4-5",
      title: "Revenue Potential & Profit Breakdown",
      points: [
        "Real daily revenue examples pulled from actual machines",
        "A full breakdown of cost of goods, processing fees, and what's left as profit",
        "How to calculate true margin before committing to a location or machine",
      ],
    },
    {
      lessons: "Lessons 6-10",
      title: "Finding Profitable Locations",
      points: [
        "Why location matters more than machine, and how that changes your entire approach",
        "The three factors - parking, availability, visibility - Mike checks before pursuing any location",
        "A real example using manufacturing plants as a location type, and why they work",
      ],
    },
    {
      lessons: "Lessons 11-15",
      title: "Choosing the Right Machine",
      points: [
        "What to check in a supplier contract before signing anything",
        "eVending's zero-down outdoor machines, and when they make sense",
        "Cantaloupe's flexible open micro-market model",
      ],
    },
    {
      lessons: "Lessons 16-17",
      title: "Building a Better Business Foundation",
      points: [
        "How to form your LLC and set up the legal foundation correctly from day one",
        "The insurance types that matter, including inland marine coverage and why it applies to vending",
      ],
    },
    {
      lessons: "Lessons 18-21",
      title: "Inventory & Profit Optimization",
      points: [
        "Tracking sales data and doubling down on your bestsellers",
        "Mike's restocking strategy, including when and how to top off machines",
        "The margin trap that quietly costs beginners real money",
      ],
    },
    {
      title: "Scaling Operations",
      points: [
        "Scaling your route by adding locations strategically",
        "When and how to start hiring staff and delegating day-to-day tasks",
      ],
    },
  ],
};

export const includedBonuses = {
  items: [
    {
      title: "The Location Scorecard",
      text: "Score any location in minutes using the same parking/availability/visibility checks from Chapter 3.",
    },
    {
      title: "Mike's Location Closing Scripts",
      text: "The exact word-for-word scripts Mike uses to approach and close location decision-makers.",
    },
    {
      title: "Supplier Comparison Cheat Sheet",
      text: "A one-page recap of every machine provider from Chapter 4, side by side.",
    },
    {
      title: "LLC & Insurance Quick-Start Checklist",
      text: "The exact steps and coverage types from Chapter 5, laid out as a simple checklist.",
    },
    {
      title: "Profit & Restocking Tracker",
      text: "A simple template for tracking sales, margin, and restock timing from Chapter 6.",
    },
  ],
};

export const opportunity = {
  eyebrow: "THE OPPORTUNITY",
  headline: "PLACE ONE MACHINE. POTENTIAL TO COLLECT 3K - 8K/MO. REPEAT.",
  highlight: "3K - 8K/MO.",
  points: [
    {
      lead: "How Mike generates 100k/mo from 102 machines",
      tail: "- working just a few hours per week.",
    },
    {
      lead: "Place your first machine generating 3,000–8,000/mo in 30–90 days",
      tail: "- without quitting your job.",
    },
    {
      lead: "Start with ONE machine and scale from there",
      tail: "- no employees, no tenants, no 80-hour weeks.",
    },
    {
      lead: "The same system Anthony used",
      tail: "to go from laid off to 98k/mo with 45 locations.",
    },
    {
      lead: "Charles still teaches high school full-time",
      tail: "- his 4 machines pay him 20k/mo on the side.",
    },
    {
      lead: "Join 1,200+ members",
      tail: "who've placed 3,000+ locations generating 3M+ in combined revenue.",
    },
  ],
};

/**
 * The three quotes GHL showed as one flattened image (images.results), typed
 * verbatim from it. `crop` is each face's square in that 1024x923 image, so
 * the avatar is the same approved photo, cropped in CSS.
 */
export const opportunityQuotes = [
  {
    name: "Anthony",
    quote: "“We have 45 locations, 77 machines, and did $98,000 last month…”",
    crop: { x: 57, y: 57, size: 192 },
  },
  {
    name: "Shannon",
    quote: "“With just 4 locations, I’m doing $25,000 a month in revenue…”",
    crop: { x: 57, y: 357, size: 192 },
  },
  {
    name: "Thomas",
    quote:
      "“In a few months, I went from zero experience to $5K profit a month!”",
    crop: { x: 57, y: 658, size: 192 },
  },
] as const;

export const moreBonuses = {
  title: "Plus: Add 9 Powerful Bonuses",
  items: [
    {
      title: "Sales Closing Framework",
      points: [
        "The flow behind a 73% close rate on first meetings",
        "Scripts for every objection you'll ever hear",
        "How a teacher with zero skills landed 4 locations in 90 days",
      ],
    },
    {
      title: "90-Day Success Roadmap",
      points: [
        "Day-by-day breakdown for your first 30 days",
        "Compresses 6 months of learning into 90 days",
        "Accountability checkpoints so you never lose momentum",
      ],
    },
    {
      title: "Quick-Start Marketing Kit",
      points: [
        "Done-for-you Canva flyer & website templates",
        "Business cards that get kept, not tossed",
        "The same materials $20K/mo operators started with",
      ],
    },
    {
      title: "Location Lockdown Script",
      points: [
        "The script that secured 3,000+ locations",
        "Turns cold managers into eager partners",
        "Works for apartments, offices, warehouses, student housing",
      ],
    },
    {
      title: "Done-For-You Contract",
      points: [
        "Fill-in-the-blank contracts that lock in revenue",
        "Eliminates clauses that keep the majority",
        "Skip $2,000+ in attorney fees",
      ],
    },
    {
      title: "The Perfect Location Finder",
      points: [
        "12 factors that separate winners from money pits",
        "Score any location in under 10 minutes",
        "Eliminate the #1 beginner mistake",
      ],
    },
    {
      title: "The 'Get To Yes' Gift Kit",
      points: [
        "The $15 gift that closes more deals than a 20-min pitch",
        'The "leave-behind" that keeps you top-of-mind',
        "How one gift turns into 3-5 referrals",
      ],
    },
    {
      title: "Insurance Insider Playbook",
      points: [
        "Exactly which policies you need - and which waste money",
        "Full coverage for a fraction of the cost",
        "Insured in 30 minutes with one call",
      ],
    },
    {
      title: "Profit Tracking Template",
      points: [
        "Auto-calculate margins & track route efficiency",
        "See which machines are printing money",
        "The dashboard 50+ machine operators use daily",
      ],
    },
  ],
};

export const stats = [
  { value: "1,200+", label: "MEMBERS" },
  { value: "3,000+", label: "LOCATIONS PLACED" },
  { value: "$3M+", label: "COMBINED REVENUE" },
];

export const stories = {
  eyebrow: "SAME PLAYBOOK. DIFFERENT SUCCESS STORIES.",
  title: "What Happens When You Follow Mike's Process, Step-By-Step?",
  highlight: "Mike's Process",
  intro:
    "A food truck owner, a stay-at-home mom, a former real estate agent, and a first-time micro market operator - four different starting points, the same process, all profitable routes.",
  items: [
    // Members with a face in the approved group image lead, so the two
    // photo cards share a row.
    {
      name: "Shannon",
      text: "Using the same location-scoring process taught in Mike's Playbook, Shannon picked one Seattle micro market that became her 22,000 - 25,000/mo unicorn location on her first try.",
    },
    {
      name: "Anthony",
      photo: storyPhotos.anthony,
      text: "Former real estate entrepreneur, Anthony, followed this same process to scale to 45 locations and 79 machines, generating over 100k in revenue in one month.",
    },
    {
      name: "Jesse",
      text: "Jesse had three locations signed within his first 30 days. He credits the speed to having ready-made scripts and a process to follow instead of guessing alone.",
    },
    {
      name: "Madison",
      text: "Madison, a stay-at-home mom with no business background, used the Playbook process to build a 10,000+/mo route with just six locations in 10 months.",
    },
  ],
};

export const compare = {
  title: "Why This Beats Figuring it Out Alone",
  intro:
    "Keep grinding for a 3% raise, gamble $50K on rentals, or bet on a startup with a 90% failure rate - or place one machine that pays you whether you show up or not.",
  columns: ["Mike's Playbook", "Free info online", "Generic biz course"],
  rows: [
    ["Step-by-step order", "Yes", "No", "Sometimes"],
    ["Real scripts & templates", "Yes - Mike's own", "Rarely", "Rarely"],
    ["Built by an active operator", "Yes", "Unknown", "Rarely"],
    ["Vending-specific guidance", "Yes", "Scattered", "No"],
    ["Location scoring system", "Yes", "No", "No"],
  ],
};

export const host = {
  /** GHL's headline, "Meet Mike Hoffmann: From ...", split into eyebrow and title. */
  eyebrow: "Meet Mike Hoffmann",
  title:
    "From 60-Hour Work Weeks Making 1,200/Month to 150+ Machines Generating 200k/Month In Just a Few Years",
  highlight: "200k/Month",
  paragraphs: [
    "I grew up on a family farm in rural Iowa. I put myself through the University of Kansas, and for years I worked as a college strength and conditioning coach. My life consisted of long hours, a paycheck that never seemed to move, and a schedule that wasn't mine. The moment vending stopped being a curiosity and started being the plan is when I really started to see a change. My first machine brought in 600 a month. It wasn't life-changing, but it was proof.",
    "Today, my best location alone brings in over 22k in a single month, and I still run this business myself. Not because I have to, but because I built it to work, and I want to know it still works. Every script, template, and framework in this Playbook is what I'm using on my own route right now, not what I used to do five years ago.",
    "The part I care about most isn't my own numbers. It's watching regular people - people with a job, a family, a schedule already full - use this exact process to place their first machine and realize this is actually real. That's who this Playbook is for. Not someone looking for a get-rich-quick story. Someone who wants a real, proven way to build something that's theirs.",
  ],
};

export const faq = {
  title: "Frequently Asked Questions",
  items: [
    {
      q: "Do I need any experience to use this?",
      a: "No experience is required. The Playbook walks you through finding locations, closing deals, and running machines step by step from scratch.",
    },
    {
      q: "How much money do I need to get started?",
      a: "You can get started with very little capital. We demonstrate how to secure locations first and acquire machines with low upfront investment.",
    },
    {
      q: "Is this going to take over my life?",
      a: "No. Running a vending route takes just a few hours a week to restock and manage once your machines are placed.",
    },
    {
      q: "Is vending saturated?",
      a: "Not at all. Thousands of high-traffic locations like offices, apartment complexes, and warehouses are actively looking for reliable vending partners.",
    },
    {
      q: "What happens after I finish the Playbook?",
      a: "You will have actionable scripts, contract templates, insurance checklists, and a clear step-by-step roadmap to place your first machine and scale.",
    },
  ],
};

export const finalOffer = {
  badge: "EARLY BIRD SPECIAL · ACTIVATED",
  title: "Get Mike Hoffmann's Playbook Today",
  proof: "3,000 Active Vending Locations · $3M+ Combined Revenue",
  urgency: "Enrollment Closing Soon - Nearing Capacity",
  price: "$67",
  line: "One machine can pay 36k per year. Your investment: $67. Plus 9 free bonuses.",
  cta: "Yes! Get Instant Access",
  secure: "100% secure 256-bit encrypted checkout",
};

export const DISCLAIMER =
  "Results are not typical and are not a guarantee of your income. Figures shown reflect the experiences of specific individuals. Your results will vary based on effort, market and other factors.";
