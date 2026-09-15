"use client";

import { useEffect } from "react";

/**
 * Sends a visitor to the pre-call resources page the moment they finish
 * booking inside an embedded Calendly.
 *
 * Calendly's inline embed posts lifecycle messages to the page hosting it —
 * that is what `embed_domain` in buildCalendlySrc switches on — and
 * `calendly.event_scheduled` fires once the booking is actually confirmed, not
 * when a time is merely clicked. Every booking surface on the site renders the
 * calendar through CalendlyEmbed, so mounting this beside the iframe covers all
 * of them at once.
 *
 * The origin check is load-bearing: `message` events arrive from any frame on
 * the page, so without it any embedded third party could push our visitors to
 * an arbitrary route. Only calendly.com may trigger this navigation, and the
 * destination is a hardcoded internal path — never anything read off the event.
 *
 * Navigates rather than router-pushes: this is a funnel handoff, not in-app
 * routing, so a clean document load is the right behaviour (and it keeps the
 * component renderable outside a mounted app router).
 */

const DESTINATION = "/pre-call-resources";
const CALENDLY_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*calendly\.com$/;

function isEventScheduled(event: MessageEvent): boolean {
  if (!CALENDLY_ORIGIN.test(event.origin)) return false;
  const data: unknown = event.data;
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { event?: unknown }).event === "calendly.event_scheduled"
  );
}

export function CalendlyBookingRedirect() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isEventScheduled(event)) return;
      // The calendar can sit inside an iframe on a page we do not own (none
      // today, but the embed is reusable) — send the top window, not the frame,
      // so the resources page never renders letterboxed inside the embed.
      // Cross-origin tops throw on access, so fall back to this window.
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.assign(DESTINATION);
          return;
        }
      } catch {
        // Top is cross-origin and unreachable; navigate this window instead.
      }
      // A router push would make this component require a mounted app router,
      // which every server-render test of a page carrying a calendar would then
      // have to stub. This is a funnel handoff to a page that fetches its own
      // data, so a document load is the right behaviour anyway.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(DESTINATION);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}

// Exported for the test — the guard is the security boundary, so it is worth
// asserting directly rather than only through a rendered component.
export const __testing = { isEventScheduled, DESTINATION };
