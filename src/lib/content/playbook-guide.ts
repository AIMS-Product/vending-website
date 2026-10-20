/**
 * LTF V2 $5 PDF (plans/ltf-v2-pdf-ab): the one source for the offer page
 * (/playbook/guide) and the PDF itself (scripts/playbook-guide/build.ts).
 * Every tactic is taken from the linked video's transcript, Mike's (or
 * Anthony's) own words; figures are their worked examples, never a promise.
 * Copy approved by Adam 2026-10-19.
 */

export const GUIDE = {
  title: "The First Location Playbook",
  byline: "Mike Hoffmann",
  subtitle:
    "Eight plays to find, pitch, sign and stock your first vending location, each with one of Mike's videos and an assignment.",
  priceLabel: "$5",
  fileName: "First-Location-Playbook-Mike-Hoffmann.pdf",
} as const;

export type GuideVideo = { id: string; title: string; minutes: string };

export type GuidePlay = {
  number: string;
  title: string;
  /** One line for the offer page's contents list. */
  summary: string;
  why: string;
  /** The tactic: steps, a script, or a checklist. */
  steps: readonly string[];
  /** Optional word-for-word script box. */
  script?: { label: string; lines: readonly string[] };
  video: GuideVideo;
  assignment: { title: string; tasks: readonly string[] };
  /** A line from the video's transcript, quoted as said. */
  quote: { text: string; who: "Mike Hoffmann" | "Anthony Kolodziej" };
};

const yt = (id: string, title: string, minutes: string): GuideVideo => ({
  id,
  title,
  minutes,
});

