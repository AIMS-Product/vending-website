"use client";

import { useEffect } from "react";
import {
  goToPreCallResources,
  PRE_CALL_RESOURCES_PATH,
} from "@/lib/booking/post-booking-redirect";
import { captureEvent, SEND_NOW } from "@/lib/tracking/posthog";

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

export function CalendlyBookingRedirect({ url }: { url?: string }) {
  // PostHog behaviour markers for the calendar step. `calendar_viewed` is the
  // last pre-booking step the browser can see; `calendar_booked` is a
  // behaviour signal for replay filters, not a booked-call count (Close is).
  const calendarUrl = url ? calendarPathOnly(url) : undefined;
  useEffect(() => {
    captureEvent("calendar_viewed", { calendar_url: calendarUrl });
  }, [calendarUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isEventScheduled(event)) return;
      captureEvent(
        "calendar_booked",
        { surface: "page", calendar_url: calendarUrl },
        SEND_NOW,
      );
      goToPreCallResources();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [calendarUrl]);

  return null;
}

/** Calendly URLs carry the visitor's name/email as prefill params; keep only the calendar. */
function calendarPathOnly(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return undefined;
  }
}

// Exported for the test — the guard is the security boundary, so it is worth
// asserting directly rather than only through a rendered component.
export const __testing = {
  isEventScheduled,
  DESTINATION: PRE_CALL_RESOURCES_PATH,
};
