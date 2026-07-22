/**
 * CTA destinations for the /thank-you route's four fit-based states.
 *
 * `NEXT_PUBLIC_DEFAULT_CALENDLY_URL` is the single source of truth for the
 * booking link; the fallback below is a clearly-marked placeholder so local
 * dev and unset environments never render a broken href. `guideUrl` is a
 * placeholder route until the 90-Day Startup Guide page ships — swap it out
 * there once that content exists.
 */

import type { ThankYouStateKey } from "@/lib/qualification/scoring";

const PLACEHOLDER_CALENDLY_URL = "https://calendly.com/vendingpreneurs/intro";
const PLACEHOLDER_GUIDE_URL = "/guides/90-day-startup";

export const THANK_YOU_LINKS = {
  calendlyUrl:
    process.env.NEXT_PUBLIC_DEFAULT_CALENDLY_URL ?? PLACEHOLDER_CALENDLY_URL,
  guideUrl: PLACEHOLDER_GUIDE_URL,
  // The readiness-session CTA books the same call as the primary CTA — kept
  // as its own key so the mapping below stays self-documenting and either
  // link can diverge later without touching the map.
  readinessUrl:
    process.env.NEXT_PUBLIC_DEFAULT_CALENDLY_URL ?? PLACEHOLDER_CALENDLY_URL,
} as const;

export type ThankYouLinkKey = keyof typeof THANK_YOU_LINKS;

type ThankYouStateLinks = {
  readonly primary: ThankYouLinkKey;
  readonly secondary?: ThankYouLinkKey;
};

/**
 * Maps each fit state's `cta` / `secondaryCta` (copy lives in
 * THANK_YOU_STATES, src/lib/qualification/scoring.ts) to the link it should
 * point at. Only `not_right_time` has a secondary CTA.
 */
export const THANK_YOU_STATE_LINKS: Record<
  ThankYouStateKey,
  ThankYouStateLinks
> = {
  perfect_fit: { primary: "calendlyUrl" },
  strong_fit: { primary: "calendlyUrl" },
  good_potential: { primary: "calendlyUrl" },
  not_right_time: { primary: "guideUrl", secondary: "readinessUrl" },
};
