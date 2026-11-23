import type { LeadAttribution } from "@/lib/lead-attribution";

/**
 * A conversion page may embed a Calendly scheduler directly in-page. All other
 * conversion pages use the native lead form (which captures the lead in our
 * database with full UTM/source attribution). See docs/migration/conversion-pages.md.
 */
export type LeadEmbed = {
  kind: "calendly";
  url: string;
  /**
   * Page defaults sent to Calendly for a visit that arrived with no utm_source.
   * Marketing books into one calendar, so the calendar's name no longer says
   * where a call came from; an untagged visit to a channel's own page is
   * credited to that page's channel instead. Applied only when the source is
   * missing, each field only where missing; a visit with its own source is
   * passed through exactly as it arrived. The campaign starts `untagged-` so a
   * page default can never be read as a real campaign.
   */
  fallbackUtms?: FallbackUtms;
};

export type FallbackUtms = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

/**
 * The host Calendly uses for embed attribution + resize postMessage. Rendering
 * works regardless of the value; this only affects the third-party analytics
 * domain and iframe messaging.
 */
export const EMBED_DOMAIN =
  process.env.NEXT_PUBLIC_SITE_DOMAIN?.trim() || "www.vendingpreneurs.com";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

function utmPairs(attribution: LeadAttribution): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const key of UTM_KEYS) {
    const value = attribution[key];
    if (value) pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Build the inline Calendly src. Calendly natively reads utm_* params for
 * attribution; embed_domain + embed_type=Inline render the scheduler in-page.
 */
export function buildCalendlySrc(
  url: string,
  attribution?: LeadAttribution,
  options?: {
    /** Hide the event name/duration/description block so the embed opens
     *  straight on the date picker — for surfaces whose own copy already
     *  frames the call. */
    hideDetails?: boolean;
    /** See LeadEmbed.fallbackUtms. */
    fallbackUtms?: FallbackUtms;
  },
): string {
  const target = new URL(url);
  target.searchParams.set("embed_domain", EMBED_DOMAIN);
  target.searchParams.set("embed_type", "Inline");
  target.searchParams.set("hide_gdpr_banner", "1");
  if (options?.hideDetails) {
    target.searchParams.set("hide_event_type_details", "1");
  }
  if (attribution) {
    for (const [key, value] of utmPairs(attribution)) {
      target.searchParams.set(key, value);
    }
  }
  if (options?.fallbackUtms && !target.searchParams.has("utm_source")) {
    // Page defaults describe a visit that arrived with no source of its own.
    // Each is filled only where missing, so an incoming medium or campaign
    // survives. A visitor who did arrive with a source gets nothing added:
    // inventing a medium or campaign beside a real source would put a page
    // default on the dashboard as if it were the link's own (a source-only paid
    // link would read as organic).
    for (const [key, value] of Object.entries(options.fallbackUtms)) {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    }
  }
  return target.toString();
}

/**
 * Build a full-page Calendly scheduling link used as the post-submit handoff
 * for a native lead form (form captures the lead → we send them to Calendly to
 * pick a time). Name/email are pre-filled from what they just typed so they
 * don't retype, and UTM attribution is carried through so the booking stays
 * attributed to the originating campaign. Unlike buildCalendlySrc this is a
 * top-level redirect target, not an inline iframe, so no embed params are set.
 */
export function buildCalendlyBookingUrl(
  url: string,
  prefill: {
    name?: string | null;
    email?: string | null;
    attribution?: LeadAttribution | null;
  } = {},
): string {
  const target = new URL(url);
  const name = prefill.name?.trim();
  const email = prefill.email?.trim();
  if (name) target.searchParams.set("name", name);
  if (email) target.searchParams.set("email", email);
  if (prefill.attribution) {
    for (const [key, value] of utmPairs(prefill.attribution)) {
      target.searchParams.set(key, value);
    }
  }
  return target.toString();
}

/**
 * A calendly.com scheduling link. Used to validate the optional Calendly
 * handoff configured on a lead form block before it reaches the public site.
 */
export function isCalendlyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "calendly.com" || url.hostname.endsWith(".calendly.com")
    );
  } catch {
    return false;
  }
}
