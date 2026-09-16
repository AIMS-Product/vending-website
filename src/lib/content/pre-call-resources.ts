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
    "Watch these before your vending advising session: what the program costs, what you get, how locations and financing work, and how real operators built their routes.",
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
      // Jess, Slack 2026-09-15: the heading said "Learn" but Mike answers
      // "Earn", which is also what the copy below it is about.
      id: "what-youll-earn",
      question: "What Will I Actually Earn From My Vending Business?",
      embedId: "BPOJ0S_nf2M5B8IP",
      answer:
        "Earnings vary based on your locations, product mix, and how many machines you're running. The bigger numbers you've likely heard about come from routes (multiple machines in multiple locations) built over time, not a single machine, and there's a consistent formula behind every one of them.",
    },
  ],
} as const;

/**
 * Operator stories, grouped by outcome.
 *
 * Grouped rather than listed flat (2026-09-16, Adam): a page of eight winners
 * reads as a page of eight winners. Showing the ceiling, the middle and the
 * slowest starts together is the thing that makes any of it believable — the
 * reader can see we did not hide the bottom of the range.
 *
 * The three `hardest` entries with an `href` instead of an `embedId` are
 * existing published articles on /case-studies, not new videos. Nothing here
 * is invented: every figure is the member's own, already published.
 *
 * Videos are marketing's set from the 2026-09-15 rewrite; their eight blurbs
 * are reproduced verbatim as before. Tier labels, notes, the disclaimer and
 * the three article blurbs are new copy and need Jess's sign-off before live.
 */
export const preCallOperatorTiers = [
  {
    id: "high",
    label: "Top success stories",
    note: "$20K a month and up. The top of what we publish, not what a first year looks like.",
  },
  {
    id: "middle",
    label: "Middle of the road",
    note: "$10K to $20K a month. Routes built around a job, a family, or both.",
  },
  {
    id: "hardest",
    label: "Rocky starts",
    note: "Under $10K a month, and most of them are still early. These took the longest, or nearly did not happen at all. We publish them for the same reason we publish the rest.",
  },
] as const;

export type PreCallOperatorTierId = (typeof preCallOperatorTiers)[number]["id"];

