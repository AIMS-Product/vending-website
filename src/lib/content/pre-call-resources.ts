// Copy for /pre-call-resources — the single link sales sends to a prospect
// after a strategy call is booked. Replaced 2026-09-15 with marketing's full
// rewrite (Google Doc 1MXoCYu7uTA1...), which swaps the single "Meet Mike"
// YouTube VSL for thirteen Vidalytics videos: an intro, six objection answers,
// and seven operator stories. Body copy is marketing's, reproduced verbatim;
// do not reword without them.
//
// Every `embedId` is a Vidalytics embed id under account erwZUUrS. See
// src/components/media/VidalyticsPlayer.tsx.

export const preCallMeta = {
  title: "Pre-Call Resources",
  description:
    "Watch these before your vending advising session — what the program costs, what you get, how locations and financing work, and how real operators built their routes.",
} as const;

export const preCallHero = {
  eyebrow: "Pre-call resources",
  title: "Get the most out of your vending advising session",
  embedId: "t7gH_0l6bVqv1cOb",
  paragraphs: [
    "We want to make sure you get the most out of your upcoming call with the Vendingpreneurs team! So, before you hop on, watch the following videos. You’ll get answers to common questions about running a vending business and the Vendingpreneurs program.",
    "That way, your call can be all about you and your potential route.",
  ],
} as const;

/** The six objection answers, in the order marketing laid them out. */
export const preCallResources = {
  title: "Your Pre-Call Resources",
  items: [
    {
      id: "cost-to-join",
      question: "What Does It Actually Cost to Join Vendingpreneurs?",
      embedId: "IaV_mwvewT7n98YX",
      answer:
        "Vendingpreneur pricing depends on the tier and add-ons you choose. After the first year, you’ll transition to a smaller recurring costs that gives you access to the community, tools, machine/product discounts, and any future updates.",
    },
    {
      id: "what-you-get",
      question: "What Do You Get From the Program?",
      embedId: "aDmbcQCCZT_cvmwg",
      answer:
        "Every member gets guided onboarding and full community access to the community from day one, including calls, tools, and vendor partnerships. Beyond that, your access to leads, coaching, and additional resources scales with the tier and level of support you choose.",
    },
    {
      id: "securing-locations",
      question: "Do You Help Me Secure Locations for Vending Machines?",
      embedId: "VVyREGvkL93bpwkh",
      answer:
        "Vendingpreneurs gives you a custom-built tool to find, organize, and reach out to potential locations, cutting down what would normally take weeks of legwork. As you build consistency in the program, additional nationally sourced opportunities may become available.",
    },
    {
      id: "machine-cost",
      question:
        "What Does a Vending Machine Cost? Is it Less Expensive Through You?",
      embedId: "1rlrA2otFcLsTslx",
      answer:
        "Machine costs vary depending on size, type, and features, and buying at retail adds up fast. Vendingpreneurs members get access to discounted pricing, rebates, and credit offers that change what you actually pay out of pocket.",
    },
    {
      id: "financing",
      question:
        "Do You Offer Financing? How Healthy Does My Credit Need to Be?",
      embedId: "wSYT3LtwDcazRfOx",
      answer:
        "Financing is available through lending partners set up specifically for this program, with options that can include little to nothing down. Your credit profile plays a role in which options are available to you.",
    },
    {
      id: "what-youll-learn",
      question: "What Will I Actually Learn From My Vending Business?",
      embedId: "BPOJ0S_nf2M5B8IP",
      answer:
        "Earnings vary based on your locations, product mix, and how many machines you're running. The bigger numbers you've likely heard about come from routes (multiple machines in multiple locations) built over time, not a single machine, and there's a consistent formula behind every one of them.",
    },
  ],
} as const;

/**
 * Operator stories. These are a different, newer set from the four videos on
 * /case-studies — that page keeps its own list; this one links out to it.
 */
