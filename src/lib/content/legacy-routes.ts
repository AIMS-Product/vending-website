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
  indexable: boolean;
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

const journeyDescription =
  "Start with the 90-day blueprint and get the framework for locations, machines, products, and support.";

function route(
  slug: string,
  metadataTitle: string,
  pageTitle: string,
  description: string,
  variant: LegacyLeadVariant,
  options: { indexable?: boolean } = {},
): LegacyLeadRoute {
  return {
    slug,
    path: `/${slug}`,
    metadataTitle,
    pageTitle,
    description,
    variant,
    indexable: options.indexable ?? false,
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

function cashflow(
  slug: string,
  metadataTitle: string,
  options: { indexable?: boolean } = {},
) {
  return route(
    slug,
    metadataTitle,
    cashflowHeadline,
    cashflowDescription,
    "cashflow",
    options,
  );
}

export const legacyLeadRoutes = [
  advisory("booking-meta"),
  advisory("booking-youtube"),
  advisory("booking-reactivation-email"),
  advisory("booking-ig"),
  advisory("booking-linkedin"),
  advisory("booking-x"),
  advisory("booking-internal-ltf"),
  advisory("booking-passivepreneurs"),
  advisory(
    "booking-modern-entrepreneur-newsletter",
    "Modern Entrepreneur Newsletter",
  ),
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
  market(
    "start-your-route-ak-ig",
    "Start Your Vending Route | Vendingpreneurs",
  ),
  market("start-your-route-ak-tt", "Start Your Vending Route"),
  market("start-my-vending-business", "Book Your Vending Route Advisory Call"),
  cashflow("vending-route-blueprint", "Vending Route Blueprint | Watch Now", {
    indexable: true,
  }),
  route(
    "vending-business-blueprint",
    "90-Day Vending Machine Business Blueprint | VendingPreneurs",
    "Your Vendingpreneur Journey Starts Here",
    journeyDescription,
    "journey",
    { indexable: true },
  ),
  advisory("apply-vendingpreneurs", "Book Your Free Vending Advisory Call"),
] satisfies readonly LegacyLeadRoute[];

const legacyLeadRouteBySlug: ReadonlyMap<string, LegacyLeadRoute> = new Map(
  legacyLeadRoutes.map((route) => [route.slug, route]),
);

export function getLegacyLeadRoute(slug: string) {
  return legacyLeadRouteBySlug.get(slug);
}
