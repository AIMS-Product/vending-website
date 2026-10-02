/**
 * Sends the site's own funnel events to GA4 straight through the Google tag
 * that GTM installs, because the GTM container has no triggers for them
 * (checked 2026-10-01: GA4 had none of them). A gtag-style `arguments` push
 * on the shared dataLayer is read by that Google tag; `send_to` keeps it to
 * GA4 only. If GTM ever gets its own GA4 event tags for these names, remove
 * this or GA4 counts each twice.
 *
 * Only named events and named parameters pass: other site forms put
 * lead_email / lead_phone on the same dataLayer events for Google Ads, and
 * personal data must never reach GA4.
 */
export const GA4_MEASUREMENT_ID = "G-2SX78VE7VF";

const FORWARDED = new Set([
  "vp_form_start",
  "vp_lead_submit",
  "vp_lead_submit_error",
  "vp_lead_qualified",
  "vp_booking_click",
  "masterclass_registered",
  "vp_checkout_click",
  "vp_cta_click",
  "vp_calendar_add",
  "vp_playbook_click",
]);

const PARAMS = [
  "intent",
  "form_step",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "placement",
  "destination",
  "location",
  "detail",
  "reason",
  "qualification_state",
  "error_keys",
] as const;

type Ga4Params = Record<string, string | number>;

/** The gtag command for a dataLayer event, or null when it is not forwarded. */
export function ga4Command(
  event: Record<string, unknown>,
): ["event", string, Ga4Params] | null {
  const name = event.event;
  if (typeof name !== "string" || !FORWARDED.has(name)) return null;
  const params: Ga4Params = { send_to: GA4_MEASUREMENT_ID };
  for (const key of PARAMS) {
    const value = event[key];
    if (typeof value === "string" && value) params[key] = value.slice(0, 100);
    else if (typeof value === "number") params[key] = value;
    else if (Array.isArray(value) && value.length)
      params[key] = value.join(",").slice(0, 100);
  }
  return ["event", name, params];
}

/** gtag.js only reads `arguments` objects from the dataLayer, not arrays. */
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer?.push(arguments);
}

export function forwardToGa4(event: Record<string, unknown>) {
  const command = ga4Command(event);
  if (command) gtag(...command);
}