export const preCallOperators = {
  title: "Hear From Current VendingPreneur Operators",
  items: [
    {
      id: "shannon-r",
      name: "Shannon R.",
      embedId: "9fJu4zEUU2VSjD1K",
      blurb:
        "Shannon relocated to Seattle for her husband's job, started vending to help fund a home remodel, and turned one micro market into $22-25K a month.",
    },
    {
      id: "jesse-lee",
      name: "Jesse Lee",
      embedId: "VhBEa5DZsGtnKkHJ",
      blurb:
        "A food-truck owner, facing a saturated, seasonal market, bought an 18-location drink route, doing $7,000/month within his first 30 days in vending.",
    },
    {
      id: "graham-katie-parker",
      name: "Graham & Katie Parker",
      embedId: "RwOUq4VZcQtFH_yk",
      blurb:
        "A 20-year medical device sales rep and his stay-at-home wife, both once burned flipping houses, built a vending route to $36K/month in about a year.",
    },
    {
      id: "joe-h",
      name: "Joe H.",
      embedId: "ulQZmXSCqGGiSrrg",
      blurb:
        "A 66-year-old retiring from auto sales built a 15-location vending route mostly on his own, drawn in by vending's low capital threshold.",
    },
    {
      id: "matthew-morrison",
      name: "Matthew Morrison",
      embedId: "pW5bzDBuhVIVe6fD",
      blurb:
        "A Denver-based software sales manager started vending on paternity leave as an AI-layoff hedge, growing to about $43K a month across roughly 40 machines.",
    },
    {
      id: "musa-sadi",
      name: "Musa Sadi",
      embedId: "TVEcsYOkteZsDDSK",
      blurb:
        "Musa Sadi was a burned-out hospitality manager who tragically lost his mother and brother in 2025. He binged every video on our founder Mike Hoffman's YouTube channel in one overnight sitting and less than a year after joining Vendingpreneurs, he hit $41,000 a month.",
    },
    {
      id: "manuel-duval",
      name: "Manuel Duval",
      embedId: "FXc8GUF0L3jwq2Z4",
      blurb:
        "A 22-year law enforcement veteran and detective sergeant built a 10-location vending route around his full-time job, with one location on track for $8K.",
    },
    {
      id: "madison-g",
      name: "Madison G.",
      embedId: "mLCe2YfuWrE0CJHN",
      blurb:
        "A stay-at-home mom of five years pushed her husband for three months to back a vending business, and ten months later runs six locations doing $10-12K a month.",
    },
  ],
  moreCta: { label: "View More Case Studies", href: "/case-studies" },
} as const;

/**
 * Live preview of the community wins board. Cards are fetched at render time
 * from wins.vendingpreneurs.com's public feed — see PreCallWins. That board
 * only publishes rows a human approved, so nothing unreviewed can appear here.
 */
export const preCallWins = {
  eyebrow: "Recent wins",
  title: "Posted by members this month.",
  body: "Straight from the community feed — first contracts, first machines live, and new locations, in members' own words.",
  // The feed takes no parameters — it serves a fixed window that consumers
  // slice. See `PREVIEW_COUNT` in PreCallResourcesPage.
  feedUrl: "https://wins.vendingpreneurs.com/api/wins",
  cta: { label: "Browse every win", href: "https://wins.vendingpreneurs.com" },
} as const;

export const preCallPrep = {
  eyebrow: "Before we talk",
  title: "Come to the call with these four things.",
  body: "A focused call is easier when the business basics are already clear.",
  items: [
    "Know the city or region where you want to place machines.",
    "Bring any location, machine, or financing questions you already have.",
    "Review your available budget and the timeline you want to work toward.",
    "Know your goals and why you want to develop income that you truly own - this will be your north star throughout the program.",
  ],
} as const;

export const preCallNext = {
  title: "Haven't booked your call yet?",
  body: "Grab a time that works for you and we'll walk through your situation together.",
  cta: { label: "Book Your Free Strategy Call", href: "/contact" },
} as const;