export const plays: readonly GuidePlay[] = [
  {
    number: "01",
    title: "Location before machine",
    summary:
      "The golden rule: secure the spot, then pick the machine that fits it.",
    why: "The most common beginner mistake is buying a machine first. It sits in the garage for months, and when a location does show up it often needs different equipment.",
    steps: [
      "Step 1: find and secure your first location.",
      "Step 2: decide which machine fits that location.",
      "Step 3: only then buy the machine. Get a signed contract before you spend a dollar on equipment.",
      "Not sure how a location will perform? Start with one combo machine (half drinks, half snacks) or a smart cooler. If it sells, add a second machine next to it.",
    ],
    video: yt(
      "u26bPXzC4x8",
      "The Best Strategy To Buy Your First Vending Machine",
      "8 min",
    ),
    assignment: {
      title: "Commit to the order of operations",
      tasks: [
        "Write down, in one sentence, why you will not buy a machine this month.",
        "Block 5 hours on your calendar this week for location prospecting (Plays 02 to 04).",
      ],
    },
    quote: {
      text: "Do not buy a machine unless you have the location secured.",
      who: "Anthony Kolodziej",
    },
  },
  {
    number: "02",
    title: "Pick a location type you can win",
    summary:
      "The three location types Mike's route leans on, and why each one sells.",
    why: "Foot traffic and a captive audience decide revenue. Mike's three favorite types all have people who stay on site, at all hours, with no store nearby.",
    steps: [
      "Medical outpatient (urgent cares, pet hospitals): long waits, stressed visitors, night staff. Stock over-the-counter meds next to drinks and snacks.",
      "Residential (apartments 100+ units, senior living): residents are there 24/7, weekends included. Drinks first, then frozen, then late-night snacks and incidentals.",
      "Multi-shift warehouses and manufacturing plants: three shifts means breakfast, lunch and night-shift sales. Blue-collar crews buy 16oz Monsters and Rockstars, not trendy brands.",
      "Rule out what can't support a machine: 9-to-5 offices that work from home on Fridays are a combo-machine test at best.",
    ],
    video: yt(
      "p9ML5Cr_wXU",
      "I Tried 100+ Vending Locations, These 3 Are Most Profitable",
      "11 min",
    ),
    assignment: {
      title: "Choose your two target types",
      tasks: [
        "Pick two of the three location types to target first and write why each fits your area.",
        "For each, list the hours people are on site and the nearest store. Longer hours and a farther store are better.",
      ],
    },
    quote: {
      text: "Play up amenity, amenity, amenity. Don't even bring up the revenue.",
      who: "Mike Hoffmann",
    },
  },
  {
    number: "03",
    title: "Build a list of 25 targets",
    summary:
      "Google Maps plus one AI prompt turns your town into a call list in an hour.",
    why: "Finding locations is like baseball: three hits out of ten swings makes you an all-star. You need a long list, not one perfect lead.",
    steps: [
      "Search Google Maps for each target type plus your city (for example, 'manufacturing plants Salem Oregon').",
      "For each result, note the phone number and the website's contact page or HR/operations email.",
      "Look for buildings with many tenants or providers behind one lobby: multi-practice medical offices, sports complexes, batting cages, universities (ask for food and beverage).",
      "Run the prompt below to fill gaps, then verify every contact before you reach out.",
    ],
    script: {
      label: "Mike's AI prompt (swap in your city)",
      lines: [
        "I want to place an AI-powered vending machine in [CITY]. Give me a list of 20 high foot traffic locations that benefit from 24/7 convenience options. Focus on apartment complexes with 100 plus units, office buildings with multiple tenants, outpatient medical facilities and urgent cares, and manufacturing facilities with night shifts.",
        "For each location, provide the business name, approximate address, likely decision-maker title, email address of a POC, and a specific value proposition for why they need modern vending.",
        "Also, write me a three-sentence outreach script that emphasizes the amenity value, not revenue sharing.",
      ],
    },
    video: yt(
      "NJZzP1i8ytY",
      "The Easiest Way To Find Profitable Vending Machine Locations",
      "7 min",
    ),
    assignment: {
      title: "Fill the 25-target worksheet",
      tasks: [
        "Add 25 targets to the worksheet on the next page: name, type, decision-maker, phone, email.",
        "Star the 5 with the longest hours and the most people on site. Those get a pop-in first.",
      ],
    },
    quote: {
      text: "Finding profitable vending locations is just like baseball. You get three hits out of 10 swings and you're an all star.",
      who: "Mike Hoffmann",
    },
  },
  {
    number: "04",
    title: "Pitch an amenity, not a vending machine",
    summary:
      "The words that get a meeting, and the ones that lose it in the first sentence.",
    why: "Say 'vending' and the manager pictures the beat-up machine that only takes quarters and never gets serviced. You are offering a free modern amenity for their employees, patients or residents.",
    steps: [
      "Lead with their people: 'Are you trying to keep employees on site and happy?' beats 'Can I put my machine in your building?'",
      "Bring a small basket of the products you would stock. It shows you mean business.",
      "Offer a quick survey so their people pick what goes in the machine. It gives them ownership.",
      "Stack the value: equipment at no cost to them, full liability insurance, stocking, cleaning, maintenance and repairs handled by you.",
      "Ask for the next step before you leave: send the flyer and the contract, and say when you will swing by again.",
    ],
    script: {
      label: "First email (short on purpose)",
      lines: [
        "We provide modern vending and micro market solutions that offer healthy, fresh food to your employees.",
        "There is no cost to you and no machine cost to you.",
        "Do you have 10 minutes this week for a quick face-to-face?",
      ],
    },
    video: yt(
      "hyHYHt_S8Qo",
      "How To Negotiate Vending Machine Deals Like A PRO",
      "9 min",
    ),
    assignment: {
      title: "10 touches this week",
      tasks: [
        "Send the email above to 10 targets from your list.",
        "Pop in to your top 3 in person with a product basket.",
        "Log every reply and objection in the worksheet.",
      ],
    },
    quote: {
      text: "You say vending, you've already lost.",
      who: "Mike Hoffmann",
    },
  },
  {
    number: "05",
    title: "Flip the revenue share and handle objections",
    summary:
      "Mike's word-for-word answers to the five things every manager says.",
    why: "Over half of Mike's 100+ placements pay no revenue share. Most locations want the amenity, not the income, and they want you to stay in business.",
    steps: [
      "Never lead with revenue share. If they ask, flip it into a question (script below).",
      "Most deals close after 4 to 7 touches: intro, a day-3 'I'll be in the area' message, a week-2 success story, a week-3 'I have a machine ready if you sign' message.",
      "Make every follow-up useful: a nearby case, a competitor across town that has one, a limited number of machines available.",
    ],
    script: {
      label: "Objection answers",
      lines: [
        "Revenue share? 'Do you want to make money off this, or keep it an amenity? We can do a share, but we'd have to mark up the prices, and your people will complain.'",
        "We already have vending. 'Great. When was it last serviced? Want to check it for expired product together?'",
        "We don't have space. 'We need about six square feet, less than a refrigerator.'",
        "We need to think about it. 'Absolutely, it's an important decision. Do you think your employees would want an amenity like this?'",
        "Corporate needs to approve. 'Perfect. I'm part of a national community and brand. What validation do they need?'",
      ],
    },
    video: yt(
      "5fBSFAyb3Eo",
      "Use These Negotiation Tactics, They'll Blow Up Your Vending Business",
      "8 min",
    ),
    assignment: {
      title: "Rehearse out loud",
      tasks: [
        "Say each objection answer out loud three times, or role-play with someone.",
        "Schedule your day-3, week-2 and week-3 follow-ups for every target you contacted in Play 04.",
      ],
    },
    quote: {
      text: "Stop thinking like a vendor and start thinking like a partner. You're not asking for space. You're literally providing a free amenity.",
      who: "Mike Hoffmann",
    },
  },
  {
    number: "06",
    title: "Put the deal in writing",
    summary:
      "The five contract terms that keep a new manager from kicking you out.",
    why: "Operators lose thousands when a manager leaves and the new one wants the machine gone. The contract is what protects the money you put into the equipment.",
    steps: [
      "Term: at least 3 years, with auto renewal.",
      "Termination: 90 days' written notice (certified mail, receipt confirmed).",
      "Removal: 45 calendar days to remove the machine after notice.",
      "Placement: name the exact spot in the building (for example, 'next to the mailboxes') so it can't be moved to the 8th floor.",
      "Clawback: an early-termination fee that covers your equipment if they end it early.",
      "No revenue share written in unless you agreed to one in Play 05.",
    ],
    video: yt(
      "4wilxQmG6nY",
      "The BEST Contract To Use For Your Vending Business",
      "7 min",
    ),
    assignment: {
      title: "Draft your term sheet",
      tasks: [
        "Write a one-page term sheet with the six items above, filled in for your first target.",
        "Have it reviewed before you sign anything. This playbook is not legal advice.",
      ],
    },
    quote: {
      text: "Your location and your revenue is only as good as where they put the machine in the building.",
      who: "Mike Hoffmann",
    },
  },
  {
    number: "07",
    title: "Get the right machine without draining your cash",
    summary:
      "Which machine fits which location, and how financing keeps your cash free.",
    why: "Different locations need different machines, and paying cash up front leaves nothing for inventory or the next location.",
    steps: [
      "Combo machine: drinks and snacks in one unit. Best for a location you're unsure about.",
      "Smart cooler: locked door, cameras, card and phone pay. Best for apartments and places that care how it looks.",
      "Micro market: open shelves and a kiosk. Best for big break rooms with cameras.",
      "Outdoor machine: weatherproof, for pools, parks and rec facilities.",
      "Buy new with a card reader and inventory tracking. A cheap used, cash-only machine with no warranty is the mistake Mike made first.",
      "Anthony's approach: finance over 60 months to keep payments low, then use the cash flow to pay it off in 12 to 18 months.",
    ],
    script: {
      label: "Anthony's worked example (example math, not a promise)",
      lines: [
        "Say a machine does $2,000 a month. Goods run 35 to 40% (about $750) and software and processing about 10% ($200).",
        "Machine payment about $150. Stocking labor $100 to $150.",
        "That leaves roughly $750 to $850 a month in that example. Run your own numbers for your location.",
      ],
    },
    video: yt(
      "3HDu68I0_-o",
      "Everything You Need To Purchase Your First Vending Machine",
      "31 min",
    ),
    assignment: {
      title: "Match and price your machine",
      tasks: [
        "Pick the machine type for your first signed (or closest) location and measure the space.",
        "Get 3 quotes with financing terms. Write down the down payment and the monthly payment for each.",
      ],
    },
    quote: {
      text: "Your credit score matters more than your cash on hand.",
      who: "Anthony Kolodziej",
    },
  },
  {
    number: "08",
    title: "Stock for margin, then adjust",
    summary:
      "Why a Monster beats a water, and when to pull a machine that isn't working.",
    why: "Beginners chase top-line revenue. Profit is in dollars per slot: a 16oz water and a 16oz Monster can both carry ~65% margin, but the Monster sells for twice as much.",
    steps: [
      "Fill slots by profit dollars and shelf life. Drinks win on both; give them the extra row.",
      "Stock for the building: OTC meds at urgent cares, late-night snacks at apartments, energy drinks and frozen meals for night shifts.",
      "Never copy one planogram across every location.",
      "Give a new machine time to ramp, but if it still underperforms at 6 to 9 months, have the conversation. Locations often offer to promote it or pay a monthly minimum.",
      "Hire a stocker early so you work on the business, not in it.",
    ],
    video: yt(
      "O_w3HB7i7l4",
      "10 HUGE Mistakes New Vending Machine Owners Make",
      "13 min",
    ),
    assignment: {
      title: "Draft your launch planogram",
      tasks: [
        "List the products for your first machine, ranked by profit per slot, not by price.",
        "Set a calendar reminder at day 14 to swap the bottom 3 sellers.",
      ],
    },
    quote: {
      text: "Drinks have the best margins and the best shelf life.",
      who: "Mike Hoffmann",
    },
  },
] as const;

