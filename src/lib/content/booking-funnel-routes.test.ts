import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOKING_FUNNEL_PATHS,
  isBookingFunnelPath,
  isFunnelChromePath,
  suppressesChatTeaser,
} from "./booking-funnel-routes";
import { bookingPages } from "./booking-pages";
import { CONTACT_CLONE_SLUGS } from "./contact-clone-pages";
import { shouldPreserveLeadAttribution } from "@/lib/lead-attribution-links";

/**
 * The booking funnels render with no header and no footer (Adam, 2026-09-17).
 * A route that falls out of this list silently grows a nav bar full of exits
 * again, which is the failure this guards.
 */
describe("booking funnel routes", () => {
  it("covers the two hand-written funnels", () => {
    expect(isBookingFunnelPath("/contact")).toBe(true);
    expect(isBookingFunnelPath("/book-now")).toBe(true);
  });

  it("covers every contact clone in the registry", () => {
    for (const slug of CONTACT_CLONE_SLUGS) {
      expect(isBookingFunnelPath(`/${slug}`)).toBe(true);
    }
  });

  it("covers every social-ad booking route in the registry", () => {
    for (const page of Object.values(bookingPages)) {
      expect(isBookingFunnelPath(page.path)).toBe(true);
    }
    expect(BOOKING_FUNNEL_PATHS).toHaveLength(
      2 + CONTACT_CLONE_SLUGS.length + Object.keys(bookingPages).length,
    );
  });

  /*
    Both rules key off this one list on purpose. Attribution preservation used
    to ride on legacyLeadRoutes, which quietly excluded every page that had been
    rebuilt — so a link to a booking funnel dropped its UTMs. Asserting the two
    together is what keeps them from drifting apart again.
  */
  it("preserves link attribution on every funnel it covers", () => {
    for (const path of BOOKING_FUNNEL_PATHS) {
      expect(
        shouldPreserveLeadAttribution(path),
        `${path} must keep its UTMs`,
      ).toBe(true);
    }
  });

  it("leaves the rest of the site with its chrome", () => {
    for (const route of [
      "/",
      "/about",
      "/case-studies",
      "/news",
      "/resources/roadmap",
      "/pre-call-resources",
    ]) {
      expect(isBookingFunnelPath(route)).toBe(false);
      expect(isFunnelChromePath(route)).toBe(false);
    }
  });

  it("does not match a longer path that merely starts with a booking route", () => {
    expect(isBookingFunnelPath("/contact-us")).toBe(false);
    expect(isBookingFunnelPath("/booking-meta/extra")).toBe(false);
  });

  /*
    Every distraction on a booking funnel keys off this one list: the header,
    the footer, and the chatbot's unprompted teaser. Asserting all three from
    the same place is what stops one of them quietly coming back.
  */
  it("suppresses the chatbot's idle teaser on funnels", () => {
    const source = readFileSync(
      path.resolve(
        __dirname,
        "../../../",
        "src/components/chatbot/ChatWidget.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("suppressesChatTeaser(pathname)");
    expect(source).toContain("if (suppressIdleTeaser) return;");
  });

  it("keeps the teaser off the pre-call page without taking its chrome", () => {
    expect(suppressesChatTeaser("/pre-call-resources")).toBe(true);
    expect(isFunnelChromePath("/pre-call-resources")).toBe(false);
    expect(suppressesChatTeaser("/contact")).toBe(true);
    // Legacy lead pages are booking pages (UI audit, 2026-09-22): the teaser
    // opened over their Calendly grid. They drop the header and footer via
    // their own gate, not isFunnelChromePath (see below).
    expect(suppressesChatTeaser("/booking-ig")).toBe(true);
    expect(isFunnelChromePath("/booking-ig")).toBe(false);
    expect(suppressesChatTeaser("/")).toBe(false);
  });

  it.each([
    ["Header", "src/components/site/Header.tsx"],
    ["Footer", "src/components/site/Footer.tsx"],
  ])("gates the %s on it", (_name, file) => {
    const source = readFileSync(
      path.resolve(__dirname, "../../../", file),
      "utf8",
    );
    expect(source).toContain("isFunnelChromePath(pathname)");
    // Legacy lead pages are paid-traffic booking pages too (UI cohesion 9a),
    // gated separately so their analytics page group stays legacy_lead.
    expect(source).toContain("isLegacyLeadPath(pathname)");
    expect(source).toContain("return null");
  });

  /*
    Sealing the pages after the form (Adam, 2026-09-17). The funnels had no way
    out until a lead converted, and then /thank-you handed them a full nav bar
    and footer — 24 links — at the exact moment their next step is the calendar
    embed in front of them.
  */
  describe("post-conversion surfaces", () => {
    const POST_CONVERSION = [
      "/thank-you",
      "/thank-you-for-applying",
      "/qualify/some-session-token",
    ];

    it("drops the chrome on every one of them", () => {
      for (const route of POST_CONVERSION) {
        expect(isFunnelChromePath(route), `${route} must render bare`).toBe(
          true,
        );
      }
    });

    it("keeps every booking funnel covered too", () => {
      for (const path of BOOKING_FUNNEL_PATHS) {
        expect(isFunnelChromePath(path)).toBe(true);
      }
    });

    /*
      The list that drives chrome is NOT the list that drives attribution.
      BOOKING_FUNNEL_PATHS also decides whether a link keeps its UTMs, and
      these are redirect targets: nothing points an ad at /thank-you. Folding
      them into one list would silently claim them as ad destinations.
    */
    it("does not make them booking funnels", () => {
      for (const route of POST_CONVERSION) {
        expect(isBookingFunnelPath(route)).toBe(false);
      }
      expect(BOOKING_FUNNEL_PATHS).not.toContain("/thank-you");
    });

    it("does not match a path that merely starts with one", () => {
      expect(isFunnelChromePath("/thank-you-for-reading")).toBe(false);
      expect(isFunnelChromePath("/resources/roadmap-thank-you")).toBe(false);
      expect(isFunnelChromePath("/qualify")).toBe(false);
    });
  });
});
