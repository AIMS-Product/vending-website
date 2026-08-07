import {
  parseAttributionSession,
  VP_ATTRIBUTION_STORAGE_KEY,
  type AttributionSession,
} from "@/lib/attribution-session";

/**
 * Every event_type the attribution pipeline carries. One list feeds both the
 * browser emitters (tracker, popups) and the route's zod schema, so a new
 * event type cannot be emitted without the route accepting it.
 *
 * `popup_converted` fires when a lead form succeeds in a tab whose visit was
 * driven by a popup CTA click (marker below) — that is what feeds the
 * "Converted" stat tile in /admin/popups.
 */
export const ATTRIBUTION_EVENT_TYPES = [
  "landing_viewed",
  "cta_clicked",
  "form_started",
  "popup_shown",
  "popup_cta_clicked",
  "popup_converted",
  "popup_dismissed",
] as const;

export type AttributionEventType = (typeof ATTRIBUTION_EVENT_TYPES)[number];

export function readStoredAttributionSession(): AttributionSession | null {
  try {
    return parseAttributionSession(
      window.localStorage.getItem(VP_ATTRIBUTION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget event post to the first-party attribution route.
 * sendBeacon survives page unload (exit-intent popups, CTA navigations);
 * fetch keepalive is the fallback.
 */
export function emitAttributionEvent(
  eventType: AttributionEventType,
  session: AttributionSession,
  properties: Record<string, string | undefined>,
) {
  const occurredAt = new Date().toISOString();
  const payload = {
    event_type: eventType,
    external_id: `vending-website:${eventType}:${session.vp_session_id}:${Date.now()}`,
    occurred_at: occurredAt,
    vp_session_id: session.vp_session_id,
    properties: compact({
      ...sessionProperties(session),
      ...properties,
    }),
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/attribution/events",
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  }

  void fetch("/api/attribution/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

const VP_POPUP_ATTRIBUTION_KEY = "vp_popup_cta";

/** Called by SitePopup when a visitor clicks a popup CTA (never in preview). */
export function markPopupCtaClicked(popupId: string) {
  try {
    window.sessionStorage.setItem(
      VP_POPUP_ATTRIBUTION_KEY,
      JSON.stringify({ popup_id: popupId }),
    );
  } catch {
    // Storage unavailable — the conversion just won't attribute.
  }
}

/**
 * Emits `popup_converted` once if this tab's lead submission was driven by a
 * popup CTA, then clears the marker so one click never counts twice.
 * ponytail: sessionStorage = same-tab attribution window; a visitor who
 * returns in a new tab converts unattributed. Move to localStorage + TTL if
 * that gap matters.
 */
export function emitPopupConversionIfAttributed(
  properties: Record<string, string | undefined> = {},
) {
  try {
    const raw = window.sessionStorage.getItem(VP_POPUP_ATTRIBUTION_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(VP_POPUP_ATTRIBUTION_KEY);
    const popupId: unknown = JSON.parse(raw)?.popup_id;
    if (typeof popupId !== "string" || !popupId) return;
    const session = readStoredAttributionSession();
    if (!session) return;
    emitAttributionEvent("popup_converted", session, {
      popup_id: popupId,
      page_path: window.location.pathname,
      ...properties,
    });
  } catch {
    // Attribution is best-effort; never break the form's success path.
  }
}

function sessionProperties(session: AttributionSession) {
  return {
    first_landing_url: session.first_landing_url,
    first_landing_path: session.first_landing_path,
    first_referrer: session.first_referrer,
    first_touch_at: session.first_touch_at,
    latest_landing_url: session.latest_landing_url,
    latest_landing_path: session.latest_landing_path,
    latest_referrer: session.latest_referrer,
    latest_touch_at: session.latest_touch_at,
    utm_source: session.utm_source,
    utm_medium: session.utm_medium,
    utm_campaign: session.utm_campaign,
    utm_term: session.utm_term,
    utm_content: session.utm_content,
    gclid: session.gclid,
    fbclid: session.fbclid,
    gbraid: session.gbraid,
    wbraid: session.wbraid,
    paid_platform: session.paid_platform,
    paid_source_key: session.paid_source_key,
    campaign_id: session.campaign_id,
    campaign_name: session.campaign_name,
    adset_id: session.adset_id,
    adset_name: session.adset_name,
    ad_group_id: session.ad_group_id,
    ad_group_name: session.ad_group_name,
    group_id: session.group_id,
    group_name: session.group_name,
    ad_id: session.ad_id,
    ad_name: session.ad_name,
  };
}

function compact(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value && value.trim()),
  );
}
