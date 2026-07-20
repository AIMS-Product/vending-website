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
