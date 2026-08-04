import type { LeadAttribution } from "@/lib/lead-attribution";
import type { LeadIntent } from "@/app/lead-action-state";
import type { ThankYouStateKey } from "@/lib/qualification/scoring";

/**
 * GTM dataLayer events for the lead forms and the post-qualification booking
 * CTAs. Kept as pure builders (no DOM, no window) so the payload shape is
 * unit-testable; `pushDataLayerEvent` is the only impure piece, called from
 * the form's effects.
 *
 * Every event carries the same attribution slice — vp_session_id + the click
 * IDs + UTMs — so a GTM trigger can build Google/Meta Ads audiences and
 * offline-conversion imports off any of them without special-casing which
 * event fired.
 */

type BaseFields = {
  vp_session_id: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  intent: LeadIntent;
  form_step: number;
};

function baseFields(
  attribution: LeadAttribution,
  intent: LeadIntent,
  formStep: number,
): BaseFields {
  return {
    vp_session_id: attribution.vp_session_id,
    gclid: attribution.gclid,
    gbraid: attribution.gbraid,
    wbraid: attribution.wbraid,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    intent,
    form_step: formStep,
  };
}

export function formStartEvent(
  attribution: LeadAttribution,
  intent: LeadIntent,
  formStep: number,
) {
  return {
    event: "vp_form_start",
    ...baseFields(attribution, intent, formStep),
  };
}

export function leadSubmitEvent(
  attribution: LeadAttribution,
  intent: LeadIntent,
  formStep: number,
  fields: { leadEmail: string; leadPhone: string; idempotencyKey: string },
) {
  return {
    event: "vp_lead_submit",
    ...baseFields(attribution, intent, formStep),
    lead_email: fields.leadEmail,
    lead_phone: fields.leadPhone,
    idempotency_key: fields.idempotencyKey,
  };
}

export function leadQualifiedEvent(
  attribution: LeadAttribution,
  intent: LeadIntent,
  formStep: number,
  fields: {
    leadEmail: string;
    leadPhone: string;
    idempotencyKey: string;
    qualificationState: ThankYouStateKey;
    qualificationScore: number;
  },
) {
  return {
    event: "vp_lead_qualified",
    ...baseFields(attribution, intent, formStep),
    lead_email: fields.leadEmail,
    lead_phone: fields.leadPhone,
    idempotency_key: fields.idempotencyKey,
    qualification_state: fields.qualificationState,
    qualification_score: fields.qualificationScore,
  };
}

export function leadSubmitErrorEvent(
  attribution: LeadAttribution,
  intent: LeadIntent,
  formStep: number,
  errorKeys: string[],
) {
  return {
    event: "vp_lead_submit_error",
    ...baseFields(attribution, intent, formStep),
    error_keys: errorKeys,
  };
}

export function bookingClickEvent(
  attribution: LeadAttribution,
  intent: LeadIntent,
  fields: { bookingHref: string; qualificationState?: ThankYouStateKey },
) {
  return {
    event: "vp_booking_click",
    ...baseFields(attribution, intent, 0),
    booking_href: fields.bookingHref,
    qualification_state: fields.qualificationState ?? "",
  };
}

/**
 * The only impure export. No-ops outside the browser (SSR) and before GTM's
 * loader has initialized `window.dataLayer` — GoogleTagManager always sets it
 * up before hydration finishes, but this stays defensive rather than assuming
 * load order.
 */
export function pushDataLayerEvent(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
