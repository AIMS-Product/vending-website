import { describe, expect, it } from "vitest";
import {
  defaultRoutePrefixForPageType,
  normalizeRoutePrefix,
  pagePathForPage,
  pagePathForSlug,
  splitBuilderRoutePath,
} from "./page-paths";

describe("page builder paths", () => {
  it("infers the default route prefix from page type", () => {
    expect(defaultRoutePrefixForPageType("resource")).toBe("/resources");
    expect(defaultRoutePrefixForPageType("blog")).toBe("/blog");
    expect(defaultRoutePrefixForPageType("landing")).toBe("/landing");
    expect(defaultRoutePrefixForPageType("video")).toBe("/videos");
    expect(defaultRoutePrefixForPageType("unknown")).toBe("/resources");
  });

  it("builds route paths from prefix and normalized slug", () => {
    expect(pagePathForSlug("College Vending", "/blog")).toBe(
      "/blog/college-vending",
    );
    expect(pagePathForPage({ slug: "Guide", page_type: "landing" })).toBe(
      "/landing/guide",
    );
    expect(
      pagePathForPage({
        slug: "Guide",
        route_prefix: "/solutions",
        page_type: "resource",
      }),
    ).toBe("/solutions/guide");
  });

  it("normalizes invalid prefixes back to the page type default", () => {
    expect(normalizeRoutePrefix("/news", "blog")).toBe("/blog");
    expect(normalizeRoutePrefix("/resources/", "blog")).toBe("/resources");
  });

  it("splits only approved builder paths", () => {
    expect(splitBuilderRoutePath("/blog/college-vending")).toEqual({
      routePrefix: "/blog",
      slug: "college-vending",
    });
    expect(splitBuilderRoutePath("/resources/preview/token")).toBeNull();
    expect(splitBuilderRoutePath("/news/college-vending")).toBeNull();
  });
});
