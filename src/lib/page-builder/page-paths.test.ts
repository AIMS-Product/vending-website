import { describe, expect, it } from "vitest";
import {
  builderRoutePrefixOptions,
  defaultRoutePrefixForPageType,
  isAssignableBuilderRoutePath,
  normalizeRoutePrefix,
  pagePathForPage,
  pagePathForSlug,
  routePrefixOptionsFrom,
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

  it("splits custom prefixes only when they are in the provided list", () => {
    expect(splitBuilderRoutePath("/services/coffee")).toBeNull();
    expect(splitBuilderRoutePath("/services/coffee", ["/services"])).toEqual({
      routePrefix: "/services",
      slug: "coffee",
    });
  });
});

describe("custom route prefixes", () => {
  it("accepts a shape-valid, non-reserved custom prefix", () => {
    expect(normalizeRoutePrefix("/services", "resource")).toBe("/services");
    expect(normalizeRoutePrefix("/case-study-library/", "blog")).toBe(
      "/case-study-library",
    );
  });

  it("still rejects reserved and malformed prefixes", () => {
    expect(normalizeRoutePrefix("/news", "blog")).toBe("/blog");
    expect(normalizeRoutePrefix("/admin", "resource")).toBe("/resources");
    expect(normalizeRoutePrefix("/Bad_Prefix", "resource")).toBe("/resources");
    expect(normalizeRoutePrefix("/a/b", "resource")).toBe("/resources");
  });

  it("builds and preserves route paths under custom prefixes", () => {
    expect(pagePathForSlug("Coffee Guide", "/services")).toBe(
      "/services/coffee-guide",
    );
    expect(
      pagePathForPage({
        slug: "coffee-guide",
        route_path: "/services/coffee-guide",
      }),
    ).toBe("/services/coffee-guide");
    expect(
      pagePathForPage({
        slug: "coffee-guide",
        route_prefix: "/services",
        page_type: "resource",
      }),
    ).toBe("/services/coffee-guide");
  });

  it("identifies assignable builder route paths by shape and reservations", () => {
    expect(isAssignableBuilderRoutePath("/services/coffee")).toBe(true);
    expect(isAssignableBuilderRoutePath("/resources/coffee")).toBe(true);
    expect(isAssignableBuilderRoutePath("/news/coffee")).toBe(false);
    expect(isAssignableBuilderRoutePath("/admin/pages")).toBe(false);
    expect(isAssignableBuilderRoutePath("/resources/preview/token")).toBe(
      false,
    );
    expect(isAssignableBuilderRoutePath("/services")).toBe(false);
  });
});

describe("routePrefixOptionsFrom", () => {
  it("derives editor dropdown options from configured prefixes", () => {
    expect(
      routePrefixOptionsFrom([
        { prefix: "/resources", label: "Resources" },
        { prefix: "/services", label: "Services" },
      ]),
    ).toEqual([
      { value: "/resources", label: "Resources" },
      { value: "/services", label: "Services" },
    ]);
  });

  it("falls back to the built-in defaults when the list is empty", () => {
    expect(routePrefixOptionsFrom([])).toEqual([...builderRoutePrefixOptions]);
  });

  it("uses the prefix as a label fallback", () => {
    expect(
      routePrefixOptionsFrom([{ prefix: "/services", label: "" }]),
    ).toEqual([{ value: "/services", label: "/services" }]);
  });
});
