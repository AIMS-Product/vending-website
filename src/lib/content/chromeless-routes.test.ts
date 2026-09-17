import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHROMELESS_ROUTES, isChromelessRoute } from "./chromeless-routes";
import { bookingPages } from "./booking-pages";

/**
 * The booking funnels render with no header and no footer (Adam, 2026-09-17).
 * A route that falls out of this list silently grows a nav bar full of exits
 * again, which is the failure this guards.
 */
describe("chromeless booking routes", () => {
  it("covers every hand-written booking funnel", () => {
    for (const route of [
      "/contact",
      "/book-now",
      "/booking-youtube",
      "/booking-meta",
    ]) {
      expect(isChromelessRoute(route)).toBe(true);
    }
  });

  it("covers every social-ad booking route in the registry", () => {
    for (const page of Object.values(bookingPages)) {
      expect(isChromelessRoute(page.path)).toBe(true);
    }
    expect(CHROMELESS_ROUTES).toHaveLength(
      4 + Object.keys(bookingPages).length,
    );
  });

  it("leaves the rest of the site with its chrome", () => {
    for (const route of [
      "/",
      "/about",
      "/case-studies",
      "/news",
      "/resources/roadmap",
      "/pre-call-resources",
      "/thank-you",
    ]) {
      expect(isChromelessRoute(route)).toBe(false);
    }
  });

  it("does not match a longer path that merely starts with a booking route", () => {
    expect(isChromelessRoute("/contact-us")).toBe(false);
    expect(isChromelessRoute("/booking-meta/extra")).toBe(false);
  });

  it.each([
    ["Header", "src/components/site/Header.tsx"],
    ["Footer", "src/components/site/Footer.tsx"],
  ])("gates the %s on it", (_name, file) => {
    const source = readFileSync(
      path.resolve(__dirname, "../../../", file),
      "utf8",
    );
    expect(source).toContain("isChromelessRoute(pathname)");
    expect(source).toContain("return null");
  });
});
