"use client";

import { useEffect } from "react";
import {
  parseAttributionSession,
  serializeAttributionSession,
  updateAttributionSessionFromPage,
  VP_ATTRIBUTION_STORAGE_KEY,
  VP_SESSION_COOKIE_NAME,
  type AttributionSession,
} from "@/lib/attribution-session";
import {
  appendSessionClickAttributionToHref,
  shouldPreserveLeadAttribution,
  type LeadAttributionLinkContext,
} from "@/lib/lead-attribution-links";

type AttributionEventType = "landing_viewed" | "cta_clicked";

export function AttributionSessionTracker() {
  useEffect(() => {
    const session = refreshStoredSession();
    if (session) {
      emitAttributionEvent("landing_viewed", session, {
        landing_url: window.location.href,
        landing_path: window.location.pathname,
        referrer: document.referrer,
      });
    }

    document.addEventListener("click", handleAttributionClick, {
      capture: true,
    });
    return () =>
      document.removeEventListener("click", handleAttributionClick, true);
  }, []);

  return null;
}

function handleAttributionClick(event: MouseEvent) {
  if (shouldIgnoreClick(event)) return;

  const target = leadLinkFromEvent(event);
  if (!target) return;

  preserveLeadLinkAttribution(event, target.anchor, target.href);
}

function refreshStoredSession() {
  try {
    const session = updateAttributionSessionFromPage({
      href: window.location.href,
      referrer: document.referrer,
      existing: readStoredSession(),
      nowIso: new Date().toISOString(),
      sessionIdFactory: browserSessionId,
    });
    window.localStorage.setItem(
      VP_ATTRIBUTION_STORAGE_KEY,
      serializeAttributionSession(session),
    );
    document.cookie = `${VP_SESSION_COOKIE_NAME}=${encodeURIComponent(
      session.vp_session_id,
    )}; Path=/; Max-Age=15552000; SameSite=Lax`;
    return session;
  } catch {
    return null;
  }
}

function readStoredSession() {
  try {
    return parseAttributionSession(
      window.localStorage.getItem(VP_ATTRIBUTION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function browserSessionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function shouldIgnoreClick(event: MouseEvent) {
  return [
    event.defaultPrevented || event.button !== 0,
    event.metaKey,
    event.ctrlKey || event.shiftKey || event.altKey,
  ].some(Boolean);
}

function leadLinkFromEvent(event: MouseEvent) {
  const anchor = anchorFromEvent(event);
  const href = anchor?.getAttribute("href") ?? "";
  return anchor && shouldPreserveLeadAttribution(href)
    ? { anchor, href }
    : null;
}

function preserveLeadLinkAttribution(
  event: MouseEvent,
  anchor: HTMLAnchorElement,
  href: string,
) {
  const stored = readStoredSession();
  const context = linkContext(anchor, href);
  const nextHref = appendSessionClickAttributionToHref({
    href,
    session: stored,
    context,
  });

  if (nextHref !== href) anchor.setAttribute("href", nextHref);
  if (stored) emitClickEvent(stored, context, href, nextHref);
  if (nextHref === href) return;

  event.preventDefault();
  window.location.assign(nextHref);
}

function emitClickEvent(
  session: AttributionSession,
  context: LeadAttributionLinkContext,
  clickedHref: string,
  destinationHref: string,
) {
  emitAttributionEvent("cta_clicked", session, {
    ...eventPropertiesFromContext(context),
    clicked_href: clickedHref,
    destination_href: destinationHref,
  });
}

function anchorFromEvent(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  return eligibleAnchor(target?.closest<HTMLAnchorElement>("a[href]") ?? null);
}

function eligibleAnchor(anchor: HTMLAnchorElement | null) {
  return anchor && anchor.target !== "_blank" && !anchor.download
    ? anchor
    : null;
}

function linkContext(
  anchor: HTMLAnchorElement,
  href: string,
): LeadAttributionLinkContext {
  return {
    sourcePath: window.location.pathname,
    sourcePageId: anchor.dataset.vpSourcePageId,
    sourcePageSlug: anchor.dataset.vpSourcePageSlug,
    targetKeyword: anchor.dataset.vpTargetKeyword,
    sourceBlockId: anchor.dataset.vpSourceBlockId,
    sourceCtaTrackingName:
      anchor.dataset.vpSourceCtaTrackingName ?? anchor.dataset.trackingName,
    clickedHref: href,
  };
}

function emitAttributionEvent(
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

function eventPropertiesFromContext(context: LeadAttributionLinkContext) {
  return Object.fromEntries(
    [
      ["source_path", context.sourcePath],
      ["source_page_id", context.sourcePageId],
      ["source_page_slug", context.sourcePageSlug],
      ["target_keyword", context.targetKeyword],
      ["source_block_id", context.sourceBlockId],
      ["source_cta_tracking_name", context.sourceCtaTrackingName],
    ].filter(([, value]) => value),
  ) as Record<string, string>;
}

function compact(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value && value.trim()),
  );
}
