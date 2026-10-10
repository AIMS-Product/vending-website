/**
 * Where a visitor goes the moment they finish booking a call, and the one
 * function that sends them there.
 *
 * Kody's ask (Slack, 2026-09-15): every booker should land on the pre-call
 * resources page, to lift show rates and cut calls-to-close. Bookings happen on
 * two independent surfaces — the page embeds (CalendlyBookingRedirect) and the
 * chat widget's own calendar — so the destination lives here rather than being
 * written down twice and drifting.
 *
 * Navigates rather than router-pushes: this is a funnel handoff to a page that
 * fetches its own data, and it keeps both callers free of a router dependency.
 */

import { markBookedCall } from "@/lib/tracking/booked-call";

export const PRE_CALL_RESOURCES_PATH = "/pre-call-resources";

/**
 * `inviteeUri` is the Calendly invitee on the confirmed booking; it marks the
 * booked-call conversion that /pre-call-resources reports after the navigation.
 */
export function goToPreCallResources(inviteeUri: string | null = null): void {
  markBookedCall(inviteeUri);
  // A calendar can sit inside an iframe on a page we do not own (none today,
  // but both embeds are reusable) — send the top window so the resources page
  // never renders letterboxed. Cross-origin tops throw on access, so fall back.
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(PRE_CALL_RESOURCES_PATH);
      return;
    }
  } catch {
    // Top is cross-origin and unreachable; navigate this window instead.
  }
  window.location.assign(PRE_CALL_RESOURCES_PATH);
}
