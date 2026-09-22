import { bookingPages } from "./booking-pages";
import { CONTACT_CLONE_SLUGS } from "./contact-clone-pages";

/**
 * Every booking funnel: /contact, /book-now, the contact clones and the
 * social-ad landers. One list, because two separate rules key off it.
 *
 * 1. No chrome (Adam, 2026-09-17). Every nav link, footer link and "Get in
 *    touch" button on these pages is a way out, and their only job is the form.
 *    Dropping the footer does not strand the Privacy Policy — PublicLeadForm
 *    and ApplyDisclaimer both link it on all of them.
 * 2. Links pointing at them keep their UTM attribution. This used to ride on
 *    `legacyLeadRoutes`, so it silently covered only the pages that had not
 *    been rebuilt yet: the four social-ad landers never qualified, and the
 *    contact clones stopped qualifying the moment they became real routes.
 *    Keying both rules off one list is what stops that drifting again.
 *
 * The clone and social-ad routes are read off their own registries so a new
 * booking page is covered the day it is added.
 */
const HAND_WRITTEN_BOOKING_ROUTES = ["/contact", "/book-now"] as const;

export const BOOKING_FUNNEL_PATHS: readonly string[] = [
  ...HAND_WRITTEN_BOOKING_ROUTES,
  ...CONTACT_CLONE_SLUGS.map((slug) => `/${slug}`),
  ...Object.values(bookingPages).map((page) => page.path),
];

const BOOKING_FUNNEL_PATH_SET: ReadonlySet<string> = new Set(
  BOOKING_FUNNEL_PATHS,
);

/** True on a booking funnel: no header, no footer, and links keep their UTMs. */
export function isBookingFunnelPath(pathname: string): boolean {
  return BOOKING_FUNNEL_PATH_SET.has(pathname);
}

/**
 * The surfaces a lead reaches *after* the form: the scored result page (its
 * four fit states are query params on one route), the apply thank-you, and the
 * qualification questionnaire between them.
 *
 * Deliberately NOT in BOOKING_FUNNEL_PATHS. That list also drives UTM
 * preservation on links pointing at a route, and these are redirect targets —
 * nothing links to them from an ad, so claiming them as attribution
 * destinations would be a lie. `/qualify` already earns its attribution
 * separately, as a LEAD_DESTINATION_PREFIX in lead-attribution-links.ts.
 *
 * Chrome comes off for the same reason it does on the funnels (Adam,
 * 2026-09-17): the lead's next step is the calendar embed or their inbox, and
 * a nav bar reopens the whole site the moment they convert.
 */
const POST_CONVERSION_PATHS = [
  "/thank-you",
  "/thank-you-for-applying",
] as const;

const POST_CONVERSION_PATH_SET: ReadonlySet<string> = new Set(
  POST_CONVERSION_PATHS,
);

/**
 * True anywhere the site chrome stays off: the booking funnels and everything
 * after the form. Header, footer and the chatbot's unprompted teaser all key
 * off this. Attribution keys off `isBookingFunnelPath` instead — the two
 * questions have different answers and must not be collapsed.
 */
export function isFunnelChromePath(pathname: string): boolean {
  if (isBookingFunnelPath(pathname)) return true;
  if (POST_CONVERSION_PATH_SET.has(pathname)) return true;
  // The questionnaire is one dynamic route per session token.
  return pathname.startsWith("/qualify/");
}

/**
 * True where the chatbot keeps its unprompted teaser to itself: everywhere the
 * chrome is off, plus /pre-call-resources. That page keeps its header and
 * footer, but everyone on it has already booked, and the teaser opens with
 * "Looking into starting a vending business?" over the middle of a phone
 * screen, on top of the videos they were sent there to watch. The launcher
 * still renders, so a question before the call is one tap away.
 */
export function suppressesChatTeaser(pathname: string): boolean {
  return isFunnelChromePath(pathname) || pathname === "/pre-call-resources";
}
