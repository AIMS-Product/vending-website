"use client";

import { useEffect } from "react";
import {
  goToPreCallResources,
  PRE_CALL_RESOURCES_PATH,
} from "@/lib/booking/post-booking-redirect";

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
 * The navigation itself lives in lib/booking/post-booking-redirect, shared with
 * the chat widget's calendar so both surfaces send bookers to the same place.
 */

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
      goToPreCallResources();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}

// Exported for the test — the guard is the security boundary, so it is worth
// asserting directly rather than only through a rendered component.
export const __testing = {
  isEventScheduled,
  DESTINATION: PRE_CALL_RESOURCES_PATH,
};
