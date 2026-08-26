/**
 * Solution pages — the `/solutions/<slug>` content source.
 *
 * Adding a solution page is adding an entry to `solutions` below. There is no
 * per-page component: `ContentPage` renders every field, and the route's
 * `generateStaticParams` picks the new slug up automatically. The field types
 * live in `content-page.ts` and are shared with `/process`.
 */

import type { ContentPage } from "./content-page";

export type Solution = ContentPage;

/** Every solution page sits under the same breadcrumb parent. */
const PARENT = { label: "Solutions", href: "/solutions" } as const;

export const solutionsIndex = {
  eyebrow: "Solutions",
  title: "Everything a route needs, in one place",
  intro:
    "Locations, machines, product, funding, and someone to ask when it goes sideways. Each of these covers one of the jobs that stands between you and a profitable route.",
} as const;

export const solutions: ReadonlyArray<Solution> = [
  {
    slug: "vendscout",
    parent: PARENT,
    breadcrumb: "Locations",
    eyebrow: "VendScout",
    title: "Find, Pitch, and Secure Vending Machine Locations",
    intro:
      "Stop driving neighborhoods hoping to spot a good lobby. VendScout ranks real locations, builds your pitch site, and gets contracts signed, so the only thing standing between you and your next machine is a phone call.",
    metaTitle: "VendScout · Vendingpreneurs' Vending Machine Location Finder",
    metaDescription:
      "VendScout is Vendingpreneurs' vending machine location finder: ranked leads, a pitch-ready website, and a signed contract, all in one system.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    hero: {
      video: "https://www.vendhubhq.com/sales/videos/vendscout-v1.mp4",
      poster: "https://www.vendhubhq.com/sales/videos/vendscout-v1-poster.jpg",
      width: 1700,
      height: 1032,
      alt: "VendScout dashboard showing ranked vending machine location leads",
    },

    // Real operator quotes go here — three of them, one per stage (finding,
    // pitching, contracts). The section renders only once this is non-empty,
    // so the page ships without placeholder proof.
    testimonials: [],

    thesis: "Finding locations has never been easier.",
    steps: [
      {
        label: "01 · Find",
        title: "Ranked locations, in seconds",
        body: "Qualified offices, gyms, hospitals, and apartments pulled off the map. No guesswork.",
      },
      {
        label: "02 · Pitch",
        title: "A site that pitches for you",
        body: "Your branding, your domain, live in minutes.",
      },
      {
        label: "03 · Secure",
        title: "Signed the same day",
        body: "Auto-filled, e-signature-ready contracts sent before the prospect goes cold.",
      },
    ],
    stepsCta: { label: "Find Locations", href: "/contact" },
    features: [
      {
        eyebrow: "Find locations",
        title: "Your next 100 locations, found before your coffee gets cold",
        body: "Driving routes and cold pop-ins burn most new operators' first three months. VendScout pulls ranked, qualified locations off Google Maps in seconds: offices, gyms, hospitals, and apartment complexes actually worth pitching.",
        points: [
          "Search by zip and radius: offices, gyms, hospitals, apartments, schools",
          "Phone, email, address, and reviews pulled for every result",
          "Ranked by foot traffic and location type",
          "One click imports your picks into your pipeline",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/scout-map.mp4",
          poster: "https://www.vendhubhq.com/sales/videos/scout-map-poster.jpg",
          width: 1692,
          height: 1080,
          alt: "Searching the map for qualified vending locations in VendScout",
        },
      },
      {
        eyebrow: "Pitch with confidence",
        title: "Show up looking like you've done this a hundred times",
        body: "Locations don't sign with operators who look like a side hustle. VendScout builds your professional vending business website in minutes: your branding, your domain, live before your first meeting. Send the link ahead and walk in as the obvious choice.",
        points: [
          "Pick a template, add your colors, live in minutes",
          "Custom domain support, like yourvendingbiz.com",
          "Lead-capture forms wired to your pipeline",
          "SEO-optimized pages so locations find you first",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/website.mp4",
          poster: "https://www.vendhubhq.com/sales/videos/website-poster.jpg",
          width: 1700,
          height: 1080,
          alt: "Building a branded vending website in VendScout",
        },
      },
      {
        eyebrow: "Secure the deal",
        title:
          "Weeks of “let me run it by corporate” become one signed contract",
        body: "The deal dies in the gap between the handshake and the paperwork. VendScout closes it: pick a template, auto-fill from your CRM, and send a branded, e-signature-ready contract before the prospect goes cold.",
        points: [
          "Templates for common deal structures",
          "Auto-populated with location, operator, term, and commission",
          "Photorealistic mockups of the machine in place",
          "Branded PDF export, e-signature ready",
        ],
        media: {
          video: "https://www.vendhubhq.com/sales/videos/scout-contracts.mp4",
          poster:
            "https://www.vendhubhq.com/sales/videos/scout-contracts-poster.jpg",
          width: 1700,
          height: 1080,
          alt: "Generating and sending a location contract in VendScout",
        },
      },
    ],
    closing: {
      title: "Your first location is closer than you think",
      body: "Every operator in the Vendingpreneurs community started with one signed location. VendScout gets you there faster: find the lead, make the pitch, sign the deal.",
      ctas: [
        { label: "Start Your Vending Business", href: "/contact" },
        { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Case Studies",
        body: "Operators who started exactly where you are, and what their routes look like now.",
        href: "/case-studies",
      },
      {
        title: "Resources",
        body: "Playbooks, teardowns, and answers to the questions every new operator hits.",
        href: "/news",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "marketplace",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Product",
    eyebrow: "Product Marketplace",
    title: "Buy your product below retail, not at the warehouse club",
    intro:
      "Product is the largest recurring cost on a vending route, and it is the one most operators quietly overpay on for years. The marketplace gives you pre-negotiated, below-retail pricing across more than 5,000 SKUs, so the gap between what a customer pays and what you paid stays yours.",
    metaTitle:
      "Product Marketplace — Below-Retail Vending Product and Bulk Deals",
    metaDescription:
      "Pre-negotiated, below-retail pricing across 5,000+ SKUs. Buying through the right channels moves product cost from roughly 50% of sales toward 33% — the difference between a busy machine and a profitable one.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    hero: {
      video: "https://www.vendhubhq.com/sales/videos/pantry.mp4",
      poster: "https://www.vendhubhq.com/sales/videos/pantry-poster.jpg",
      width: 1700,
      height: 1080,
      alt: "Browsing and ordering product for a route",
    },
    testimonials: [],
    thesis:
      "Two operators can run the same machine in the same lobby and take home very different money. The difference is usually what they paid for the product inside it.",
    steps: [
      {
        label: "01 · Source",
        title: "One catalog, not six suppliers",
        body: "Snacks, drinks, and the higher-margin extras in one place, priced for operators instead of households.",
      },
      {
        label: "02 · Price",
        title: "Margin you can actually see",
        body: "Every item carries its cost, so you set a vend price against a real number rather than a guess.",
      },
      {
        label: "03 · Reorder",
        title: "Restock without rebuilding the order",
        body: "Reorder what a location actually sold instead of rebuilding the same cart from memory every week.",
      },
    ],
    features: [
      {
        eyebrow: "Below-retail pricing",
        title: "Group buying power, on your first machine.",
        body: "A new operator buying two cases at a time has no leverage. Buying through the Vendingpreneurs network gets you the pricing a much larger route would negotiate for itself — from day one, on machine number one, without committing to pallet volume you cannot move yet.",
        points: [
          "More than 5,000 SKUs at pre-negotiated, below-retail operator pricing",
          "Snacks, drinks, and higher-margin specialty items in one catalog",
          "Pricing that does not require you to buy a pallet to qualify",
          "The same channel that discounts product also discounts equipment",
        ],
        stats: [
          { value: "5,000+", label: "SKUs at operator pricing" },
          { value: "Below retail", label: "on product and equipment" },
          { value: "Machine 1", label: "when the pricing starts" },
        ],
      },
      {
        eyebrow: "Where the margin goes",
        title: "Cost of goods is the number that decides your year.",
        body: "Industry sources assume product runs around 50% of sales. Operators buying through the right channels run closer to 33%. On the same revenue, that gap is the whole difference between a route that funds a car payment and one that funds a decision about your job.",
        points: [
          "Industry-typical product cost sits near 50% of sales",
          "Operators buying through the network run closer to 33%",
          "A single machine grosses roughly $150 to $400 a month",
          "Net margin after product, commission, and fees typically lands at 20% to 35%",
        ],
        stats: [
          {
            value: "~50%",
            label: "Industry-typical product cost, as a share of sales",
          },
          {
            value: "~33%",
            label: "What operators buying through the network run",
          },
          { value: "$150–$400", label: "Gross per machine, per month" },
          {
            value: "20–35%",
            label: "Net margin after product, commission and fees",
          },
        ],
      },
      {
        eyebrow: "Match product to the room",
        title: "The right product for that location, not for every location.",
        body: "A gym, a courthouse, and a student housing block do not want the same twelve items. Product mix matters, but a machine matched to its audience, priced for margin, and kept stocked will beat a better product in the wrong spot every time. The catalog is wide enough to build a different planogram for each account.",
        points: [
          "Build a distinct product list per location type instead of one house mix",
          "Higher-margin specialty items for the accounts that will pay for them",
          "Swap the losers out on the next order instead of the next quarter",
          "Reorder against what actually sold, not what you assumed would",
        ],
      },
    ],
    closing: {
      title: "Stop paying retail for the thing you resell.",
      body: "Every point you save on product is a point that never has to be earned back at the machine. Talk to an operator about what the marketplace looks like for the route you are planning.",
      ctas: [
        { label: "Start Your Vending Business", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Select a Winning Product Mix",
        body: "How to match a product list to the room it sits in, and what to do when it misses.",
        href: "/process/select-products",
      },
      {
        title: "Equipment",
        body: "Which machine belongs in which account, and what one actually costs to run.",
        href: "/solutions/equipment",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "equipment",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Equipment",
    eyebrow: "Equipment",
    title: "Put the right machine in the right account",
    intro:
      "The wrong machine in a good location loses money slowly enough that it takes a year to notice. Combo machines, chilled units, micro markets, and coffee service each earn in different rooms, and the choice is the one decision on this list you cannot cheaply undo.",
    metaTitle: "Vending Equipment — Choose the Right Machine for the Account",
    metaDescription:
      "Combo machines, chilled units, micro markets, and coffee service earn in different rooms. What each format costs to run, what it grosses, and how long it takes to pay itself back.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    hero: {
      video: "https://www.vendhubhq.com/sales/videos/equipment.mp4",
      poster: "https://www.vendhubhq.com/sales/videos/equipment-poster.jpg",
      width: 1700,
      height: 1080,
      alt: "Vending equipment options and specifications",
    },
    testimonials: [],
    thesis:
      "A machine is a five-year decision you make in an afternoon. Getting it right is mostly a matter of knowing what the room in front of you actually buys.",
    steps: [
      {
        label: "01 · Match",
        title: "Format follows the account",
        body: "A 200-unit apartment building and a manufacturing plant want different equipment. Start from the room.",
      },
      {
        label: "02 · Finance",
        title: "Most operators finance",
        body: "New and used equipment ranges widely, and a note at modest money down over five years is normal.",
      },
      {
        label: "03 · Measure",
        title: "Know the payback date",
        body: "A well-placed machine typically pays back its cost in 18 to 24 months. Past that, reassess the placement.",
      },
    ],
    features: [
      {
        eyebrow: "Pick the format",
        title: "Four formats, four different rooms.",
        body: "Combo machines cover snacks and drinks in one footprint, which suits most first placements. Chilled units open up fresh food where there is a lunch crowd. Micro markets replace the machine entirely in a building with enough traffic and enough trust. Coffee service earns beside any of them. Members run mixes of all four, matched to the account rather than to a preference.",
        points: [
          "Combo machines — snacks and drinks in one footprint, the usual first placement",
          "Chilled units — fresh food and grab-and-go where there is a real lunch crowd",
          "Micro markets — an open store for buildings with the traffic to support one",
          "Coffee service — a small add-on that earns beside anything else you place",
        ],
      },
      {
        eyebrow: "Run the numbers first",
        title: "What one machine actually earns.",
        body: "A single machine grosses roughly $150 to $400 a month. After product, commission, and card fees, net margin lands at 20% to 35% — somewhere near $40 to $120 per machine per month, or around $5,000 to $6,000 a year before your own labor. Those are the numbers a financing decision has to survive, and they are the numbers to check a seller's promises against.",
        points: [
          "Gross of roughly $150 to $400 per machine, per month",
          "Net margin of 20% to 35% after product, commission, and processing",
          "Telemetry and software run about $9 to $60 per machine, per month",
          "Payback typically lands at 18 to 24 months on a well-placed machine",
        ],
        stats: [
          { value: "$150–$400", label: "Gross per machine, per month" },
          { value: "20–35%", label: "Net margin after costs" },
          {
            value: "$9–$60",
            label: "Telemetry and software, per machine per month",
          },
          {
            value: "18–24 mo",
            label: "Typical payback on a well-placed machine",
          },
        ],
      },
      {
        eyebrow: "Buy it once",
        title: "The expensive mistake is the wrong model, not the wrong price.",
        body: "New operators tend to negotiate hard on the machine and think very little about whether it fits the account they are about to sign. A cheap machine that cannot take a card, cannot report its own sales, or cannot hold what that building buys will underperform a more expensive one for its entire service life. Member pricing and equipment partners come through the same network that discounts product.",
        points: [
          "Cashless payment on every placement — cash-only machines leave sales in the lobby",
          "Telemetry that reports its own sales, so you are not guessing between visits",
          "Capacity matched to how often you can realistically service the account",
          "Pre-negotiated machine deals and financing partners through the network",
        ],
      },
    ],
    closing: {
      title: "Choose the machine after you understand the room.",
      body: "Bring the account you are looking at and we will walk through which format earns there, what it should cost, and how long it takes to pay for itself.",
      ctas: [
        { label: "Start Your Vending Business", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Choose the Right Vending Machine",
        body: "The step-by-step version of this decision, in the order you'll actually face it.",
        href: "/process/choose-machines",
      },
      {
        title: "Financing",
        body: "How operators fund their first machines without emptying an emergency fund.",
        href: "/solutions/financing",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "national-contracts",
    parent: PARENT,
    noindex: true,
    breadcrumb: "National Contracts",
    eyebrow: "National Contracts",
    title: "Win the accounts that come with more than one building",
    intro:
      "A single lobby is one negotiation for one machine. A regional property group, a franchise operator, or a facilities company is one negotiation that can place machines for years. The work is different, the paperwork is different, and most operators are not ready for it on the day it lands in front of them.",
    metaTitle: "National Contracts — Multi-Site Vending Accounts",
    metaDescription:
      "Multi-site and national vending accounts are one negotiation that places machines across many buildings. What they ask for, what they pay, and how to be ready before one lands.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "The operators who win multi-site accounts are rarely the biggest. They are the ones who could answer every question the account asked on the first call.",
    steps: [
      {
        label: "01 · Qualify",
        title: "Know which accounts are worth it",
        body: "A multi-site agreement is only leverage if the sites are ones you can actually service.",
      },
      {
        label: "02 · Prepare",
        title: "Bring proof, not promises",
        body: "These accounts ask for service records, insurance, and references before they ask for a price.",
      },
      {
        label: "03 · Service",
        title: "Deliver the second building",
        body: "Multi-site accounts renew or die on consistency across every location, not on the first install.",
      },
    ],
    features: [
      {
        eyebrow: "What changes",
        title:
          "The pitch you use on a lobby will not survive a facilities team.",
        body: "A property manager decides on the spot. A regional or national account runs a process: someone evaluates you against other operators, someone else checks whether you can cover every site on the list, and someone in finance asks what the commission structure looks like across all of them. It is a longer road with a much larger prize at the end.",
        points: [
          "Multiple decision-makers, none of whom can approve it alone",
          "A written scope covering every site, not a one-page agreement per building",
          "Service-level expectations that apply to your worst location, not your best",
          "Commission negotiated once, across the whole portfolio",
        ],
        media: {
          src: "/images/content/national-contracts.avif",
          width: 1600,
          height: 1067,
          alt: "Two people closing an agreement in a meeting",
        },
      },
      {
        eyebrow: "Get ready first",
        title: "Be the operator who already has the answers.",
        body: "Most operators lose a multi-site account in the gap between interest and paperwork, because the account asks for something ordinary — proof of insurance, a service history, references from comparable sites — and it takes two weeks to produce. Assembling that before you need it is the whole preparation, and it is the reason a smaller operator sometimes beats a larger one.",
        points: [
          "Service records that show consistent uptime across your existing accounts",
          "Insurance and business documentation ready to send the same day",
          "References from accounts that look like the ones you are pitching",
          "Enough route capacity to take on every site on the list at once",
        ],
      },
      {
        eyebrow: "Grow into it",
        title:
          "The first multi-site account usually comes from an existing one.",
        body: "A regional account rarely starts as a cold pitch. It starts as one building you service well, where the property manager also manages four others, or where a facilities director moves to a larger company and takes the recommendation with them. Servicing your current accounts like they are being watched is the most reliable path to the ones that are.",
        points: [
          "Ask existing accounts what else their group manages",
          "Treat every property manager as a reference for the next portfolio",
          "Build capacity before you pitch, not after you win",
          "Work the accounts you already have before chasing the ones you don't",
        ],
      },
    ],
    closing: {
      title: "Ready for an account with more than one address?",
      body: "Bring the opportunity you're looking at and we'll walk through whether your route can carry it and what the account is going to ask you for.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        {
          label: "Scale Your Vending Route",
          href: "/process/scale",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "Draft Your Contract",
        body: "What belongs in a location agreement, and the terms that lock you into a dud.",
        href: "/process/contract",
      },
      {
        title: "Scale Your Vending Route",
        body: "The hiring and capacity milestones that make a multi-site account survivable.",
        href: "/process/scale",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "coaching",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Coaching",
    eyebrow: "Professional Coaching",
    title: "Learn the route from people currently running one",
    intro:
      "Doing this alone usually means 18 to 24 months of expensive mistakes. The Vending Accelerator Program replaces that with step-by-step training, weekly group coaching, and 1-on-1 ambassador sessions with operators who placed their machines this year, not a decade ago.",
    metaTitle: "Professional Coaching — The Vending Accelerator Program",
    metaDescription:
      "Step-by-step training, weekly group coaching, and 1-on-1 ambassador sessions. 850+ entrepreneurs launched, 3,000+ locations placed, and a 90-day path to your first machine.",
    ctas: [
      { label: "See if your market is a fit", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "A course is videos you watch alone. This is a live operator community, weekly coaching, and 1-on-1 ambassadors — you build the business, you don't just study it.",
    steps: [
      {
        label: "01 · Days 0–30",
        title: "Land your first location",
        body: "Find high-traffic spots, walk in, and close them, backed by a platform showing every viable location in your market.",
      },
      {
        label: "02 · Days 30–60",
        title: "Get your first machine earning",
        body: "Placed and stocked with member pricing and rebates. You start reading real sales data and dialing in product.",
      },
      {
        label: "03 · Days 60–90",
        title: "Optimize and line up the next",
        body: "Tighten location one, then decide on location two. This is where it starts to feel like a business.",
      },
    ],
    features: [
      {
        eyebrow: "How it runs",
        title:
          "Weekly coaching, plus someone whose job is your specific problem.",
        body: "The group calls cover what everyone is hitting that week — a location that went quiet, a pitch that keeps stalling, a product mix that will not move. The 1-on-1 ambassador sessions are for the part that is only yours: your market, your account, the contract sitting in front of you. Both run every week, and both are led by people with live routes.",
        points: [
          "Weekly group coaching calls on live operator problems",
          "1-on-1 ambassador sessions to sharpen your locations, pitches, and product",
          "Step-by-step training you work through in order, not a video library",
          "A community of operators at every stage, from first pop-in to full-time route",
        ],
      },
      {
        eyebrow: "What it covers",
        title:
          "Everything that decides whether machine one becomes machine ten.",
        body: "The program is built around the decisions that compound: which locations are worth pursuing, which machines and products actually earn, how to secure high-traffic placements, and when to stop doing the restocking yourself. It is also built around the mistakes — the ones that cost new operators their first year and are entirely avoidable with a week's warning.",
        points: [
          "How to start with little upfront investment compared to real estate",
          "Which vending machines and products generate the highest profits",
          "How to secure high-traffic locations that hold up over time",
          "Automation and scaling strategies to maximize your time and revenue",
          "The common mistakes new operators make, and how to avoid them",
        ],
      },
      {
        eyebrow: "Who it's for",
        title: "Beginners and operators who already have machines out.",
        body: "Members have come in with no experience and no industry contacts, and members have come in with an existing route they wanted to make profitable rather than just busy. So far the community has launched more than 850 entrepreneurs, placed over 3,000 locations, and generated more than $3 million in vending sales. Members typically run their routes on 2 to 15 hours a week and place a first machine inside 90 days. Those are averages across the community; individual outcomes depend on your market, your effort, and how closely you follow the program.",
        points: [
          "850+ entrepreneurs launched through the program",
          "3,000+ locations placed by community members",
          "2 to 15 hours a week to run a route once it's placed",
          "Under 90 days from starting to a first machine earning",
        ],
        stats: [
          { value: "850+", label: "Entrepreneurs launched" },
          { value: "3,000+", label: "Locations placed" },
          { value: "2–15 hrs", label: "A week to run a placed route" },
          { value: "< 90 days", label: "To a first machine earning" },
        ],
      },
    ],
    closing: {
      title: "Curious if your market is a fit?",
      body: "Book a free 15-minute call and we will look at your market with you. No purchase required.",
      ctas: [
        { label: "See if your market is a fit", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Expert Customer Support",
        body: "What happens after the coaching call, when something breaks on a Tuesday.",
        href: "/solutions/support",
      },
      {
        title: "The Vendingpreneurs Process",
        body: "The seven steps the coaching walks you through, start to finish.",
        href: "/process",
      },
      {
        title: "Case Studies",
        body: "Operators who started exactly where you are, and what their routes look like now.",
        href: "/case-studies",
      },
    ],
  },
  {
    slug: "partners",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Partners",
    eyebrow: "Partner Network",
    title: "The brands and suppliers behind every member route",
    intro:
      "A one-machine operator and a national brand do not normally have a conversation. The partner network is what closes that gap: the equipment, product, and payment relationships the community has already built, available to you on your first placement instead of your fiftieth.",
    metaTitle: "Partner Network — Brands and Suppliers Behind Member Routes",
    metaDescription:
      "365 Retail Markets, Alani Nu, Cantaloupe, Micromart, PepsiCo, Prime, Poppi, and Doritos. The equipment, product, and payment relationships behind every Vendingpreneurs member route.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "Leverage in this business is mostly relationships you have not had time to build yet. The network lends you the ones that matter on day one.",
    steps: [
      {
        label: "01 · Equipment",
        title: "Machines and markets",
        body: "365 Retail Markets, Cantaloupe, and Micromart cover the hardware and the systems that run on it.",
      },
      {
        label: "02 · Product",
        title: "Brands people look for",
        body: "PepsiCo, Doritos, Prime, Poppi, and Alani Nu are what a machine gets judged on before anyone reads a label.",
      },
      {
        label: "03 · Access",
        title: "Group terms, single route",
        body: "You buy on the community's terms rather than on the terms a first-time operator would be quoted.",
      },
    ],
    features: [
      {
        eyebrow: "Trusted partners",
        title: "Who's in the network.",
        body: "These are the brands and platforms that show up across member routes: 365 Retail Markets and Micromart on the market side, Cantaloupe on payments and telemetry, and PepsiCo, Doritos, Prime, Poppi, and Alani Nu filling the machines. They are named on the homepage because members actually run them, not because a logo strip looked good.",
        points: [
          "365 Retail Markets and Micromart — micro market hardware and software",
          "Cantaloupe — cashless payments and the telemetry that reports your sales",
          "PepsiCo and Doritos — the mainstream snack and drink lines every machine needs",
          "Prime, Poppi, and Alani Nu — the higher-margin brands that move in gyms and student housing",
        ],
      },
      {
        eyebrow: "What it gets you",
        title: "Pricing that does not depend on your size.",
        body: "The practical benefit of the network is terms. Machine deals are pre-negotiated, product runs below retail across more than 5,000 SKUs, and the equipment and financing partners are the same ones larger operators use. None of that is available to someone calling a distributor cold with one machine to stock.",
        points: [
          "Pre-negotiated machine deals through the community's equipment partners",
          "Below-retail product across more than 5,000 SKUs",
          "Payment and telemetry hardware that reports sales without a site visit",
          "Financing and equipment partners reachable through the same network",
        ],
        stats: [
          { value: "5,000+", label: "SKUs below retail" },
          { value: "8", label: "Brand and platform partners" },
          { value: "Pre-negotiated", label: "Machine and equipment deals" },
        ],
      },
      {
        eyebrow: "Where it matters",
        title: "Some accounts come with a brand attached.",
        body: "A property that already has a pouring agreement, a gym whose members expect a specific energy drink, a building where the existing operator left a branded cooler behind — these are ordinary situations that stop a new operator cold. Having the relationship already in place turns each of them into a phone call rather than a lost account.",
        points: [
          "Buildings with an existing pouring agreement you have to work inside",
          "Locations whose audience expects specific brands on the shelf",
          "Equipment and cooler placements that come through the brand, not through you",
          "Answers from operators who have already worked the same relationship",
        ],
      },
    ],
    closing: {
      title: "The relationships are already built. Use them.",
      body: "Talk to an operator about which partners matter for the accounts in your market and what the terms look like on a first route.",
      ctas: [
        { label: "Start Your Vending Business", href: "/contact" },
        {
          label: "Product Marketplace",
          href: "/solutions/marketplace",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "Product Marketplace",
        body: "Below-retail pricing across 5,000+ SKUs, and what that does to your margin.",
        href: "/solutions/marketplace",
      },
      {
        title: "Equipment",
        body: "Which machine belongs in which account, and what one actually costs to run.",
        href: "/solutions/equipment",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "financing",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Financing",
    eyebrow: "Financing",
    title: "Fund the machines without emptying your savings",
    intro:
      "Most operators finance rather than pay cash. A note at modest money down over five years is normal in this business, and a well-placed machine typically pays back its cost in 18 to 24 months — which means the placement can carry the payment long before the term is up.",
    metaTitle: "Vending Equipment Financing — Fund Your First Machines",
    metaDescription:
      "Most vending operators finance rather than pay cash. How equipment notes work, what payback looks like at 18 to 24 months, and how to size a route you can actually service.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "The question is not whether you can afford a machine. It is whether the location you signed can cover the payment while you learn the rest of the business.",
    steps: [
      {
        label: "01 · Size it",
        title: "Start from the location",
        body: "A signed location with real foot traffic is what makes a payment safe. Sign first, finance second.",
      },
      {
        label: "02 · Structure it",
        title: "Modest down, five-year note",
        body: "The common structure in this business. Cash flow lets you pay it down early once the machine is earning.",
      },
      {
        label: "03 · Clear it",
        title: "Payback in 18 to 24 months",
        body: "A well-placed machine typically covers its own cost inside two years, well before the note ends.",
      },
    ],
    features: [
      {
        eyebrow: "Why operators finance",
        title:
          "Cash is the constraint on how fast you can grow, not on whether you can start.",
        body: "Paying cash for machine one feels safer and usually costs you machine two. Financing keeps working capital where it belongs — in product, in the deposit on the next location, and in a buffer for the month a bill validator jams. That is the same logic that makes vending a lower-capital entry than real estate, which is why most members start here rather than there.",
        points: [
          "Most operators finance rather than pay cash for equipment",
          "A note at modest money down over five years is the normal structure",
          "Cash flow lets you pay the note down early once placements are earning",
          "Little upfront investment compared to real estate on the same monthly income",
        ],
      },
      {
        eyebrow: "Make the payment safe",
        title:
          "The machine has to cover the note, and you have to know before you sign.",
        body: "A single machine grosses roughly $150 to $400 a month and nets 20% to 35% after product, commission, and card fees. That range is what a payment has to fit inside. Running those numbers against a specific signed location — not against an average — is the difference between a financed route and a financed problem.",
        points: [
          "Gross of roughly $150 to $400 per machine, per month",
          "Net margin of 20% to 35% after product, commission, and processing",
          "Telemetry and software at about $9 to $60 per machine, per month",
          "Location commission of 5% to 25% of gross, though many amenity placements ask for nothing",
        ],
        stats: [
          { value: "$150–$400", label: "Gross per machine, per month" },
          { value: "20–35%", label: "Net margin after costs" },
          {
            value: "5–25%",
            label: "Location commission, where it applies at all",
          },
          { value: "18–24 mo", label: "Typical payback window" },
        ],
      },
      {
        eyebrow: "Where to get it",
        title:
          "Financing partners come through the same network as the equipment.",
        body: "There are several routes to funding a route, and which one fits depends on your credit position, how many machines you are placing, and how fast you intend to add the next. Members have funded first machines in very different ways — one built to 45 locations after starting on personal 0% APR credit cards. There is no single right answer, and nobody can quote you one in a chat window.",
        points: [
          "Equipment and financing partners reachable through the community network",
          "Structure depends on your position and how quickly you plan to add machines",
          "Bring a signed or near-signed location to the conversation, not a hypothetical",
          "We will not quote a number without looking at your actual plan",
        ],
      },
    ],
    closing: {
      title: "Bring a location and we'll talk numbers.",
      body: "There is no single plan and no published figure, because what fits depends entirely on the route you are building. Book a call and we'll look at yours.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        { label: "Equipment", href: "/solutions/equipment", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Equipment",
        body: "What each machine format costs to run and how long it takes to pay back.",
        href: "/solutions/equipment",
      },
      {
        title: "Review & Optimize Your Vending Location",
        body: "Reading a machine's real numbers, so the next financing decision is an informed one.",
        href: "/process/optimize",
      },
      {
        title: "Talk to us",
        body: "Get advice from operators who've been exactly where you are.",
        href: "/contact",
      },
    ],
  },
  {
    slug: "support",
    parent: PARENT,
    noindex: true,
    breadcrumb: "Support",
    eyebrow: "Expert Customer Support",
    title: "Someone who has hit this exact problem, this week",
    intro:
      "The questions that stop a new operator are rarely in a course. A property manager asks for something the contract does not cover, a machine takes money without vending, a location goes quiet for three weeks. Support here means operators with live routes answering in hours, not a ticket queue.",
    metaTitle: "Expert Customer Support — Operators Who Answer",
    metaDescription:
      "Weekly coaching calls, 1-on-1 ambassador sessions, and a live operator community. The questions that stop new operators get answered by people currently running routes.",
    ctas: [
      { label: "Start Your Vending Business", href: "/contact" },
      { label: "See How it Works", href: "#how-it-works", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "Every problem you are about to hit has already happened to somebody in this community. Support is mostly a matter of reaching them before it costs you the account.",
    steps: [
      {
        label: "01 · Ask",
        title: "The community answers first",
        body: "Post the question and get answers from operators who solved it on their own route this year.",
      },
      {
        label: "02 · Escalate",
        title: "Weekly calls for the harder ones",
        body: "Bring the problem that needs a conversation to the group coaching call, live.",
      },
      {
        label: "03 · One-on-one",
        title: "Your account, your ambassador",
        body: "The problems that are specific to your market and your contract get a private session.",
      },
    ],
    features: [
      {
        eyebrow: "Three ways in",
        title: "Community, group call, ambassador.",
        body: "Most questions get answered in the community within the hour, because someone else hit the same thing last month. The weekly group call is for the ones that need working through out loud. The 1-on-1 ambassador session is for what is specific to you — this contract, this building, this stalled account. Nothing routes to a support queue staffed by people who have never placed a machine.",
        points: [
          "A live operator community that answers in hours, not business days",
          "Weekly group coaching calls for problems worth working through out loud",
          "1-on-1 ambassador sessions on your locations, pitches, and product",
          "Answers from people with live routes, not from a script",
        ],
      },
      {
        eyebrow: "What people actually ask",
        title: "The questions that don't fit in a course.",
        body: "A course can tell you how to pitch. It cannot tell you what to say when a facilities director asks for a certificate of insurance you have never heard of, or whether a location doing $90 a month is worth relocating, or how to handle an existing operator's abandoned machine in the corner. Those are the questions the community exists for.",
        points: [
          "Contract terms a location asked for that you have not seen before",
          "A machine that is taking money and not vending, on a Saturday",
          "Whether a slow location is fixable or should be relocated",
          "How to price into a building that already has another operator in it",
        ],
      },
      {
        eyebrow: "When you need a person",
        title: "There is a phone number, and someone picks it up.",
        body: "For anything that needs a real conversation — a decision about your market, a call you want a second opinion on before you make it — you can book time with the team directly. Calls run Monday through Friday, 8am to 5pm Pacific, and the first one is fifteen minutes with no purchase required.",
        points: [
          "Book a call Monday through Friday, 8am to 5pm Pacific",
          "A free 15-minute market conversation with no purchase required",
          "Bring the specific account, contract, or machine you are stuck on",
          "Talk to operators, not to a sales desk",
        ],
      },
    ],
    closing: {
      title: "You will have questions. That's the point.",
      body: "Book a free 15-minute call and bring whatever you're stuck on. No purchase required.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        {
          label: "Professional Coaching",
          href: "/solutions/coaching",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "Professional Coaching",
        body: "The weekly training and ambassador sessions this support sits inside.",
        href: "/solutions/coaching",
      },
      {
        title: "Prepare for Your Call",
        body: "What to bring to a strategy call so the fifteen minutes are worth having.",
        href: "/pre-call-resources",
      },
      {
        title: "Case Studies",
        body: "Operators who started exactly where you are, and what their routes look like now.",
        href: "/case-studies",
      },
    ],
  },
];

export function listSolutionSlugs(): ReadonlyArray<string> {
  return solutions.map((solution) => solution.slug);
}

/** Slugs that belong in the sitemap — everything not held back from search. */
export function listIndexableSolutionSlugs(): ReadonlyArray<string> {
  return solutions.filter((s) => !s.noindex).map((s) => s.slug);
}

export function getSolution(slug: string): Solution | undefined {
  return solutions.find((solution) => solution.slug === slug);
}
