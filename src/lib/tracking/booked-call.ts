import { pushDataLayerEvent } from "@/lib/tracking/lead-events";

/**
 * The booked-call conversion. Both booking surfaces (page embeds and the chat
 * calendar) hand off through goToPreCallResources the instant Calendly
 * confirms, so the booking is marked in sessionStorage there and reported here
 * on /pre-call-resources, after the navigation that would otherwise cancel
 * the request. A visitor who opens /pre-call-resources without booking has no
 * mark and reports nothing.
 *
 * Google Ads: a `conversion` to NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO
 * ("AW-18030483230/<label>") through the Google tag GTM already installs,
 * with the Calendly invitee id as transaction_id so a reload never counts
 * twice. GA4 gets `vp_call_booked` through the usual forward. No personal
 * data is sent.
 */
export const BOOKED_CALL_KEY = "vp_booked_call";

export function markBookedCall(inviteeUri: string | null): void {
  try {
    window.sessionStorage.setItem(
      BOOKED_CALL_KEY,
      bookingId(inviteeUri) ?? `booked-${Date.now()}`,
    );
  } catch (error) {
    // Storage blocked (private mode, quota): the booking itself is unaffected,
    // only this browser-side conversion is lost. Close still has the booking.
    console.warn("booked call: could not mark booking", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

/** The Calendly invitee UUID, the last path segment of its URI. */
export function bookingId(inviteeUri: string | null): string | null {
  if (!inviteeUri) return null;
  const id = inviteeUri.split("/").filter(Boolean).pop();
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

/** gtag `arguments` for the Ads conversion, or null when no send_to is set. */
export function adsConversionCommand(
  transactionId: string,
  sendTo: string | undefined,
): ["event", "conversion", Record<string, string>] | null {
  if (!sendTo || !/^AW-\d+\/[\w-]+$/.test(sendTo)) return null;
  return [
    "event",
    "conversion",
    { send_to: sendTo, transaction_id: transactionId },
  ];
}

/** Report a booking marked on the previous page, once. */
export function reportMarkedBookedCall(sendTo: string | undefined): void {
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(BOOKED_CALL_KEY);
    if (id) window.sessionStorage.removeItem(BOOKED_CALL_KEY);
  } catch (error) {
    console.warn("booked call: could not read booking mark", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return;
  }
  if (!id) return;
  pushDataLayerEvent({ event: "vp_call_booked" });
  const command = adsConversionCommand(id, sendTo);
  if (command) gtag(...command);
}

/** gtag.js only reads `arguments` objects from the dataLayer, not arrays. */
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}
