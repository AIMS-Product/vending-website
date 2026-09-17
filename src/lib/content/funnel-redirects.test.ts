import { describe, expect, it } from "vitest";
import { FUNNEL_REDIRECTS, FUNNEL_REDIRECT_SOURCES } from "./funnel-redirects";
import { getLegacyLeadRoute } from "./legacy-routes";
import { CONTACT_CLONE_SLUGS } from "./contact-clone-pages";
import { bookingPages } from "./booking-pages";
import { APP_TOP_LEVEL_PAGE_SEGMENTS } from "@/lib/routing/single-segment-routes";
import { shouldPreserveLeadAttribution } from "@/lib/lead-attribution-links";
import { buildLeadAttribution } from "@/lib/lead-attribution";

/**
 * Adam's redirect sheet, 2026-09-17. Every row is asserted literally: a wrong
 * destination drops a paid visitor on the wrong persona's lander, and a missing
 * `source_path` attributes their booking to the destination so the channel that
 * paid for the click disappears from reporting.
 */
const SHEET: ReadonlyArray<readonly [string, string]> = [
  ["/apply-vendingpreneurs", "/contact"],
  ["/booking-tiktok", "/booking-t5-socials"],
  ["/booking-linkedin", "/booking-t5-socials"],
  ["/booking-insta-b5", "/booking-t5-socials"],
  ["/start-your-route-ak-ig", "/booking-ak-t5"],
  ["/booking-ak-x", "/booking-ak-t5"],
  ["/booking-ak-linkedin", "/booking-ak-t5"],
  ["/start-my-vending-business", "/contact"],
  ["/booking-b5-socials", "/booking-t5-socials"],
  ["/booking-ak-b5", "/booking-ak-t5"],
  ["/book-my-advisory-call-accelerator", "/contact"],
];

describe("funnel redirects", () => {
  it("covers every row of the sheet and nothing else", () => {
    expect([...FUNNEL_REDIRECT_SOURCES].sort()).toEqual(
      SHEET.map(([source]) => source).sort(),
    );
  });

  it.each(SHEET)("sends %s to %s", (source, destination) => {
    const redirect = FUNNEL_REDIRECTS.find((r) => r.source === source);
    expect(redirect).toBeDefined();
    const url = new URL(redirect!.destination, "https://example.com");
    expect(url.pathname).toBe(destination);
  });

  it("carries the original path so the channel survives the hop", () => {
    for (const redirect of FUNNEL_REDIRECTS) {
      const url = new URL(redirect.destination, "https://example.com");
      expect(
        url.searchParams.get("source_path"),
        `${redirect.source} must keep its own source_path`,
      ).toBe(redirect.source);
    }
  });

  /*
    Root-cause guard. next.config redirects run before filesystem routing and
    before the proxy, so a source that is also a page or a legacy lead route is
    unreachable config that still reads as live. /booking-b5-socials and
    /booking-tiktok were both real pages until this sheet landed.
  */
  it("never redirects from a path that still renders a page", () => {
    for (const source of FUNNEL_REDIRECT_SOURCES) {
      const slug = source.slice(1);
      expect(
        APP_TOP_LEVEL_PAGE_SEGMENTS.has(slug),
        `${source} redirects but src/app/${slug} still exists`,
      ).toBe(false);
      expect(
        getLegacyLeadRoute(slug),
        `${source} redirects but is still a legacy lead route`,
      ).toBeUndefined();
    }
  });

  it("never redirects away from a live funnel", () => {
    const live = [
      "/contact",
      "/book-now",
      ...CONTACT_CLONE_SLUGS.map((slug) => `/${slug}`),
      ...Object.values(bookingPages).map((page) => page.path),
    ];
    for (const source of FUNNEL_REDIRECT_SOURCES) {
      expect(live, `${source} is still a live funnel`).not.toContain(source);
    }
  });

  it("points every redirect at a destination that exists", () => {
    for (const redirect of FUNNEL_REDIRECTS) {
      const slug = new URL(
        redirect.destination,
        "https://example.com",
      ).pathname.slice(1);
      expect(
        APP_TOP_LEVEL_PAGE_SEGMENTS.has(slug),
        `${redirect.source} points at /${slug}, which is not a page`,
      ).toBe(true);
    }
  });

  /*
    End to end: feed the redirect's own destination query back through the
    attribution builder the destination page runs. The lead must report the
    retired URL it came from, not the page it landed on — otherwise every
    consolidated channel collapses into /booking-t5-socials in reporting.
  */
  it.each(SHEET)(
    "attributes a lead from %s to itself",
    (source, destination) => {
      const redirect = FUNNEL_REDIRECTS.find((r) => r.source === source)!;
      const query = new URL(redirect.destination, "https://example.com")
        .searchParams;
      const attribution = buildLeadAttribution(
        Object.fromEntries(query.entries()),
        destination,
      );
      expect(attribution.source_path).toBe(source);
      expect(attribution.landing_path).toBe(destination);
    },
  );

  it("keeps UTMs on links pointing at a retired URL", () => {
    for (const source of FUNNEL_REDIRECT_SOURCES) {
      expect(shouldPreserveLeadAttribution(source), source).toBe(true);
    }
  });
});
