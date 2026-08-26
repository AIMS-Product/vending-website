/**
 * Process pages — the `/process/<slug>` content source.
 *
 * Same template as `/solutions`, different job: these teach one step of
 * starting a route, they do not sell a product. `ContentPage` renders both;
 * see `content-page.ts` for the field types.
 *
 * Order matters. `processSteps` is the sequence a new operator walks, and the
 * prev/next cards at the foot of each page are derived from it — do not
 * reorder without meaning to change the taught order.
 */

import type { ContentPage, PageRelated } from "./content-page";

/**
 * A process page plus a one-line `blurb` — card-length copy for the index grid
 * and the prev/next cards, where the full `intro` paragraph is too long.
 */
export type ProcessStep = ContentPage & { blurb: string };

const PARENT = { label: "Process", href: "/process" } as const;

export const processIndex = {
  eyebrow: "The Vendingpreneurs Process",
  title: "Seven steps from no machines to a route that runs itself",
  intro:
    "Every operator we work with walks the same seven steps. None of them are complicated. Skipping one is what turns a vending business into an expensive hobby.",
} as const;

export const processSteps: ReadonlyArray<ProcessStep> = [
  {
    slug: "find-locations",
    parent: PARENT,
    breadcrumb: "Find Profitable Vending Locations",
    eyebrow: "Step 01",
    title: "Find profitable vending locations",
    blurb:
      "Qualify a location on foot traffic and captive audience before you spend a dollar on it.",
    intro:
      "Almost every failed placement was decided here, before a machine was ever bought. A location is not good because it is nearby or because someone was friendly at the front desk. It is good because a predictable number of people are stuck in that building at the times they get hungry.",
    metaTitle: "How to Find Profitable Vending Locations",
    metaDescription:
      "Which building types actually earn, how to qualify foot traffic before you commit, and why a shortlist of five ranked locations beats one you liked the look of.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "See how members find locations",
        href: "/solutions/vendscout",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "You are not looking for a building that will accept a machine. You are looking for a building where people cannot easily go anywhere else.",
    steps: [
      {
        label: "01 · Shortlist",
        title: "Five, ranked",
        body: "Build a shortlist of five locations ranked by foot traffic rather than chasing the first one that says yes.",
      },
      {
        label: "02 · Verify",
        title: "Go and stand there",
        body: "Confirm the traffic in person, at the hour it matters. A manager's estimate is not data.",
      },
      {
        label: "03 · Qualify",
        title: "Check the exits",
        body: "The best locations are the ones where the nearest alternative is a drive, not a walk.",
      },
    ],
    features: [
      {
        eyebrow: "Where machines earn",
        title: "The building types that come up again and again.",
        body: "Member routes cluster around a fairly short list, and they cluster there for a reason: each one puts a predictable group of people in a building for hours with limited options. Apartment complexes and student housing run around the clock. Gyms bring a specific, high-margin appetite. Offices, manufacturing plants, and warehouses deliver a shift schedule you can set your restocking to.",
        points: [
          "Apartment complexes and student housing — residents, evenings and weekends included",
          "Gyms and fitness centers — a captive audience with a high-margin product list",
          "Offices and corporate buildings — predictable weekday traffic on a known schedule",
          "Manufacturing plants and warehouses — shift workers with limited time and few alternatives",
          "Schools, hotels, and government buildings — steady traffic and long access hours",
        ],
      },
      {
        eyebrow: "Qualify before you commit",
        title: "Traffic you have seen beats traffic you were told about.",
        body: "The single most expensive mistake at this stage is trusting a number somebody else gave you. Property managers overestimate their own buildings, and an operator trying to offload a slow location will do it enthusiastically. Go to the site at the hour that matters — lunch in an office, evening in an apartment building, shift change in a plant — and count.",
        points: [
          "Visit at the hour the machine would actually be used, not at 10am on a Tuesday",
          "Count people, don't accept a unit count or an employee headcount as traffic",
          "Ask how far the nearest alternative is; a convenience store next door changes everything",
          "Check the access hours — a building locked at 6pm is a different business than one that isn't",
        ],
        media: {
          src: "/images/content/find-locations.avif",
          width: 1600,
          height: 1067,
          alt: "People working and moving through a shared building interior",
        },
      },
      {
        eyebrow: "Build the list",
        title: "Work a shortlist, not a favourite.",
        body: "New operators tend to find one location they like and spend three months trying to close it. The members who place machines quickly do the opposite: they build a ranked shortlist of five, work all of them in parallel, and accept that most will say no. That also means the one that says yes is not the only one you have, which changes how you negotiate.",
        points: [
          "Rank five candidates by foot traffic before you pitch any of them",
          "Work the whole list in parallel — this is a numbers exercise, not a courtship",
          "Start where you already go; the places you visit weekly are places you already understand",
          "Keep the list alive: a no today is often a yes when the current operator lapses",
        ],
      },
    ],
    closing: {
      title: "Get the location right and the rest is execution.",
      body: "Bring the buildings you're looking at and we'll tell you which ones are worth your first machine and which ones will quietly cost you a year.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Find Locations",
        body: "The tool members use to rank real locations off the map instead of driving neighborhoods.",
        href: "/solutions/vendscout",
      },
    ],
  },
  {
    slug: "choose-machines",
    parent: PARENT,
    breadcrumb: "Choose the Right Vending Machine",
    eyebrow: "Step 02",
    title: "Choose the right vending machine",
    blurb:
      "Match the format to the account you just qualified — it's the one decision here you can't cheaply undo.",
    intro:
      "You now know the room. This step is choosing the equipment that fits it. A combo machine, a chilled unit, a micro market, and a coffee setup each earn in different buildings, and putting the wrong one in a good location loses money slowly enough that it takes a year to notice.",
    metaTitle: "How to Choose the Right Vending Machine",
    metaDescription:
      "Combo machines, chilled units, micro markets, and coffee service compared by the room they belong in — plus what one machine grosses, nets, and costs to run.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "Compare equipment",
        href: "/solutions/equipment",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "Buy the machine the building needs, not the machine you can get the best price on. One of those decisions lasts five years.",
    steps: [
      {
        label: "01 · Format",
        title: "The room decides",
        body: "Combo, chilled, micro market, or coffee. Start from the account you qualified, not from a catalog.",
      },
      {
        label: "02 · Spec",
        title: "Cashless and reporting",
        body: "A machine that can't take a card or report its own sales will underperform for its whole service life.",
      },
      {
        label: "03 · Fund",
        title: "Most operators finance",
        body: "A note at modest money down over five years is normal, against a payback of 18 to 24 months.",
      },
    ],
    features: [
      {
        eyebrow: "Pick the format",
        title: "Four formats, and the buildings each one belongs in.",
        body: "A combo machine handles snacks and drinks in one footprint and covers most first placements well. A chilled unit earns where there is a genuine lunch crowd and nowhere close to buy lunch. A micro market replaces the machine entirely, and needs a building with enough traffic and enough trust to justify an open store. Coffee service is small, cheap to add, and earns quietly beside any of them.",
        points: [
          "Combo — snacks and drinks in one footprint; the usual first machine",
          "Chilled — fresh food and grab-and-go where a lunch crowd is stuck in the building",
          "Micro market — an open store for high-traffic buildings that can support one",
          "Coffee — a low-cost add-on beside an existing placement",
        ],
        media: {
          src: "/images/content/choose-machines.avif",
          width: 1600,
          height: 1067,
          alt: "Vending machines installed along a building corridor",
        },
      },
      {
        eyebrow: "Non-negotiable specs",
        title:
          "Two features that decide whether you're running a business or guessing.",
        body: "Cashless payment is not optional any more — a cash-only machine simply does not capture the sales standing in front of it. Telemetry is the other one: a machine that reports its own sales tells you what moved without a site visit, which is the entire basis of every decision in the two steps after this one. Expect to pay roughly $9 to $60 per machine per month for telemetry and software.",
        points: [
          "Cashless payment on every placement, without exception",
          "Telemetry that reports sales remotely, so restocking is informed rather than routine",
          "Capacity matched to how often you can realistically service that account",
          "Telemetry and software typically run $9 to $60 per machine, per month",
        ],
        stats: [
          {
            value: "$9–$60",
            label: "Telemetry and software, per machine per month",
          },
          { value: "Cashless", label: "Non-negotiable on every placement" },
        ],
      },
      {
        eyebrow: "What it has to earn",
        title: "Check the machine against the money before you sign for it.",
        body: "A single machine grosses roughly $150 to $400 a month and nets 20% to 35% after product, commission, and card fees — around $40 to $120 per machine per month, or near $5,000 to $6,000 a year before your own labor. A well-placed machine typically pays back its cost in 18 to 24 months. Any equipment decision that does not survive those numbers is the wrong decision, whatever the sticker price.",
        points: [
          "Roughly $150 to $400 gross per machine, per month",
          "20% to 35% net margin after product, commission, and processing",
          "Payback typically at 18 to 24 months on a well-placed machine",
          "New and used equipment ranges widely; most operators finance rather than pay cash",
        ],
        stats: [
          { value: "$150–$400", label: "Gross per machine, per month" },
          { value: "20–35%", label: "Net margin after costs" },
          { value: "$40–$120", label: "Net per machine, per month" },
          { value: "18–24 mo", label: "Typical payback window" },
        ],
      },
    ],
    closing: {
      title: "The wrong model is more expensive than the wrong price.",
      body: "Tell us about the account you've qualified and we'll walk through which format earns there and what it should cost to place.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        { label: "Financing", href: "/solutions/financing", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Equipment",
        body: "Formats, specs, and member pricing on the machines themselves.",
        href: "/solutions/equipment",
      },
    ],
  },
  {
    slug: "pitch",
    parent: PARENT,
    breadcrumb: "Deliver a Compelling Pitch",
    eyebrow: "Step 03",
    title: "Deliver a compelling pitch",
    blurb:
      "Reach the actual decision-maker and pitch the machine as a free amenity, not as a favour.",
    intro:
      "The pitch is short and it is nearly always the same: you are offering the building a service its people want, at no cost and no effort to them. What makes it work is not persuasion. It is getting in front of the person who can say yes, with the paperwork already in your hand.",
    metaTitle: "How to Pitch a Vending Location",
    metaDescription:
      "Reach the decision-maker, pitch the machine as a free amenity, and bring the contract with you. The pop-in approach members use to place their first machines.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "See the pitch tools",
        href: "/solutions/vendscout",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "You are not asking for a favour. You are offering a building an amenity that costs it nothing, and the pitch should sound like that.",
    steps: [
      {
        label: "01 · Reach",
        title: "Find the decision-maker",
        body: "The person at the front desk is rarely the person who can approve a placement. Ask who is.",
      },
      {
        label: "02 · Frame",
        title: "It's an amenity",
        body: "Free to the building, no maintenance, no staff time. That framing is what makes commission optional.",
      },
      {
        label: "03 · Close",
        title: "Have the paperwork ready",
        body: "Bring the agreement and the flyer. The most common reason a warm yes dies is a two-week gap.",
      },
    ],
    features: [
      {
        eyebrow: "The pop-in",
        title: "Walk in, ask one question, leave with a name.",
        body: "Members place most of their first machines by walking into a qualified building unannounced. The goal of a first visit is not to close — it is to find out who decides and when they are in. Expect rejection to be the normal outcome, because it is: this is a numbers exercise, and the operators who place machines quickly are the ones who did enough pop-ins to stop taking them personally.",
        points: [
          "Ask who handles building services or amenities, and when they're available",
          "Leave something physical behind with your name and number on it",
          "Treat rejection as the base rate, not as feedback on the pitch",
          "Work all five shortlisted locations, not the one that was friendliest",
        ],
        media: {
          src: "/images/content/pitch.avif",
          width: 1600,
          height: 1066,
          alt: "An operator and a decision-maker shaking hands across a desk",
        },
      },
      {
        eyebrow: "The pitch itself",
        title: "Free amenity, zero effort, no risk.",
        body: "The machine costs the building nothing. You buy it, you stock it, you service it, you fix it. Their residents or employees get something they currently leave the building for. That is the entire proposition, and it is strong enough that many placements ask for no commission at all. Lead with the amenity and commission becomes a negotiation you may not have to have.",
        points: [
          "No cost to the building, no staff time, no maintenance obligation",
          "Solve a problem they already have — people leaving the building to buy things",
          "Bring specifics about their building, not a generic script",
          "Cost is the objection people lead with; the amenity framing removes it",
        ],
      },
      {
        eyebrow: "Close it the same day",
        title:
          "The deal dies in the gap between the handshake and the paperwork.",
        body: "A property manager who says yes on Tuesday and hears nothing until the following Friday has had four days to reconsider, to get overruled, or to take a call from another operator. Walk in with a one-page agreement and something professional to leave behind, and the yes converts while it is still a yes.",
        points: [
          "Carry a one-page agreement you can complete on the spot",
          "Have a flyer or leave-behind that makes you look established",
          "Send anything you promised the same day, without exception",
          "Agree the install date in the meeting, not in a follow-up email",
        ],
      },
    ],
    closing: {
      title: "Practise the pitch on somebody who has given it a hundred times.",
      body: "Bring the building you're about to walk into and we'll go through what to say, who to ask for, and what to have in your hand.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
      ],
    },
    related: [
      {
        title: "Find Locations",
        body: "Branded sites, flyers, and mockups that make the pitch before you open your mouth.",
        href: "/solutions/vendscout",
      },
    ],
  },
  {
    slug: "contract",
    parent: PARENT,
    breadcrumb: "Draft Your Contract",
    eyebrow: "Step 04",
    title: "Draft your contract",
    blurb:
      "One page, a clear term, and an exit. The clause that matters most is the one that lets you move a dud.",
    intro:
      "A location agreement in this business is short. It states who supplies and services the machine, what the building gets, how long it runs, and how either side ends it. The mistake new operators make is not signing a bad contract — it is signing a long one for a location they have not proven yet.",
    metaTitle: "How to Draft a Vending Location Contract",
    metaDescription:
      "What belongs in a one-page vending agreement: term, commission, service commitments, and the exit clause that stops a slow location from holding your machine for a year.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "See the contract tools",
        href: "/solutions/vendscout",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "Your first contracts should be short enough to sign in a hallway and short enough in term that a bad location costs you a season, not a year.",
    steps: [
      {
        label: "01 · Keep it short",
        title: "One page",
        body: "A simple one-page agreement closes deals that a ten-page document sends to someone's legal team.",
      },
      {
        label: "02 · Set the split",
        title: "Commission, or none",
        body: "Property owners sometimes take 5% to 25% of gross. Many amenity placements ask for nothing at all.",
      },
      {
        label: "03 · Keep an exit",
        title: "A term you can leave",
        body: "The clause that saves you is the one that lets you relocate a machine from a location that isn't earning.",
      },
    ],
    features: [
      {
        eyebrow: "What goes in it",
        title: "Five things, and not much else.",
        body: "Who supplies, installs, stocks, and services the machine. What the building provides — space, power, and access. What the building receives, whether that is commission or simply the amenity. How long the agreement runs. And how either side ends it. A first agreement that covers those five clearly is a better agreement than a long one nobody at the property will read.",
        points: [
          "Your obligations: supply, install, stock, service, and repair",
          "Theirs: floor space, power, and reliable access during agreed hours",
          "What they get: a commission percentage, or the amenity at no cost",
          "Term length, renewal, and how either party terminates",
        ],
      },
      {
        eyebrow: "Commission",
        title: "Lead with the amenity and you may not owe a percentage at all.",
        body: "Property owners sometimes take 5% to 25% of gross. Many amenity placements ask for nothing, because the building is getting a service its people wanted and it costs them nothing to provide. That range is wide enough to be the difference between a profitable location and a busy one, so it is worth negotiating properly rather than conceding early to close faster.",
        points: [
          "Commission commonly runs 5% to 25% of gross where it applies at all",
          "Many amenity placements carry no commission — ask before you offer",
          "Quote commission on gross and say so explicitly, so there's no dispute later",
          "A high commission on a great location can still beat a free slow one — run the numbers",
        ],
        stats: [
          { value: "5–25%", label: "Of gross, where commission applies" },
          { value: "Many", label: "Amenity placements that ask for nothing" },
        ],
      },
      {
        eyebrow: "The term",
        title:
          "The clause you will wish you had is the one that lets you leave.",
        body: "Some locations are duds and no amount of product tuning fixes them. An operator locked into a year on a machine grossing under $100 a month is paying for that mistake every month until the term runs out, and cannot put the machine somewhere it would earn. Keep first terms short, or write in a performance clause that lets you relocate below an agreed threshold.",
        points: [
          "Keep first-location terms short until the location has proven itself",
          "Consider a performance clause tied to an agreed monthly minimum",
          "Make sure you can remove the machine without penalty at term end",
          "Get it in writing that the machine remains your property throughout",
        ],
      },
    ],
    closing: {
      title: "Have someone read it before the property manager does.",
      body: "Bring the agreement you're about to sign and we'll go through the terms that matter and the ones that will cost you.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        {
          label: "National Contracts",
          href: "/solutions/national-contracts",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "Find Locations",
        body: "Auto-filled, e-signature-ready contracts members send before the prospect goes cold.",
        href: "/solutions/vendscout",
      },
    ],
  },
  {
    slug: "select-products",
    parent: PARENT,
    breadcrumb: "Select a Winning Product Mix",
    eyebrow: "Step 05",
    title: "Select a winning product mix",
    blurb:
      "Match the list to the room, price for margin, and buy where product costs 33% of sales instead of 50%.",
    intro:
      "Product mix matters, but location and margin matter more. A machine matched to its audience, priced for margin, and kept stocked will outperform a better product in the wrong spot every time. This step is about matching, pricing, and buying — in that order.",
    metaTitle: "How to Select a Winning Vending Product Mix",
    metaDescription:
      "Match the product list to the building, price for margin, and buy through channels where product runs closer to 33% of sales rather than the industry-typical 50%.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "See the product marketplace",
        href: "/solutions/marketplace",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "The machine in a gym and the machine in a courthouse should not be stocked the same way, and the one that is will lose to the one that isn't.",
    steps: [
      {
        label: "01 · Match",
        title: "Stock for that room",
        body: "Build a product list per location type instead of running one house mix everywhere.",
      },
      {
        label: "02 · Price",
        title: "Price for margin",
        body: "Set every vend price against a real cost, not against what the item costs at a grocery store.",
      },
      {
        label: "03 · Buy right",
        title: "Move cost toward 33%",
        body: "Industry-typical product cost is near 50% of sales. Buying through the right channels runs closer to 33%.",
      },
    ],
    features: [
      {
        eyebrow: "Match the room",
        title: "Stock the building you're in, not the machine you own.",
        body: "A gym will buy protein, electrolytes, and premium drinks at prices a warehouse would never pay. An office wants lunch-adjacent items and afternoon caffeine. Student housing runs late and buys differently at midnight than at midday. A manufacturing plant on shifts wants substantial food, fast. Build the list from the audience and the machine stops being a gamble.",
        points: [
          "Gyms — protein, electrolytes, and premium energy brands at real margin",
          "Offices — lunch-adjacent items and afternoon caffeine on a weekday rhythm",
          "Student housing — late-night volume and price sensitivity in the same machine",
          "Plants and warehouses — substantial food that fits inside a short break",
        ],
        media: {
          src: "/images/content/select-products.avif",
          width: 1600,
          height: 1067,
          alt: "Snacks arranged on the shelves of a stocked vending machine",
        },
      },
      {
        eyebrow: "Price for margin",
        title: "Cost of goods is the number that decides your year.",
        body: "Industry sources assume product runs around 50% of sales. Operators buying through the right channels run closer to 33%. On identical revenue that gap changes everything downstream — it is most of the difference between a route that nets 20% and one that nets 35%. Price every item against what you actually paid, and know that number before the machine is stocked.",
        points: [
          "Industry-typical product cost sits near 50% of sales",
          "Buying through operator channels moves it closer to 33%",
          "Set each vend price against your real landed cost, item by item",
          "Higher-margin specialty items belong where the audience will pay for them",
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
        eyebrow: "Then adjust",
        title:
          "Stock conservatively for the first month and let the machine tell you.",
        body: "Nobody gets the mix right on the first fill. Stock a conservative spread, treat month one as data collection, and then act on what actually sold rather than on what you expected to sell. Pull the items that did not move, widen the ones that did, and repeat. The operators who tune early end up with a machine that looks nothing like the one they installed, and earns considerably more.",
        points: [
          "Stock conservatively on the first fill — you're buying information, not volume",
          "Treat month one as data collection, not as a verdict",
          "Cut the non-movers on the next order rather than the next quarter",
          "Widen the winners; a proven item deserves more slots than a hopeful one",
        ],
      },
    ],
    closing: {
      title: "The right list is the one that building will actually buy.",
      body: "Tell us the account and we'll go through what tends to move there and what it should cost you to put on the shelf.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
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
        body: "Below-retail pricing across 5,000+ SKUs, and what that does to your cost of goods.",
        href: "/solutions/marketplace",
      },
    ],
  },
  {
    slug: "optimize",
    parent: PARENT,
    breadcrumb: "Review & Optimize Your Vending Location",
    eyebrow: "Step 06",
    title: "Review and optimize your vending location",
    blurb:
      "Read the machine's real numbers monthly — margin, not revenue — and watch shrink above 3%.",
    intro:
      "Revenue tells you a machine is busy. It does not tell you your cash-on-cash return, your payback period, or how many more placements you can afford. Two operators can run the same $20,000 in yearly revenue and take home very different amounts, because one tracks margin per machine and one does not.",
    metaTitle: "How to Review and Optimize a Vending Location",
    metaDescription:
      "Track margin per machine, not revenue. Watch shrink above 3%, reassess placements against an 18 to 24 month payback, and use machine one's numbers to justify machine two.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      {
        label: "Get the finance templates",
        href: "/resources/finance-templates",
        variant: "ghost",
      },
    ],
    testimonials: [],
    thesis:
      "The operator flying blind can't pull the loser or clone the winner, so the whole route drifts. Reviewing one machine properly is what makes the next ten deliberate.",
    steps: [
      {
        label: "01 · Measure",
        title: "Margin, not revenue",
        body: "Track what each machine takes home after product, commission, and fees — monthly, per machine.",
      },
      {
        label: "02 · Investigate",
        title: "Watch the 3% line",
        body: "Compare telemetry sales to cash and card collected. A persistent gap over roughly 3% is a problem, not noise.",
      },
      {
        label: "03 · Decide",
        title: "Fix, tune, or move",
        body: "Past the 18 to 24 month payback window, reassess the placement against your target return.",
      },
    ],
    features: [
      {
        eyebrow: "Track the right number",
        title:
          "A busy machine and a profitable machine are not the same machine.",
        body: "Revenue per machine is the number everybody quotes and the least useful one to run a route on. What matters is what is left after product, commission, and card processing — roughly 20% to 35%, or about $40 to $120 per machine per month on a typical placement. Track that per machine, every month, and the decisions about what to fix and what to move make themselves.",
        points: [
          "Record sales, product cost, commission, and processing per machine per month",
          "Expect 20% to 35% net on a healthy placement",
          "Back sales tax out before you call anything profit",
          "Compare machines against each other, not against a target you invented",
        ],
        stats: [
          { value: "20–35%", label: "Net margin on a healthy placement" },
          { value: "$40–$120", label: "Net per machine, per month" },
        ],
      },
      {
        eyebrow: "Find the leaks",
        title: "A persistent gap over 3% is not noise.",
        body: "Telemetry reports what the machine sold. Your deposits report what you collected. Those two numbers should agree closely, and when they do not, the difference is theft, miscounts, or a jammed bill validator — not bad luck. Check it monthly. A gap that persists over roughly 3% is worth investigating properly, because it will not correct itself and it compounds across every machine you add.",
        points: [
          "Reconcile telemetry sales against cash and card collected, every month",
          "Treat a persistent variance over roughly 3% as a problem to investigate",
          "Check the bill validator before assuming theft — jams are common and silent",
          "Fix it on machine one before the same blind spot runs across twenty",
        ],
        stats: [
          {
            value: "3%",
            label: "Variance above which a gap is a problem, not noise",
          },
          {
            value: "Monthly",
            label: "How often to reconcile telemetry against collections",
          },
        ],
      },
      {
        eyebrow: "Act on it",
        title: "Tune it, or admit the location is the problem.",
        body: "Most underperformance is fixable with product and price changes, and that is where to start. But some locations were never going to work, and the honest move is to stop paying for the mistake and relocate the machine when the term allows. A well-placed machine typically pays back its cost in 18 to 24 months — past that window, it is worth reassessing the placement against what that machine could earn somewhere else.",
        points: [
          "Start with product and price; most underperformance is fixable",
          "Reassess any placement that has not paid back inside 18 to 24 months",
          "Watch for seasonal patterns before you condemn a location on one quiet month",
          "Use machine one's real numbers to make the case for machine two",
        ],
      },
    ],
    closing: {
      title: "One machine you understand beats five you don't.",
      body: "Bring your numbers and we'll go through what they're telling you and what the next placement should look like.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        {
          label: "Get the finance templates",
          href: "/resources/finance-templates",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "Finance Templates",
        body: "The free spreadsheet members use to track margin per machine and flag shrink.",
        href: "/resources/finance-templates",
      },
    ],
  },
  {
    slug: "scale",
    parent: PARENT,
    breadcrumb: "Scale Your Vending Route",
    eyebrow: "Step 07",
    title: "Scale your vending route",
    blurb:
      "Hand off the restocking before you add machines, and know the machine count a full-time income actually needs.",
    intro:
      "Scaling is not adding machines. It is removing yourself from the parts of the route that do not need you, so that adding machines does not add hours. The operators who get this wrong end up with a bigger job. The ones who get it right end up with a business.",
    metaTitle: "How to Scale a Vending Route",
    metaDescription:
      "Hand off restocking first, understand what a full-time income actually requires in machine count, and know when buying an existing route beats placing another machine.",
    ctas: [
      { label: "Talk to an operator", href: "/contact" },
      { label: "See Real Routes", href: "/case-studies", variant: "ghost" },
    ],
    testimonials: [],
    thesis:
      "Every machine you add multiplies whatever your route already is. Fix the system on three machines, because it will not get easier to fix on thirty.",
    steps: [
      {
        label: "01 · Delegate",
        title: "Hand off the restocking",
        body: "The first scaling lever is not another machine. It is the route no longer eating your time.",
      },
      {
        label: "02 · Add",
        title: "Place the proven format again",
        body: "Repeat what already works in your market rather than experimenting on every new placement.",
      },
      {
        label: "03 · Systemize",
        title: "Build it to run without you",
        body: "Members run routes on 2 to 15 hours a week because the route runs on a system, not on their memory.",
      },
    ],
    features: [
      {
        eyebrow: "Delegate first",
        title: "Add help before you add machines.",
        body: "Most operators hit their ceiling somewhere around the third or fourth location, when servicing the route stops fitting around the rest of their life. The instinct is to slow down placing. The better move is to hand off the restocking, because restocking is the part of this business that scales worst with your own time and best with someone else's. That is the point the job turns into an operation.",
        points: [
          "Hand off restocking first — it's the highest-hours, lowest-judgement task",
          "Document the route before you delegate it, not after",
          "Keep the decisions: pricing, product, locations, contracts",
          "Members run placed routes on roughly 2 to 15 hours a week",
        ],
        media: {
          src: "/images/content/scale.avif",
          width: 1600,
          height: 1067,
          alt: "A warehouse aisle of racked inventory ready for a route",
        },
      },
      {
        eyebrow: "Know the target",
        title: "What a full-time income actually requires.",
        body: "A route of 15 to 25 or more well-placed machines is usually what generates a meaningful full-time income — somewhere around $1,200 to $3,000 or more per month in net profit. A six-figure net points to a route in the low-to-mid dozens of well-placed machines. Those are net figures, after product, commission, and fees, and the word doing the work in both of them is well-placed.",
        points: [
          "15 to 25+ machines is the usual threshold for meaningful full-time income",
          "That looks like roughly $1,200 to $3,000+ per month in net profit",
          "A six-figure net points to low-to-mid dozens of well-placed machines",
          "Machine count without placement quality just multiplies a weak result",
        ],
        stats: [
          {
            value: "15–25+",
            label: "Well-placed machines for a full-time income",
          },
          {
            value: "$1,200–$3,000+",
            label: "Net profit per month at that count",
          },
          { value: "2–15 hrs", label: "A week to run a placed route" },
        ],
      },
      {
        eyebrow: "Two ways to grow",
        title: "Place the next machine, or buy somebody else's route.",
        body: "Organic growth through pop-ins is the path most operators start on and it stays available forever. The other path is acquisition: buying an existing route or book of accounts from an operator who is exiting. It moves faster and costs capital up front, and it comes with somebody else's placement decisions — which you now know how to evaluate, because you have run steps one through six on your own machines.",
        points: [
          "Organic: repeat the pitch that worked, in the building type that worked",
          "Acquisition: buy an existing route and inherit its accounts immediately",
          "Evaluate an acquisition on the same per-machine margin you use on your own",
          "Either path needs the service capacity in place before, not after",
        ],
      },
    ],
    closing: {
      title: "Build the route you meant to build.",
      body: "Bring where your route is now and we'll go through what the next hire, the next placement, or the next acquisition should be.",
      ctas: [
        { label: "Talk to an operator", href: "/contact" },
        {
          label: "National Contracts",
          href: "/solutions/national-contracts",
          variant: "ghost",
        },
      ],
    },
    related: [
      {
        title: "National Contracts",
        body: "The accounts that place machines across many buildings at once.",
        href: "/solutions/national-contracts",
      },
      {
        title: "Case Studies",
        body: "Operators who started exactly where you are, and what their routes look like now.",
        href: "/case-studies",
      },
    ],
  },
];

export function listProcessSlugs(): ReadonlyArray<string> {
  return processSteps.map((step) => step.slug);
}

export function getProcessStep(slug: string): ProcessStep | undefined {
  return processSteps.find((step) => step.slug === slug);
}

/**
 * Prev/next cards for a step, derived from `processSteps` order so the
 * sequence can never drift out of sync with the pages themselves.
 */
export function processNeighbours(slug: string): ReadonlyArray<PageRelated> {
  const index = processSteps.findIndex((step) => step.slug === slug);
  if (index < 0) return [];
  const cards: PageRelated[] = [];
  const previous = processSteps[index - 1];
  const next = processSteps[index + 1];
  if (previous) {
    cards.push({
      title: `Previous: ${previous.breadcrumb}`,
      body: previous.blurb,
      href: `/process/${previous.slug}`,
    });
  }
  if (next) {
    cards.push({
      title: `Next: ${next.breadcrumb}`,
      body: next.blurb,
      href: `/process/${next.slug}`,
    });
  }
  return cards;
}

export { PARENT as processParent };
