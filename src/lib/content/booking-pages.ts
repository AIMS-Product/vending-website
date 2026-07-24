// Config + copy for the social-ad booking landing pages (Kody's sheet, rows
// 51-54). These clone the /contact apply landing but swap the qualification
// quiz for a simplified "Book Your Call" form that captures the lead (with UTM
// attribution) and then redirects straight to a per-page Calendly. Two personas:
// the default (Mike) copy, and an Anthony variant with his own VSL + copy.
//
// Every visible string traces back to this module (page/component conventions).
// Anthony copy is reproduced verbatim from Kody — do NOT reword.

import {
  applyFaq,
  applyHero,
  applyVsl,
  type RichSegment,
} from "@/lib/content/apply-page";

export type BookingPersona = "mike" | "anthony";

export type BookingPageConfig = {
  readonly slug: string;
  readonly path: `/${string}`;
  readonly persona: BookingPersona;
  /** Calendar the form hands the lead off to after capture. */
  readonly calendlyUrl: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
};

// Lane 1 booking calendars (from the sheet). t5 pages send the top tier of
// social leads to the top-closer calendar; b5 pages send everyone else to the
// general Lane 1 calendar.
const LANE_1_TOP_CALENDLY =
  "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";
const LANE_1_GENERAL_CALENDLY =
  "https://calendly.com/d/cxfn-hh2-h8g/vendingpreneurs-consultation";

const bookingMetaDescription =
  "Book your free vending route call. Get a clear read on your market, your startup position, and the next step to launch your route in 90 days.";

// Anthony-persona copy overrides (Kody-approved, verbatim).
export const anthonyBookingCopy = {
  heroBody:
    "You get the same playbook, systems, and scripts Anthony used, plus exclusive product discounts, 1:1 support, and custom tools. Everything you need to launch quickly and build your route without costly mistakes.",
  vsl: {
    badge: "Free training",
    watchLabel: "Watch Anthony's story",
    youtubeId: "ksvldfarH-U",
    videoHref: "https://youtu.be/ksvldfarH-U",
    caption: [
      { text: "That's " },
      { text: "Anthony Kolodziej", strong: true },
      {
        text: ". Laid off from a 14-year real estate career in 2023 with zero vending experience, he used a reversed, location-first system — find the spot first, then place the machine — to grow to 87 machines across 48 locations. It's the same playbook, tools, and coaching he teaches and Vendingpreneurs members follow now.",
      },
    ] satisfies RichSegment[],
  },
  // Only the "Do I need experience?" answer changes for Anthony's pages.
  faqExperienceQuestion: "Do I need experience?",
  faqExperienceAnswer: "No. Anthony and most members started with none.",
} as const;

export type BookingVsl = {
  readonly badge: string;
  readonly watchLabel: string;
  readonly youtubeId: string;
  readonly videoHref: string;
  readonly caption: readonly RichSegment[];
};

export type BookingCopy = {
  readonly heroBody: string;
  readonly vsl: BookingVsl;
  readonly faqItems: readonly { readonly q: string; readonly a: string }[];
};

/**
 * Resolve the persona-specific copy for a booking page. The Mike persona reuses
 * the live /contact apply copy unchanged; the Anthony persona swaps the hero
 * subcopy, the VSL video + caption, and the single "Do I need experience?" FAQ
 * answer. Every other section stays persona-neutral.
 */
export function resolveBookingCopy(config: BookingPageConfig): BookingCopy {
  if (config.persona !== "anthony") {
    return {
      heroBody: applyHero.body,
      vsl: applyVsl,
      faqItems: applyFaq.items,
    };
  }

  return {
    heroBody: anthonyBookingCopy.heroBody,
    vsl: anthonyBookingCopy.vsl,
    faqItems: applyFaq.items.map((item) =>
      item.q === anthonyBookingCopy.faqExperienceQuestion
        ? { q: item.q, a: anthonyBookingCopy.faqExperienceAnswer }
        : item,
    ),
  };
}

function bookingPage(
  slug: string,
  persona: BookingPersona,
  calendlyUrl: string,
  metaTitle: string,
): BookingPageConfig {
  return {
    slug,
    path: `/${slug}`,
    persona,
    calendlyUrl,
    metaTitle,
    metaDescription: bookingMetaDescription,
  };
}

export const bookingPages = {
  "booking-t5-socials": bookingPage(
    "booking-t5-socials",
    "mike",
    LANE_1_TOP_CALENDLY,
    "Book Your Call | Vendingpreneurs",
  ),
  "booking-b5-socials": bookingPage(
    "booking-b5-socials",
    "mike",
    LANE_1_GENERAL_CALENDLY,
    "Book Your Call | Vendingpreneurs",
  ),
  "booking-ak-t5": bookingPage(
    "booking-ak-t5",
    "anthony",
    LANE_1_TOP_CALENDLY,
    "Book Your Call | Vendingpreneurs",
  ),
  "booking-ak-b5": bookingPage(
    "booking-ak-b5",
    "anthony",
    LANE_1_GENERAL_CALENDLY,
    "Book Your Call | Vendingpreneurs",
  ),
} as const satisfies Record<string, BookingPageConfig>;

export type BookingSlug = keyof typeof bookingPages;
