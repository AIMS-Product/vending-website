"use client";

import { useEffect } from "react";
import {
  goToPreCallResources,
  PRE_CALL_RESOURCES_PATH,
} from "@/lib/booking/post-booking-redirect";
import {
  emitAttributionEvent,
  readStoredAttributionSession,
} from "@/lib/attribution-client";
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

/**
 * The invitee URI Calendly puts on a confirmed booking, or null.
 *
 * Only ever used as an opaque id the server re-validates; a junk value is
 * dropped there, so this only has to avoid throwing on odd payloads.
 */
function inviteeUriOf(event: MessageEvent): string | null {
  const payload = (event.data as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;
  const invitee = (payload as { invitee?: unknown }).invitee;
  if (!invitee || typeof invitee !== "object") return null;
  const uri = (invitee as { uri?: unknown }).uri;
  return typeof uri === "string" && uri.length <= 300 ? uri : null;
}

/**
 * Ties this booking to this browser before it leaves the page, so the pre-call
 * videos it watches next can be credited to the person who booked, not only
 * to people who filled a site form first. Sent by beacon, which survives the
 * navigation that follows. No session (tracking off) or no URI: nothing sent.
 */
function linkBookingToSession(inviteeUri: string | null): void {
  if (!inviteeUri) return;
  const session = readStoredAttributionSession();
  if (!session) return;
  emitAttributionEvent("booking_linked", session, { invitee_uri: inviteeUri });
}

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
      linkBookingToSession(inviteeUriOf(event));
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
  inviteeUriOf,
  DESTINATION: PRE_CALL_RESOURCES_PATH,
};
