/**
 * Client-safe route-prefix constants shared between the page-builder path
 * helpers (imported by client components) and the server-only
 * `@/lib/services/route-prefixes` service. Keep this module free of any
 * server-only imports.
 */

/**
 * The five built-in builder prefixes. `listRoutePrefixes` falls back to this
 * list whenever the `page_builder_route_prefixes` table is missing or the
 * query errors, so app behavior never depends on the migration having run.
 */
export const DEFAULT_ROUTE_PREFIXES = [
  { prefix: "/resources", label: "Resources" },
  { prefix: "/blog", label: "Blog" },
  { prefix: "/landing", label: "Landing" },
  { prefix: "/videos", label: "Videos" },
  { prefix: "/solutions", label: "Solutions" },
] as const;

/**
 * Segments that can never become builder route prefixes: every existing
 * top-level route folder in `src/app` plus framework/infrastructure paths.
 * The five default builder prefixes are included — they exist as seeded,
 * non-deletable rows and must not be re-created as custom prefixes.
 */
export const RESERVED_ROUTE_SEGMENTS = new Set([
  // Existing top-level src/app route folders.
  "about",
  "admin",
  "api",
  "apply",
  "auth",
  "authors",
  "blog",
  "case-studies",
  "contact",
  "home-v2",
  "landing",
  "news",
  "pre-call-resources",
  "privacy",
  "resources",
  "solutions",
  "terms",
  "thank-you-for-applying",
  "videos",
  // Framework and infrastructure paths.
  "_next",
  "images",
  "robots",
  "sitemap",
]);

/**
 * Shape of a valid route prefix: one lowercase kebab-case URL segment with a
 * leading slash, e.g. `/guides` or `/case-study-library`. Mirrors the
 * relaxed `seo_pages_route_prefix_check` DB constraint.
 */
export const ROUTE_PREFIX_PATTERN = /^\/[a-z0-9]+(-[a-z0-9]+)*$/;
