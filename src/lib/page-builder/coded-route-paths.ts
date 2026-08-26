import { listSolutionSlugs } from "@/lib/content/solutions";

/**
 * Public paths under a builder route prefix that are served by a real app
 * route instead of a `seo_pages` row.
 *
 * The proxy 404s any two-segment path under a default prefix that has no
 * published builder page, which would otherwise swallow these before the route
 * ever runs. Registering a path here makes the proxy hand it to the app.
 *
 * Keep this in sync when adding a coded page under a builder prefix —
 * `lead-magnets.test.ts` fails if a lead-magnet page is missing from it.
 */
export const CODED_ROUTE_PATHS: ReadonlySet<string> = new Set([
  "/newsletter",
  "/resources/roadmap",
  "/resources/roadmap-thank-you",
  "/resources/finance-templates",
  "/resources/finance-templates-thank-you",
  // `/solutions` is a builder prefix, so every coded solution page has to be
  // registered here or the proxy 404s it. Derived from the registry so adding
  // a solution stays a one-file change.
  ...listSolutionSlugs().map((slug) => `/solutions/${slug}`),
]);

export function isCodedRoutePath(path: string) {
  return CODED_ROUTE_PATHS.has(path);
}
