// Copy + data for the custom /apply landing page. Every visible string on the
// page traces back to this module (per the page/component conventions) so the
// marketing + compliance copy stays reviewable as data. Income claims are
// reproduced verbatim from Kody's approved mockup — do NOT reword or soften
// them; compliance review is a pre-publish step owned by the client.

export type ToolIconKey = "course" | "coaching" | "discounts" | "community";

/** A run of copy that may carry emphasis, so bolded phrases stay in content. */
export type RichSegment = { text: string; strong?: boolean };

export const applyMeta = {
  title: "Apply",
  description:
    "Launch your vending business in 90 days with Mike's playbook, systems, coaching, and exclusive discounts. Answer a few quick questions to see if you're a fit.",
} as const;

export const applyHero = {
  eyebrow: "For anyone done trading time for one paycheck",
  headline: "Launch your vending business in 90 days.",
  subheadline: {
    prefix: "Earn ",
    highlight: "$1–$5,000/mo*",
    suffix: " while you sleep.",
  },
  body: "You get Mike's playbook, systems, and scripts, plus exclusive product discounts, 1:1 support, and custom tools. Everything you need to launch quickly and build your route without costly mistakes.",
  ctaLabel: "I'm Ready to Build My Route",
  ctaNote:
    "Answer a few quick questions, then book a free call to see if you're a fit.",
  availabilityNote:
    "Availability is capped by market. Yours may still be open.",
} as const;

export const applyVsl = {
  badge: "Free training",
  watchLabel: "Watch Mike's story",
  youtubeId: "P-Z1BZ9M-Fg",
  videoHref: "https://youtu.be/P-Z1BZ9M-Fg",
  caption: [
    { text: "That's " },
    { text: "Mike Hoffmann", strong: true },
    {
      text: ". He built an AI-powered smart vending portfolio across multiple states — today his own route does over ",
    },
    { text: "$50,000/month", strong: true },
    {
      text: " — then turned the exact system into the playbook and tools Vendingpreneurs members run now.",
    },
  ] satisfies RichSegment[],
} as const;

export const applyTools = {
  eyebrow: "What you get",
  title: "Exclusive access to proven tools & systems",
  body: "Building a vending business without guidance means wasted time and costly mistakes. We remove the guesswork with a structured roadmap, proprietary resources, and custom tools.",
  ctaLabel: "I'm Ready to Build My Route",
  items: [
    {
      icon: "course" as ToolIconKey,
      title: "Vending Accelerator Course",
      body: "Step-by-step lessons from your first pop-in to a full route, with scripts and contracts built in.",
    },
    {
      icon: "coaching" as ToolIconKey,
      title: "Expert Coaching & Support",
      body: "Weekly coaching calls plus 1-on-1 ambassador sessions to sharpen your locations, pitches, and product.",
    },
    {
      icon: "discounts" as ToolIconKey,
      title: "Exclusive Discounts",
      body: "Pre-negotiated machine deals and below-retail product across 5,000+ SKUs, so more of every sale stays yours.",
    },
    {
      icon: "community" as ToolIconKey,
      title: "A Community of Entrepreneurs",
      body: "Operators trading locations, planograms, and real answers every day, so you're never alone.",
    },
  ],
} as const;

export const applyTestimonials = {
  eyebrow: "Real results",
  title: "What people are saying",
  shortQuotes: [
    {
      name: "Anthony",
      quote: "“We have 45 locations, 77 machines, and did $98,000 last month…”",
      // No headshot delivered yet — leave unset until Kody supplies
      // public/apply/people/anthony.jpg (see asset manifest). Card renders a
      // clean no-photo layout instead of a placeholder/initial avatar.
      image: undefined as string | undefined,
    },
    {
      name: "Shannon",
      quote: "“With just 4 locations, I’m doing $25,000 a month in revenue…”",
      // public/apply/people/shannon.jpg once delivered.
      image: undefined as string | undefined,
    },
    {
      name: "Thomas",
      quote:
        "“In a few months, I went from zero experience to $5K profit a month!”",
      // public/apply/people/thomas.jpg once delivered.
      image: undefined as string | undefined,
    },
  ],
  featured: {
    quote:
      "“You will exponentially increase your chances of succeeding and shorten the learning curve.”",
    attribution: "DJ Fuchs · 4 → 33 machines in 12 months",
  },
  moreTitle: "More from the community",
  reviews: [
    {
      name: "Charles Wheeler",
      org: "DenCo Vending LLC",
      body: "High school football coach in Texas, no prior vending or business experience. Placed his first market 4 months after joining, now 7 months in with 5 markets live and 2 more on the way.",
    },
    {
      name: "Kelsey Corcoran",
      org: "Super Foods Distribution",
      body: "“Less than three months in and I've already gained more than I expected. I spent years wishing I knew how to do this — so glad I finally found Mike and this community to learn it.”",
    },
    {
      name: "Abby C",
      org: "Van Pelt Vending",
      body: "“We joined with zero vending knowledge and got our four kids involved. We've gone from zero machines to 30+ in about a year. Best decision, highly recommend.”",
    },
    {
      name: "Dennis & Michelle Dewitt",
      org: "JC Vending",
      body: "“No experience before joining. The community has been a wealth of knowledge — people willing to dive in, make mistakes, learn, and share so others don't repeat them.”",
    },
  ],
} as const;

