/**
 * CTA destinations for the four fit-based qualification states, shared by the
 * inline /contact result panel and the standalone /thank-you route so the two
 * surfaces never drift.
 *
 * Each destination Kody signed off on is the source of truth below, with an
 * optional `NEXT_PUBLIC_*` env override so a link can be repointed without a
 * code change. The routing by score (per Kody, 2026-07-23):
 *
 *   Not the right time (0-40):  primary  -> free 90-Day Vending Roadmap
 *                               secondary-> setter call (quick discovery)
 *   Good potential   (41-64):  primary  -> setter call (quick discovery)
 *   Strong fit       (65-84):  primary  -> Lane 1 consultation
 *   Perfect fit      (85-100): primary  -> Lane 1 top-closer consultation
 */

import type { ThankYouStateKey } from "@/lib/qualification/scoring";

// Free 90-Day Vending Roadmap opt-in lander (the "download the guide" surface).
const ROADMAP_URL =
  process.env.NEXT_PUBLIC_ROADMAP_URL ?? "/vending-business-blueprint";

// Setter / quick-discovery call — lower-intent leads (not-right-time secondary
// + good-potential primary).
const SETTER_CALENDLY_URL =
  process.env.NEXT_PUBLIC_SETTER_CALENDLY_URL ??
  "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery";

// Lane 1 consultation — strong-fit leads.
const LANE_1_CALENDLY_URL =
  process.env.NEXT_PUBLIC_LANE_1_CALENDLY_URL ??
  "https://calendly.com/d/cxfn-hh2-h8g/vendingpreneurs-consultation";

// Lane 1 top-closer consultation — perfect-fit leads.
const LANE_1_TOP_CALENDLY_URL =
  process.env.NEXT_PUBLIC_LANE_1_TOP_CALENDLY_URL ??
  "https://calendly.com/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call";

export const THANK_YOU_LINKS = {
  roadmapUrl: ROADMAP_URL,
  setterCalendlyUrl: SETTER_CALENDLY_URL,
  lane1CalendlyUrl: LANE_1_CALENDLY_URL,
  lane1TopCalendlyUrl: LANE_1_TOP_CALENDLY_URL,
} as const;

export type ThankYouLinkKey = keyof typeof THANK_YOU_LINKS;

type ThankYouStateLinks = {
  readonly primary: ThankYouLinkKey;
  readonly secondary?: ThankYouLinkKey;
};

/**
 * Maps each fit state's CTA(s) to the link they point at (copy lives in
 * THANK_YOU_STATES, src/lib/qualification/scoring.ts). Only `not_right_time`
 * defines a secondary CTA — its download-first primary plus a book-a-call
 * fallback.
 */
export const THANK_YOU_STATE_LINKS: Record<
  ThankYouStateKey,
  ThankYouStateLinks
> = {
  perfect_fit: { primary: "lane1TopCalendlyUrl" },
  strong_fit: { primary: "lane1CalendlyUrl" },
  good_potential: { primary: "setterCalendlyUrl" },
  not_right_time: { primary: "roadmapUrl", secondary: "setterCalendlyUrl" },
};
