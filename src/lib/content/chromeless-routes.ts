import { bookingPages } from "./booking-pages";

/**
 * The booking funnels render with no site header and no footer (Adam,
 * 2026-09-17): every nav link, footer link and "Get in touch" button on these
 * pages is a way out, and the only job of these pages is the booking form.
 *
 * The four social-ad routes are read off the booking registry so a new one is
 * covered the day it is added; the four hand-written funnels are listed here
 * because they have no registry entry.
 *
 * Compliance note: dropping the footer does not strand the Privacy Policy —
 * PublicLeadForm and ApplyDisclaimer both link it on every one of these pages.
 */
const HAND_WRITTEN_BOOKING_ROUTES = [
  "/contact",
  "/book-now",
  "/booking-youtube",
  "/booking-meta",
] as const;

export const CHROMELESS_ROUTES: readonly string[] = [
  ...HAND_WRITTEN_BOOKING_ROUTES,
  ...Object.values(bookingPages).map((page) => page.path),
];

/** True on a booking funnel, where the header and footer must not render. */
export function isChromelessRoute(pathname: string): boolean {
  return CHROMELESS_ROUTES.includes(pathname);
}
