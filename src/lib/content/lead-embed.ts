import type { LeadAttribution } from "@/lib/lead-attribution";

/**
 * A conversion page either embeds a Typeform form or a Calendly scheduler
 * directly in-page (no off-site redirect). The mapping is driven by the
 * Vendingpreneurs Migration Sheet — see docs/migration/conversion-pages.md.
 */
export type LeadEmbed =
  | { kind: "typeform"; formId: string }
  | { kind: "calendly"; url: string };

/**
 * The host Calendly/Typeform use for embed attribution + resize postMessage.
 * Rendering works regardless of the value; this only affects the third-party
 * analytics domain and iframe messaging.
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
 * Build the inline Typeform src with UTM + source attribution passed as
 * hidden-field query params. Typeform maps matching hidden fields
 * (utm_source, utm_medium, utm_campaign, utm_term, utm_content, source_path,
 * vp_session_id) so the lead stays attributed inside Typeform.
 */
export function buildTypeformSrc(
  formId: string,
  attribution: LeadAttribution,
): string {
  const params = new URLSearchParams();
  params.set("typeform-embed", "embed-widget");
  for (const [key, value] of utmPairs(attribution)) params.set(key, value);
  if (attribution.source_path)
    params.set("source_path", attribution.source_path);
  if (attribution.vp_session_id) {
    params.set("vp_session_id", attribution.vp_session_id);
  }
  return `https://form.typeform.com/to/${formId}?${params.toString()}`;
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
