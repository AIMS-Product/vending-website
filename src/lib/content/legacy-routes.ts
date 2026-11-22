import type { LeadEmbed } from "@/lib/content/lead-embed";

export type LegacyLeadVariant =
  | "advisory"
  | "market"
  | "schedule"
  | "webinar"
  | "cashflow"
  | "journey"
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
const calendly = (
  url: string,
  fallbackUtms?: LeadEmbed["fallbackUtms"],
): LeadEmbed => ({ kind: "calendly", url, fallbackUtms });

/**
 * The one marketing calendar (Dom, 2026-11-22): every marketing page books
 * "Vendingpreneurs Consultation Call" and the source is read from the UTMs on
 * the booking, never from which calendar it landed on.
 */
const CONSULTATION_CALL =
  "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";

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
  //
  // Two groups have left this list (2026-09-17). The migration sheet's "Clone
  // Contact" slugs are real routes under src/app now (contact-clone-pages.ts);
  // they had no calendar here at all, so the form captured a lead, sent them to
  // /thank-you-for-applying, and nobody could book from those channels. The
  // redirect sheet's retired URLs now 301 from next.config (funnel-redirects.ts)
  // and must not keep an entry here, which would never be reached.
  // booking-ig / booking-insta-b5: Action = "Redirects to Calendly only" —
  // embed the Calendly scheduler as the primary CTA. Booked its own calendar
  // ("Consultation Session", d/dv5d-5zj-g8b) until 2026-11-22; an untagged
  // visit is now credited to Instagram by tag instead of by calendar name.
  advisory("booking-ig", undefined, {
    embed: calendly(CONSULTATION_CALL, {
      utm_source: "instagram",
      utm_medium: "organic",
      utm_campaign: "booking-ig",
    }),
  }),
  advisory("booking-x"),
  advisory(
    "booking-modern-entrepreneur-newsletter",
    "Modern Entrepreneur Newsletter",
  ),
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
      // Still the webinar's own calendar: the webinar board counts a room's
      // bookings by this event type (vp-webinars booked-people.ts), so it moves
      // to CONSULTATION_CALL only after that rule reads the tag instead. The
      // fallback tag is the first half of that move.
      embed: calendly(
        "https://calendly.com/d/cxwj-zxk-2z4/vending-route-advisory-call",
        {
          utm_source: "internal-webinar",
          utm_medium: "owned",
          utm_campaign: "start",
        },
      ),
    },
  ),
  market("start-your-route-ak-tt", "Start Your Vending Route"),
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
] satisfies readonly LegacyLeadRoute[];

const legacyLeadRouteBySlug: ReadonlyMap<string, LegacyLeadRoute> = new Map(
  legacyLeadRoutes.map((route) => [route.slug, route]),
);

export function getLegacyLeadRoute(slug: string) {
  return legacyLeadRouteBySlug.get(slug);
}

/** True on a page rendered by `[legacyLeadPath]` — a booking or lead page. */
export function isLegacyLeadPath(pathname: string): boolean {
  return legacyLeadRouteBySlug.has(pathname.slice(1));
}
