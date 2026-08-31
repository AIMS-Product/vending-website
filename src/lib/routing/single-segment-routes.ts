import { getLegacyLeadRoute } from "@/lib/content/legacy-routes";

// Every top-level `src/app` segment that renders a page or route handler
// (route groups expanded, dynamic segments excluded). The proxy consults this
// to return a real 404 for single-segment paths that could only ever land in
// `[legacyLeadPath]`'s notFound() — which the root loading.tsx Suspense
// boundary streams as a 200 shell (soft-404), because the status code is
// already flushed before notFound() runs.
//
// Drift-guarded by single-segment-routes.test.ts: adding a top-level route
// without updating this set fails the suite instead of silently 404ing the
// new page in production.
export const APP_TOP_LEVEL_PAGE_SEGMENTS: ReadonlySet<string> = new Set([
  "about",
  "admin",
  "book-now",
  "booking-ak-b5",
  "booking-ak-t5",
  "booking-b5-socials",
  "booking-meta",
  "booking-t5-socials",
  "booking-youtube",
  "case-studies",
  "contact",
  "home-v2",
  "news",
  "newsletter",
  "pre-call-resources",
  "privacy",
  "process",
  "qa-links",
  "solutions",
  "spam-policy",
  "terms",
  "thank-you",
  "thank-you-for-applying",
  "vp-quiz",
]);

const SINGLE_SEGMENT = /^\/([^/]+)$/;

/**
 * True when `pathname` is a single public segment that matches neither a
 * filesystem route nor a legacy lead route — i.e. a path whose only possible
 * outcome is the streamed soft-404 shell. next.config redirects fire before
 * the proxy, and the caller runs its Studio-redirect lookup first, so every
 * redirectable URL has already been handled by the time this is consulted.
 */
export function isUnknownSingleSegmentPublicPath(pathname: string): boolean {
  const match = SINGLE_SEGMENT.exec(pathname);
  if (!match) return false;
  let segment: string;
  try {
    segment = decodeURIComponent(match[1]);
  } catch {
    return true;
  }
  if (segment.includes("/")) return true;
  return (
    !APP_TOP_LEVEL_PAGE_SEGMENTS.has(segment) &&
    getLegacyLeadRoute(segment) === undefined
  );
}