export const firstThirtyDays = [
  {
    week: "Week 1",
    focus:
      "Plays 01 to 03: pick two location types, fill the 25-target worksheet.",
  },
  {
    week: "Week 2",
    focus: "Play 04: 10 emails, 3 pop-ins with a product basket.",
  },
  {
    week: "Week 3",
    focus: "Play 05: follow-ups on schedule, objections rehearsed.",
  },
  {
    week: "Week 4",
    focus:
      "Plays 06 to 08: term sheet signed, machine quoted, planogram ready.",
  },
] as const;

/** Mike's bio for the offer page (from the approved /playbook host copy). */
export const guideHost = {
  eyebrow: "Who wrote this",
  title: "Mike Hoffmann",
  role: "Founder, Vendingpreneurs",
  paragraphs: [
    "Mike grew up on a family farm in Iowa and spent years as a college strength coach: long hours, a paycheck that never moved. His first vending machine brought in $600 a month. It wasn't life-changing, but it was proof.",
    "Every script and framework in this playbook is what he uses on his own route right now, not what he did five years ago.",
  ],
} as const;

export const guideFaq = [
  {
    q: "What exactly do I get?",
    a: "A 12-page PDF: eight plays with steps, scripts and contract terms, a video from Mike for every play, an assignment at the end of each, a 25-target worksheet and a 30-day plan.",
  },
  {
    q: "How do I get it?",
    a: "Right after checkout you land on a download page, and we email you a link you can use any time. Lost it? Get a fresh link from the access page.",
  },
  {
    q: "Do I need money or experience to use it?",
    a: "No. The first plays are about picking and pitching a location, which costs nothing. You only buy a machine after a location says yes.",
  },
  {
    q: "Is this the same as the webinar?",
    a: "It's the homework. The webinar shows you the opportunity; the playbook gives you the steps to start on before and after it.",
  },
] as const;

