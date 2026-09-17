/**
 * Retired funnel URLs and where they now land (Adam's redirect sheet,
 * 2026-09-17). Consumed by `next.config.ts`, which redirects before filesystem
 * routing, so a source here must NOT also exist as a page or a legacy lead
 * route — the page would never be reachable and the config would read as live.
 * `funnel-redirects.test.ts` fails if a source is ever shadowed that way.
 *
 * Every destination carries `?source_path=` so the lead keeps the channel that
 * sent it: without it, a booking from /booking-tiktok would be attributed to
 * /booking-t5-socials and the channel would vanish from reporting. Next passes
 * the visitor's own UTMs through on top of that, verified in production
 * against the existing /booking-ltf redirect.
 */
type FunnelRedirect = { readonly source: string; readonly destination: string };

function to(destination: string, sources: readonly string[]): FunnelRedirect[] {
  return sources.map((source) => ({
    source,
    destination: `${destination}?source_path=${encodeURIComponent(source)}`,
  }));
}

export const FUNNEL_REDIRECTS: readonly FunnelRedirect[] = [
  // Mike's social + partner surfaces consolidate onto the pre-qualified lander.
  // /booking-b5-socials was a live page until this sheet: general-lane traffic
  // now books the top-tier calendar along with everyone else.
  ...to("/booking-t5-socials", [
    "/booking-tiktok",
    "/booking-linkedin",
    "/booking-insta-b5",
    "/booking-b5-socials",
  ]),
  // Anthony's equivalents, same consolidation.
  ...to("/booking-ak-t5", [
    "/booking-ak-x",
    "/booking-ak-linkedin",
    "/start-your-route-ak-ig",
    "/booking-ak-b5",
  ]),
  // Everything else lands on the scored funnel.
  ...to("/contact", [
    "/apply-vendingpreneurs",
    "/start-my-vending-business",
    "/book-my-advisory-call-accelerator",
  ]),
];

export const FUNNEL_REDIRECT_SOURCES: readonly string[] = FUNNEL_REDIRECTS.map(
  (redirect) => redirect.source,
);
