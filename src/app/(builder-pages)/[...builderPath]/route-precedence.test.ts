import { describe, expect, it } from "vitest";
// getSortedRoutes is the exact function Next's runtime route-matcher manager
// (next/dist/server/route-matcher-managers/default-route-matcher-manager.js)
// uses to order dynamic routes, so these assertions prove real precedence.
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes";

// The dynamic route patterns that coexist with the builder catch-all in
// src/app (route groups like (builder-pages) are stripped from URL paths).
const APP_DYNAMIC_ROUTES = [
  "/[...builderPath]",
  "/[legacyLeadPath]",
  "/admin/pages/[id]",
  "/authors/[slug]",
  "/news/[slug]",
  "/resources/preview/[token]",
];

describe("builder catch-all route precedence", () => {
  it("coexists with the existing top-level [legacyLeadPath] route", () => {
    expect(() => getSortedRoutes(APP_DYNAMIC_ROUTES)).not.toThrow();
  });

  it("sorts every static-prefixed route above the builder catch-all", () => {
    const sorted = getSortedRoutes(APP_DYNAMIC_ROUTES);
    const catchAllIndex = sorted.indexOf("/[...builderPath]");

    expect(sorted.indexOf("/resources/preview/[token]")).toBeLessThan(
      catchAllIndex,
    );
    expect(sorted.indexOf("/news/[slug]")).toBeLessThan(catchAllIndex);
    expect(sorted.indexOf("/authors/[slug]")).toBeLessThan(catchAllIndex);
    expect(sorted.indexOf("/admin/pages/[id]")).toBeLessThan(catchAllIndex);
    expect(sorted.indexOf("/[legacyLeadPath]")).toBeLessThan(catchAllIndex);
    // The catch-all is the lowest-priority route: it only sees requests no
    // other route matched, so static pages and admin routes always win.
    expect(sorted[sorted.length - 1]).toBe("/[...builderPath]");
  });

  it("documents why a [prefix]/[slug] segment was not used: it conflicts with [legacyLeadPath]", () => {
    expect(() =>
      getSortedRoutes(["/[legacyLeadPath]", "/[prefix]/[slug]"]),
    ).toThrow(/different slug names/);
  });
});
