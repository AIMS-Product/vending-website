import { SENTRY_PII_PARAMS, scrubDeep } from "./sentry-scrub";

/**
 * PostHog `before_send` scrub. posthog-js boots before StripPiiParams runs, so
 * the first $pageview (and $initial_current_url, $referrer, $set/$set_once
 * copies, $snapshot meta hrefs) would carry the GHL link's contact params.
 * Every string anywhere in the event is run through the shared URL scrubber:
 * PII param values become [Filtered], every other param (utm_*) is kept.
 * Returns a new event; the input is not mutated.
 */
export function scrubPostHogEvent<T>(event: T): T {
  return scrubDeep(event);
}

/** Same param list, for posthog-js `custom_personal_data_properties`. */
export const POSTHOG_PII_PARAMS: string[] = [...SENTRY_PII_PARAMS];
