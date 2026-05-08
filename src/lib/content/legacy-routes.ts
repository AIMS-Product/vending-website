export type LegacyLeadVariant =
  | "advisory"
  | "market"
  | "schedule"
  | "webinar"
  | "eligibility"
  | "watch"
  | "cashflow"
  | "quiz"
  | "journey"
  | "join";

export type LegacyLeadRoute = {
  slug: string;
  path: `/${string}`;
  metadataTitle: string;
  pageTitle: string;
  description: string;
  variant: LegacyLeadVariant;
};

const advisoryHeadline =
  "How Everyday People Are Building $5k-$60k Per Month Vending Routes Without Quitting Their Job or Figuring It Out Alone";

const advisoryDescription =
  "Book a free vending route advisory call and get a clear read on your market, startup position, and next step.";

const marketHeadline = "Your Market May Still Be Open. Let's Find Out.";

const marketDescription =
  "Share your location and timeline so the team can see whether your region is still a fit for a new Vendingpreneurs route.";

const cashflowHeadline =
  "How Regular People Build Cash-Flowing Vending Businesses (With No Experience)";

const cashflowDescription =
  "Watch the path from first machine to route-building plan, then apply for the call that maps the next step.";

const watchHeadline =
  "How Regular People Are Building Profitable Vending Routes With Smart Machines, Real Support, and a Proven System";

const journeyDescription =
  "Start with the 90-day blueprint and get the framework for locations, machines, products, and support.";

function route(
  slug: string,
  metadataTitle: string,
  pageTitle: string,
  description: string,
  variant: LegacyLeadVariant,
): LegacyLeadRoute {
  return {
    slug,
    path: `/${slug}`,
    metadataTitle,
    pageTitle,
    description,
    variant,
  };
}

function advisory(
  slug: string,
  metadataTitle = "Book Your Vending Route Advisory Call",
) {
  return route(
    slug,
    metadataTitle,
    advisoryHeadline,
    advisoryDescription,
    "advisory",
  );
}

function market(
  slug: string,
  metadataTitle = "Book Your Vending Route Advisory Call",
) {
  return route(
    slug,
    metadataTitle,
    marketHeadline,
    marketDescription,
    "market",
  );
}

function watch(slug: string, metadataTitle: string) {
  return route(
    slug,
    metadataTitle,
    watchHeadline,
    "See how the Vendingpreneurs system combines smart machines, support, and a practical route-building plan.",
    "watch",
  );
}

function cashflow(slug: string, metadataTitle: string) {
  return route(
    slug,
    metadataTitle,
    cashflowHeadline,
    cashflowDescription,
    "cashflow",
  );
}

export const legacyLeadRoutes = [
  advisory("booking-meta"),
  market("booking-ltf", "booking/ltf"),
  advisory("booking-youtube"),
  market("booking-website", "booking/website"),
  market("booking-organicmisc", "booking/organicmisc"),
  market("booking-podcast", "booking/podcast"),
  advisory("booking-reactivation-email"),
  market("booking-reactivation-scraper", "booking/reactivation-scraper"),
  advisory("booking-ig"),
  advisory("booking-linkedin"),
  advisory("booking-x"),
  advisory("booking-internal-ltf"),
  advisory("booking-passivepreneurs"),
  advisory("booking-partner"),
  advisory("booking-tiktok"),
  market("booking-vendingpreneurs-training"),
  route(
    "schedule-your-call-ig",
    "Schedule Your Call",
    "You're In the Right Place.",
    "Confirm the best way for the team to help you prepare for a vending route advisory call.",
    "schedule",
  ),
  market("book-your-call"),
  route(
    "start",
    "booking/vendingpreneurs-webinar",
    "You Saw How It Works. Now Let's Build Your Route.",
    "Turn the webinar into a concrete route plan with the next step, the right market, and the right support.",
    "webinar",
  ),
  route(
    "location-eligibility",
    "Location Eligibility",
    "Thanks for your interest!",
    "Tell us where you want to operate so the team can review your location fit and follow up with the right next step.",
    "eligibility",
  ),
  watch("vending-blueprint", "Vending Route Blueprint | Watch Now"),
  market(
    "start-your-route-ak-ig",
    "Start Your Vending Route | Vendingpreneurs",
  ),
  market("start-your-route-ak-tt", "Start Your Vending Route"),
  market("start-my-vending-business", "Book Your Vending Route Advisory Call"),
  watch("build-income-with-vending", "Build Income With Vending | Watch Now"),
  cashflow("vending-route-blueprint", "Vending Route Blueprint | Watch Now"),
  route(
    "test-leadscore-a",
    "TEST",
    "Are you located in the US or Canada?",
    "Answer the core qualification questions and the team will point you toward the right call path.",
    "quiz",
  ),
  route(
    "vending-business-blueprint",
    "90-Day Vending Machine Business Blueprint | VendingPreneurs",
    "Your Vendingpreneur Journey Starts Here",
    journeyDescription,
    "journey",
  ),
  route(
    "join",
    "Join Vendingpreneurs - Apply to Build Your Vending Route",
    "For People Ready to Own a Real Income Stream",
    "Apply to join the Vendingpreneurs community and start building a route with the right process and support.",
    "join",
  ),
  advisory("apply-vendingpreneurs", "Book Your Free Vending Advisory Call"),
  cashflow("vending-training", "Vending Training"),
] satisfies readonly LegacyLeadRoute[];

const legacyLeadRouteBySlug: ReadonlyMap<string, LegacyLeadRoute> = new Map(
  legacyLeadRoutes.map((route) => [route.slug, route]),
);

export function getLegacyLeadRoute(slug: string) {
  return legacyLeadRouteBySlug.get(slug);
}