/** Offer page copy (/playbook/guide). */
export const guideOffer = {
  eyebrow: "Mike Hoffmann's First Location Playbook",
  headline: "Land your first vending location in the next 30 days",
  highlight: "first vending location",
  sub: "A tactical PDF: eight plays, Mike's exact scripts and contract terms, a video for every play and an assignment to finish before the next one.",
  benefits: [
    {
      title: "Know exactly where to pitch",
      body: "The three location types Mike's route leans on, plus the Google Maps method and AI prompt that turn your town into a list of 25 targets.",
    },
    {
      title: "Say the words that get a yes",
      body: "The amenity pitch, the first email, and word-for-word answers to revenue share, 'we already have vending' and 'corporate needs to approve'.",
    },
    {
      title: "Protect the deal and the machine",
      body: "The five contract terms Mike uses on every placement, which machine fits which location, and how to stock for profit per slot.",
    },
  ],
  cta: "Get the playbook for $5",
  ctaNote: "One-time payment. Instant PDF download, plus a copy in your inbox.",
  previewTitle: "Look inside",
  contentsTitle: "The eight plays",
  includes: [
    "8 plays with steps, scripts and checklists",
    "8 of Mike's videos, one per play",
    "An assignment at the end of every play",
    "25-target worksheet and 30-day plan",
  ],
  terms: [
    "One-time $5 payment. No subscription.",
    "Instant digital delivery: download right after checkout, and a link by email.",
    "Lost your link? Get a new one any time from the access page.",
    "Questions or a problem with your order? Reply to your delivery email.",
  ],
  refundTerms: "Digital product, delivered instantly. All sales are final.",
  disclaimer:
    "Results vary. Figures in the playbook are worked examples from Mike's and Anthony's own routes, not a promise of earnings. Nothing here is legal, tax or financial advice.",
} as const;

/** Closer calendar (LANE 1 - Top 2 Closers), same event as the booking pages. */
export const GUIDE_CLOSER_CALENDLY =
  "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";

export const guideUpsell = {
  eyebrow: "One more step for serious buyers",
  title: "Add a free 1-on-1 consultation",
  body: "You just showed you're serious about getting started. Book a call with a Vendingpreneurs advisor and we'll map your first location together: your market, the right machine and your next 30 days.",
  points: [
    "Your market and the location types that fit it",
    "Which machine to start with and how to finance it",
    "A clear plan for your first 30 days",
  ],
  note: "Free for playbook buyers. Pick a time below.",
} as const;

export const guideThanks = {
  eyebrow: "Payment confirmed",
  title: "Your playbook is ready",
  body: "Download it now. We also emailed a link to {email} so you can get back to it any time.",
  cta: "Download the playbook (PDF)",
  next: "Start with Play 01 and do each assignment before the next play.",
  pendingTitle: "Confirming your payment",
  pendingBody:
    "This usually takes a few seconds. This page refreshes on its own. Your download link is also on its way by email.",
} as const;
