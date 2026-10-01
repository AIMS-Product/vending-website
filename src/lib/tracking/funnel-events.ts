import { MASTERCLASS_BUSY_MESSAGE } from "@/lib/content/masterclass";
import { pushDataLayerEvent } from "@/lib/tracking/lead-events";
import { captureEvent, SEND_NOW } from "@/lib/tracking/posthog";

/**
 * Webinar-funnel events for GA4 (via the GTM dataLayer) and PostHog. Payload
 * builders are pure and carry field NAMES, reasons and UTMs only: never an
 * email, phone or name value. Meta is deliberately absent: GHL's server-side
 * CAPI already sends CompleteRegistration, a client event would double count.
 */

export const MASTERCLASS_FORM_ID = "masterclass-step-1";
export const INTAKE_FORM_ID = "intake-step-1";
export const REGISTERED_STORAGE_KEY = "vp_masterclass_registered";

const UTM_KEYS = ["utm_source", "utm_campaign", "utm_content"] as const;

export type RegistrationFailureReason = "validation" | "busy" | "failed";

/** utm_source / utm_campaign / utm_content from a query string, when present. */
export function pickUtms(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 100);
  }
  return out;
}

/**
 * Why a registration came back with errors. A field error is a validation
 * failure; a form-level error is the limiter (busy) or a server failure.
 */
export function registrationFailure(
  errors: Record<string, string | undefined>,
): {
  reason: RegistrationFailureReason;
  errorKeys: string[];
} {
  const errorKeys = Object.keys(errors).filter((key) => errors[key]);
  const fieldKeys = errorKeys.filter((key) => key !== "form");
  if (fieldKeys.length > 0) return { reason: "validation", errorKeys };
  const reason = errors.form === MASTERCLASS_BUSY_MESSAGE ? "busy" : "failed";
  return { reason, errorKeys };
}

export function registeredEvents(utms: Record<string, string>) {
  return {
    posthog: { form_id: MASTERCLASS_FORM_ID, intent: "masterclass", ...utms },
    dataLayer: [
      {
        event: "masterclass_registered",
        intent: "masterclass",
        form_step: 1,
        ...utms,
      },
      // The site's existing GA4 conversion name. No lead_email/lead_phone:
      // this page has no business holding them.
      { event: "vp_lead_submit", intent: "masterclass", form_step: 1, ...utms },
    ],
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** True the first time per key in this storage (session), false after. */
export function claimOnce(storage: StorageLike | null, key: string): boolean {
  if (!storage) return true;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
  } catch {
    // Storage blocked (private mode): fire rather than lose the conversion.
  }
  return true;
}

export function checkoutClickEvents(placement: string, href: string) {
  let destination = href;
  try {
    const url = new URL(href);
    destination = `${url.host}${url.pathname}`;
  } catch {
    // Relative href: keep it, minus any query.
    destination = href.split("?")[0];
  }
  return {
    posthog: { placement, destination },
    dataLayer: { event: "vp_checkout_click", placement, destination },
  };
}

export function trackMasterclassRegistered() {
  if (!claimOnce(window.sessionStorage, REGISTERED_STORAGE_KEY)) return;
  const events = registeredEvents(pickUtms(window.location.search));
  captureEvent("masterclass_registered", events.posthog, SEND_NOW);
  events.dataLayer.forEach(pushDataLayerEvent);
}

/** Fire-and-forget: sendBeacon, never awaited, so navigation is not delayed. */
export function trackCheckoutClick(placement: string, href: string) {
  const events = checkoutClickEvents(placement, href);
  captureEvent("checkout_clicked", events.posthog, SEND_NOW);
  pushDataLayerEvent(events.dataLayer);
}

/**
 * A scroll-to-form CTA click (e.g. the sticky bar). Not "cta_clicked": that
 * name belongs to the attribution tracker's link clicks, a different schema.
 */
export function scrollCtaEvents(location: string) {
  return {
    posthog: { name: "scroll_cta_clicked", properties: { location } },
    dataLayer: { event: "vp_cta_click", location },
  };
}

export function trackCtaClick(location: string) {
  const events = scrollCtaEvents(location);
  captureEvent(events.posthog.name, events.posthog.properties, SEND_NOW);
  pushDataLayerEvent(events.dataLayer);
}
