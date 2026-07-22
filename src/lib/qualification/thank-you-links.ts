/**
 * CTA destinations for the /thank-you route's four fit-based states.
 *
 * `NEXT_PUBLIC_DEFAULT_CALENDLY_URL` is the single source of truth for the
 * booking link; the fallback below is a clearly-marked placeholder so local
 * dev and unset environments never render a broken href.
 *
 * `not_right_time` leads book a readiness session (the same call) rather than a
 * "90-Day Guide" — that guide asset doesn't exist yet, so we don't link to it.
 * When Kody ships a real guide, add a `guideUrl` here and a secondary CTA back
 * onto the not_right_time state.
 */

import type { ThankYouStateKey } from "@/lib/qualification/scoring";

const PLACEHOLDER_CALENDLY_URL = "https://calendly.com/vendingpreneurs/intro";

export const THANK_YOU_LINKS = {
  calendlyUrl:
    process.env.NEXT_PUBLIC_DEFAULT_CALENDLY_URL ?? PLACEHOLDER_CALENDLY_URL,
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
 * Maps each fit state's `cta` to the link it should point at (copy lives in
 * THANK_YOU_STATES, src/lib/qualification/scoring.ts). No state currently
 * defines a secondary CTA.
 */
export const THANK_YOU_STATE_LINKS: Record<
  ThankYouStateKey,
  ThankYouStateLinks
> = {
  perfect_fit: { primary: "calendlyUrl" },
  strong_fit: { primary: "calendlyUrl" },
  good_potential: { primary: "calendlyUrl" },
  not_right_time: { primary: "readinessUrl" },
};
