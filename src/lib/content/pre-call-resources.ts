// Copy for /pre-call-resources — the single link sales sends to a prospect
// after a strategy call is booked. Body copy is Alysia's (Slack, 2026-08-17),
// reproduced close to verbatim; do not reword without her.

export const preCallMeta = {
  title: "Pre-Call Resources",
  description:
    "Meet Mike, see what Vendingpreneurs actually is, and get more out of your upcoming vending strategy call.",
} as const;

export const preCallHero = {
  eyebrow: "Pre-call resources",
  title: "Get the most out of your upcoming call.",
  paragraphs: [
    "Most of our members have been following Mike for years. They know who he is, his journey, and why vending can be such a powerful entry point into owning your own business.",
    "That may not be your situation. We want to help you get to know Mike, get to know the program, and start to answer “is this right for me” even before you chat with our team.",
  ],
  // Alysia left the runtime blank pending the final cut — fill the number in
  // here (e.g. "quick 9-minute video") once she confirms it.
  kicker:
    "So the easiest thing to do? Watch the quick video below. It's your crash course on what Vendingpreneurs is all about.",
} as const;

/**
 * Feeds the shared ApplyVsl frame. Today it plays Mike's existing YouTube VSL
 * so the page is useful the moment sales starts sending it. Alysia's Vidalytics
 * cut replaces it — see the swap note in PreCallResourcesPage.
 */
export const preCallVsl = {
  // No subtitle: the hero kicker directly above already introduces the video,
  // and a second lead-in stacked three lines of centered copy on the frame.
  title: "Meet Mike",
  badge: "Watch first",
  watchLabel: "Watch Mike's story",
  youtubeId: "P-Z1BZ9M-Fg",
  videoHref: "https://youtu.be/P-Z1BZ9M-Fg",
  caption: [
    {
      text: "Mike breaks down how the business model works, what makes a location worth pursuing, and how he and others have built a vending route with no experience while working a 9-to-5.",
    },
  ],
} as const;

/**
 * Proof band. The full case-studies page carries ten written testimonials;
 * dropping all ten here buried the prep checklist under a wall of text, so this
 * page shows every video plus three short written ones and links out for the
 * rest. Ids index caseStudyQuotes in ./case-studies.
 */
export const preCallProof = {
  eyebrow: "Real members",
  title: "Real people, real routes.",
  body: "A few members on what actually changed after they joined.",
  quoteIds: ["kyle-sharp", "lonny-carter", "nolan-mayfield"],
  moreCta: { label: "See all case studies", href: "/case-studies" },
} as const;

export const preCallPrep = {
  eyebrow: "Before we talk",
  title: "Come to the call with these three things.",
  body: "A focused call is easier when the business basics are already clear.",
  items: [
    "Know the city or region where you want to place machines.",
    "Bring any location, machine, or financing questions you already have.",
    "Review your available budget and the timeline you want to work toward.",
  ],
} as const;

export const preCallNext = {
  title: "Haven't booked your call yet?",
  body: "Grab a time that works for you and we'll walk through your situation together.",
  cta: { label: "Book Your Free Strategy Call", href: "/contact" },
} as const;