export const applyRoadmap = {
  eyebrow: "The roadmap",
  title: "What you'll build in 90 days",
  body: "Doing this alone usually means 18–24 months of expensive mistakes. Here's the path members follow instead.",
  ctaLabel: "I'm Ready to Build My Route",
  phases: [
    {
      num: "01",
      range: "Days 0–30",
      title: "Land your first location.",
      body: "Find high-traffic spots, walk in, and close them, backed by a platform showing every viable location in your market.",
    },
    {
      num: "02",
      range: "Days 30–60",
      title: "Get your first machine earning.",
      body: "Placed and stocked with member pricing and rebates. You start reading real sales data and dialing in product.",
    },
    {
      num: "03",
      range: "Days 60–90",
      title: "Optimize and line up the next.",
      body: "Tighten location one, then decide on location two. This is where it starts to feel like a business.",
    },
  ],
} as const;

export const applyMembers = {
  eyebrow: "Real members",
  title: "Regular people who ran the system",
  // No headshots delivered yet — every `image` is unset, so cards render the
  // clean no-photo layout instead of a placeholder/initial avatar. Once Kody
  // supplies public/apply/people/<slug>.jpg, set the path and the card
  // switches to the real photo automatically.
  members: [
    {
      name: "DJ Fuchs",
      result: "4 to 33 machines in 12 months.",
      image: undefined as string | undefined, // people/dj-fuchs.jpg
    },
    {
      name: "Graham & Katie Parker",
      result:
        "Built to $36k/month and growing toward $60k, without quitting their first job.",
      image: undefined as string | undefined, // people/graham-katie-parker.jpg
    },
    {
      name: "Madison Graves",
      result:
        "Stay-at-home mom, 6 locations in 10 months, 9 more under contract.",
      image: undefined as string | undefined, // people/madison-graves.jpg
    },
    {
      name: "Joe Natoli",
      result:
        "Built a route around his own schedule, now $5k/month and closing on 20 locations.",
      image: undefined as string | undefined, // people/joe-natoli.jpg
    },
    {
      name: "Matt Morrison",
      result:
        "Still at his 9-to-5, now runs 21+ locations doing over $40k/month.",
      image: undefined as string | undefined, // people/matt-morrison.jpg
    },
  ],
} as const;

export const applyFaq = {
  eyebrow: "Questions",
  title: "Good to know",
  items: [
    {
      q: "How is this different from a course?",
      a: "A course is videos you watch alone. This is a live operator community, weekly coaching, 1-on-1 ambassadors, and group pricing — you build the business, you don't just study it.",
    },
    {
      q: "How long until my first machine?",
      a: "Most members land their first location within the first few weeks. A profitable route builds over the months after.",
    },
    {
      q: "Do I need experience?",
      a: "No. Mike and most members started with none.",
    },
    {
      q: "Can I do this with a full-time job?",
      a: "Yes. It's built to run alongside a 9-to-5 — every member here kept theirs.",
    },
    {
      q: "Is this passive income?",
      a: "No. Early on it takes real hours. The goal is a route that eventually runs without you.",
    },
  ],
} as const;

export const applyQuiz = {
  eyebrow: "Join the Vending Accelerator Program",
  title: "See if you're ready to launch",
  body: "Answer a few quick questions, then book a free call to build your plan.",
  submitLabel: "See if I qualify",
  rail: {
    quote: "“With just 4 locations, I'm doing $25,000 a month in revenue.”",
    attribution: "Shannon · Member",
    stats: [
      { value: "850+", label: "entrepreneurs launched" },
      { value: "3,000+", label: "locations placed" },
    ],
    availabilityNote: "Availability is capped by market.",
  },
} as const;

export const applyYouTube = {
  eyebrow: "Free on YouTube",
  title: "Prefer to learn before you talk to anyone?",
  channelLabel: "youtube.com/@Vendingpreneurs",
  channelHref: "https://youtube.com/@Vendingpreneurs",
  ctaLabel: "I'm Ready to Build My Route",
  groups: [
    {
      title: "Getting Started",
      videos: [
        {
          title:
            "How To Start A Vending Machine Business Step-By-Step (With $0)",
          url: "https://www.youtube.com/watch?v=5_3p_j5tFfw",
        },
        {
          title: "Everything You Need to Purchase Your First Vending Machine",
          url: "https://www.youtube.com/watch?v=3HDu68I0_-o",
        },
        {
          title: "How Much Does It REALLY Cost To Run A Vending Business?",
          url: "https://www.youtube.com/watch?v=N_ngRamnoTE",
        },
      ],
    },
    {
      title: "Real People. Real Success.",
      videos: [
        {
          title: "What His First 30 Days in Vending Really Looked Like",
          url: "https://www.youtube.com/watch?v=MmVigkdyzL4",
        },
        {
          title: "Full-Time Job, Two Kids… Now It's $4K/Month",
          url: "https://www.youtube.com/watch?v=io1Jkei-yFs",
        },
        {
          title: "How She Turned One Vending Location Into $25K/Month",
          url: "https://www.youtube.com/watch?v=yP4Y_BBAvq4",
        },
      ],
    },
  ],
} as const;

export const applyFooter = {
  disclaimer:
    "*Earnings may vary and are not guaranteed. The $1–$5,000 claim is based on the average profitability of our community members' machines. Outcomes depend on effort, market, and execution.",
  privacyNote:
    "By applying you agree to our Privacy Policy. We never sell your data.",
  // Light/transparent wordmark for the dark disclaimer band. Not delivered
  // yet — until public/apply/vendingpreneurs-logo-light.svg exists, the band
  // falls back to the text wordmark (clean, not a placeholder face).
  lightLogo: "/apply/vendingpreneurs-logo-light.svg",
} as const;

export const applySticky = {
  text: "Don't wait. Launch your vending route in 90 days.",
  ctaLabel: "I'm Ready to Build My Route",
} as const;

/** The in-page anchor every CTA scrolls to (the quiz section). */
export const APPLY_QUIZ_ANCHOR = "apply-form";
