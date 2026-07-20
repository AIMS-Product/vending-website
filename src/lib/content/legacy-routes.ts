import type { LeadEmbed } from "@/lib/content/lead-embed";

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
  | "join"
  | "callBooking";

export type LegacyLeadRoute = {
  slug: string;
  path: `/${string}`;
  metadataTitle: string;
  pageTitle: string;
  description: string;
  variant: LegacyLeadVariant;
  indexable: boolean;
  /**
   * When set, the conversion CTA is a native in-page Calendly scheduler instead
   * of the built-in lead form. Every other page uses the native form so the
   * lead is captured in our database with UTM/source attribution. See
   * docs/migration/conversion-pages.md.
   */
  embed?: LeadEmbed;
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

type RouteOptions = { indexable?: boolean; embed?: LeadEmbed };

/** Calendly embed shorthand. */
const calendly = (url: string): LeadEmbed => ({ kind: "calendly", url });

function route(
  slug: string,
  metadataTitle: string,
  pageTitle: string,
  description: string,
  variant: LegacyLeadVariant,
  options: RouteOptions = {},
): LegacyLeadRoute {
  return {
    slug,
    path: `/${slug}`,
    metadataTitle,
    pageTitle,
    description,
    variant,
    indexable: options.indexable ?? false,
    embed: options.embed,
  };
}

function advisory(
  slug: string,
  metadataTitle = "Book Your Vending Route Advisory Call",
  options: RouteOptions = {},
) {
  return route(
    slug,
    metadataTitle,
    advisoryHeadline,
    advisoryDescription,
    "advisory",
    options,
  );
}

function market(
  slug: string,
  metadataTitle = "Book Your Vending Route Advisory Call",
  options: RouteOptions = {},
) {
  return route(
    slug,
    metadataTitle,
    marketHeadline,
    marketDescription,
    "market",
    options,
  );
}

function cashflow(
  slug: string,
  metadataTitle: string,
  options: RouteOptions = {},
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
  // --- Booking pages on the native lead form ---
  // These were Typeform embeds; converted to the built-in form so every lead
  // is captured in our database with full UTM/source attribution (Typeform kept
  // the lead off-site). No `embed` => LegacyLeadPageContent renders the native
  // PublicLeadForm, which preserves UTM via hidden fields + the stored
  // first-touch attribution session.
  advisory("booking-meta"),
  advisory("booking-youtube"),
  advisory("booking-reactivation-email"),
  // booking-ig / booking-insta-b5: Action = "Redirects to Calendly only" —
  // embed the Calendly scheduler as the primary CTA.
  advisory("booking-ig", undefined, {
    embed: calendly(
      "https://calendly.com/d/dv5d-5zj-g8b/vendingpreneurs-consultation-session",
    ),
  }),
  advisory("booking-insta-b5", undefined, {
    embed: calendly(
      "https://calendly.com/d/dz4t-wrw-3nk/vendingpreneurs-strategy-session",
    ),
  }),
  advisory("booking-linkedin"),
  advisory("booking-x"),
  advisory("booking-ak-x"),
  advisory("booking-ak-linkedin"),
  advisory("booking-internal-ltf"),
  advisory("booking-passivepreneurs"),
  advisory(
    "booking-modern-entrepreneur-newsletter",
    "Modern Entrepreneur Newsletter",
  ),
  advisory("booking-partner"),
  advisory("booking-tiktok"),
  // --- Calendly advisory-call booking pages ---
  // Copy mirrors the live Webflow pages: setter is a 15-minute discovery call;
  // accelerator / l1 variants are the 45-minute advisory call.
  route(
    "book-my-advisory-call-setter",
    "Book Your Discovery Call",
    "Book Your Free Discovery Call",
    "You've been dreaming about building something of your own. Let's get you an answer. In 15 minutes, we'll unpack your questions, your goals, and see if we're a good fit.",
    "callBooking",
    {
      embed: calendly(
        "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery",
      ),
    },
  ),
  route(
    "book-my-advisory-call-accelerator",
    "Book Your Accelerator Call",
    "Book Your Free Advisory Call",
    "You've been dreaming about building something of your own. Let's get you an answer. In 45 minutes, we'll walk through your numbers, your schedule, and your market, and decide whether vending is a smart second income for you.",
    "callBooking",
    {
      embed: calendly(
        "https://calendly.com/d/cxv9-jg6-m53/vending-accelerator-call",
      ),
    },
  ),
  route(
    "book-my-advisory-call-l1-topcl",
    "Book Your Consultation Call",
    "Book Your Free Advisory Call",
    "You've been dreaming about building something of your own. Let's get you an answer. In 45 minutes, we'll walk through your numbers, your schedule, and your market, and decide whether vending is a smart second income for you.",
    "callBooking",
    {
      embed: calendly(
        "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call",
      ),
    },
  ),
  route(
    "book-my-advisory-call-l1",
    "Book Your Consultation Call",
    "Book Your Free Advisory Call",
    "You've been dreaming about building something of your own. Let's get you an answer. In 45 minutes, we'll walk through your numbers, your schedule, and your market, and decide whether vending is a smart second income for you.",
    "callBooking",
    {
      embed: calendly(
        "https://calendly.com/d/cxfn-hh2-h8g/vendingpreneurs-consultation",
      ),
    },
  ),
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
    "Book Your Vending Route Advisory Call",
    "You Saw How It Works. Now Let's Build Your Route.",
    "Turn the webinar into a concrete route plan with the next step, the right market, and the right support.",
    "webinar",
    {
      embed: calendly(
        "https://calendly.com/d/cxwj-zxk-2z4/vending-route-advisory-call",
      ),
    },
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
