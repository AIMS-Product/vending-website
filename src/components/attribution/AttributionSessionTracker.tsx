"use client";

import { useEffect } from "react";
import {
  serializeAttributionSession,
  updateAttributionSessionFromPage,
  VP_ATTRIBUTION_STORAGE_KEY,
  VP_SESSION_COOKIE_NAME,
  type AttributionSession,
} from "@/lib/attribution-session";
import {
  emitAttributionEvent,
  readStoredAttributionSession,
} from "@/lib/attribution-client";
import {
  appendSessionClickAttributionToHref,
  shouldPreserveLeadAttribution,
  type LeadAttributionLinkContext,
} from "@/lib/lead-attribution-links";

export function AttributionSessionTracker() {
  useEffect(() => {
    if (shouldSkipAttributionTracking(window.location.pathname)) return;

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

export function shouldSkipAttributionTracking(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
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
      existing: readStoredAttributionSession(),
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
  const stored = readStoredAttributionSession();
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
