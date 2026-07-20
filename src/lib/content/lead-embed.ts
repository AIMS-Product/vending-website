import type { LeadAttribution } from "@/lib/lead-attribution";

/**
 * A conversion page may embed a Calendly scheduler directly in-page. All other
 * conversion pages use the native lead form (which captures the lead in our
 * database with full UTM/source attribution). See docs/migration/conversion-pages.md.
 */
export type LeadEmbed = { kind: "calendly"; url: string };

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
  attribution: LeadAttribution,
): string {
  const target = new URL(url);
  target.searchParams.set("embed_domain", EMBED_DOMAIN);
  target.searchParams.set("embed_type", "Inline");
  target.searchParams.set("hide_gdpr_banner", "1");
  for (const [key, value] of utmPairs(attribution)) {
    target.searchParams.set(key, value);
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