export const preCallOperators = {
  title: "Hear From Current VendingPreneur Operators",
  /**
   * Sits under the h2, above the first tier. Ranking stories by revenue
   * invites the reader to read a tier as a promise, so say plainly what the
   * numbers are: one member's topline, in their words.
   */
  /**
   * `stats` is the scannable version of what each blurb already says. Every
   * value is cross-checked against that member's own blurb and their
   * data/case-studies entry, so the row can never contradict the prose next to
   * it. A member with no published figure for an axis simply has a shorter
   * row — never a placeholder, never a rounded-up guess.
   */
  disclaimer:
    "Every number below is that member\u2019s own topline revenue, in their own words on camera. What a route earns depends on its locations, its machines, and the work behind it.",
  items: [
    {
      id: "matthew-morrison",
      stats: ["$43K/mo", "40 machines", "20 locations", "About two years in"],
      tier: "high",
      name: "Matthew Morrison",
      embedId: "pW5bzDBuhVIVe6fD",
      blurb:
        "A Denver-based software sales manager started vending on paternity leave as an AI-layoff hedge, growing to about $43K a month across roughly 40 machines.",
    },
    {
      id: "musa-sadi",
      stats: ["$41K/mo", "22 locations", "11 months in"],
      tier: "high",
      name: "Musa Sadi",
      embedId: "TVEcsYOkteZsDDSK",
      blurb:
        "Musa Sadi was a burned-out hospitality manager who tragically lost his mother and brother in 2025. He binged every video on our founder Mike Hoffman\u2019s YouTube channel in one overnight sitting and less than a year after joining Vendingpreneurs, he hit $41,000 a month.",
    },
    {
      id: "graham-katie-parker",
      stats: ["$36K/mo", "16 machines", "About a year in"],
      tier: "high",
      name: "Graham & Katie Parker",
      embedId: "RwOUq4VZcQtFH_yk",
      blurb:
        "A 20-year medical device sales rep and his stay-at-home wife, both once burned flipping houses, built a vending route to $36K/month in about a year.",
    },
    {
      id: "shannon-r",
      stats: ["$22\u201325K/mo", "4 locations", "18 months in"],
      tier: "high",
      name: "Shannon R.",
      embedId: "9fJu4zEUU2VSjD1K",
      blurb:
        "Shannon relocated to Seattle for her husband\u2019s job, started vending to help fund a home remodel, and turned one micro market into $22-25K a month.",
    },
    {
      id: "tyrone-lewis",
      stats: ["$12K/mo", "7 locations", "4 months to his first install"],
      tier: "middle",
      name: "Thyrone Lewis",
      href: "/case-studies/tyrone-lewis",
      blurb:
        "Four months of pop-ins without landing a single location. He joined in August and his first install did not come until mid-December. His route is seven locations doing about $12,000 a month now.",
      quote:
        "I\u2019m not going to lie to you, I almost gave up\u2026 Before that I felt like I was just walking against the wind.",
    },
    {
      id: "madison-g",
      stats: ["$10\u201312K/mo", "6 locations", "10 months in"],
      tier: "middle",
      name: "Madison G.",
      embedId: "mLCe2YfuWrE0CJHN",
      blurb:
        "A stay-at-home mom of five years pushed her husband for three months to back a vending business, and ten months later runs six locations doing $10-12K a month.",
    },
    {
      id: "manuel-duval",
      stats: ["$10.5K/mo", "10 locations", "Around a full-time job"],
      tier: "middle",
      name: "Manuel Duval",
      embedId: "FXc8GUF0L3jwq2Z4",
      blurb:
        "A 22-year law enforcement veteran and detective sergeant built a 10-location vending route around his full-time job, with one location on track for $8K.",
    },
    {
      id: "jesse-lee",
      stats: ["$7K/mo", "18 locations", "30 days in"],
      tier: "hardest",
      name: "Jesse Lee",
      embedId: "VhBEa5DZsGtnKkHJ",
      blurb:
        "A food-truck owner, facing a saturated, seasonal market, bought an 18-location drink route, doing $7,000/month within his first 30 days in vending.",
    },
    {
      // Adam spells him "Evan Thammahong"; his published article and its JSON
      // say "Evan Tomahong". The card uses the article's spelling so the link
      // does not read as a different person -- fix both together, not one.
      id: "evan-tomahong",
      tier: "hardest",
      name: "Evan Tomahong",
      stats: ["$7K/mo", "6 months to his first placement"],
      href: "/case-studies/evan-tomahong",
      blurb:
        "A law-school graduate who left investment banking compliance work, then spent six months before he secured a single placement. His route was doing close to $7K a month inside the first year.",
      quote:
        "Although it\u2019s scary and there\u2019s a lot of risk involved, you\u2019re the one that\u2019s in control of your own journey.",
    },
    {
      id: "joe-h",
      stats: ["$5.5K/mo", "15 locations", "Three years in"],
      tier: "hardest",
      name: "Joe H.",
      embedId: "ulQZmXSCqGGiSrrg",
      blurb:
        "A 66-year-old retiring from auto sales built a 15-location vending route mostly on his own, drawn in by vending\u2019s low capital threshold.",
    },
    {
      id: "mallorie-rauch",
      stats: [
        "$4K/mo",
        "6 locations",
        "Around a full-time job",
        "Joined March 2025",
      ],
      tier: "hardest",
      name: "Mallorie Rauch",
      href: "/case-studies/mallerie-rouch",
      blurb:
        "A physician assistant with two kids and a full-time job. Her first two machines sat in storage before she turned them into a six-location route doing $4K a month.",
      quote:
        "When everybody tells me \u2018I don\u2019t have time for this,\u2019 I\u2019m like, \u2018Call me. Let me tell you about time.\u2019",
    },
  ],
  moreCta: { label: "View More Case Studies", href: "/case-studies" },
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
