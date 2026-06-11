import { normalizeSlug } from "@/lib/page-builder/blocks";
import type { PageTypeId } from "@/lib/page-builder/page-templates";
import {
  DEFAULT_ROUTE_PREFIXES,
  RESERVED_ROUTE_SEGMENTS,
  ROUTE_PREFIX_PATTERN,
} from "@/lib/page-builder/route-prefix-defaults";

/**
 * Route prefixes are dynamic since S6b: the five defaults below are only the
 * sync fallback. Custom prefixes live in `page_builder_route_prefixes` and
 * are fetched server-side via `@/lib/services/route-prefixes`; helpers here
 * accept an explicit prefix list when callers need exact-list matching.
 */
const builderRoutePrefixes: readonly string[] = DEFAULT_ROUTE_PREFIXES.map(
  (entry) => entry.prefix,
);

export type BuilderRoutePrefix = string;

export type RoutePrefixOption = { value: string; label: string };

export const builderRoutePrefixOptions: readonly RoutePrefixOption[] =
  DEFAULT_ROUTE_PREFIXES.map((entry) => ({
    value: entry.prefix,
    label: entry.label,
  }));

/** Maps configured prefixes (from the service) to editor dropdown options. */
export function routePrefixOptionsFrom(
  prefixes: readonly { prefix: string; label: string }[],
): readonly RoutePrefixOption[] {
  if (prefixes.length === 0) return builderRoutePrefixOptions;
  return prefixes.map((entry) => ({
    value: entry.prefix,
    label: entry.label || entry.prefix,
  }));
}

export function defaultRoutePrefixForPageType(
  pageType: string | null | undefined,
): BuilderRoutePrefix {
  switch (pageType) {
    case "blog":
      return "/blog";
    case "landing":
      return "/landing";
    case "video":
      return "/videos";
    case "resource":
    default:
      return "/resources";
  }
}

/**
 * A prefix the builder may assign to pages: a single lowercase kebab-case
 * segment that is either a built-in default or not reserved by an existing
 * app route. Whether a custom prefix is actually *configured* is enforced
 * server-side against `page_builder_route_prefixes` (see admin actions).
 */
export function isAssignableRoutePrefix(
  value: string | null | undefined,
): value is BuilderRoutePrefix {
  if (!value || !ROUTE_PREFIX_PATTERN.test(value)) return false;
  if (builderRoutePrefixes.includes(value)) return true;
  return !RESERVED_ROUTE_SEGMENTS.has(value.slice(1));
}

export function normalizeRoutePrefix(
  value: string | null | undefined,
  fallbackPageType?: PageTypeId | string | null,
): BuilderRoutePrefix {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (isAssignableRoutePrefix(trimmed)) return trimmed;
  return defaultRoutePrefixForPageType(fallbackPageType);
}

export function pagePathForSlug(
  slug: string,
  routePrefix: string | null | undefined = "/resources",
) {
  const prefix = normalizeRoutePrefix(routePrefix);
  return `${prefix}/${normalizeSlug(slug)}`;
}

export function pagePathForPage(page: {
  route_path?: string | null;
  route_prefix?: string | null;
  slug: string;
  page_type?: string | null;
}) {
  if (page.route_path) return normalizeBuilderRoutePath(page.route_path);
  return pagePathForSlug(
    page.slug,
    normalizeRoutePrefix(page.route_prefix, page.page_type),
  );
}

function normalizeBuilderRoutePath(path: string) {
  const trimmed = path.trim().replace(/\/+$/, "");
  const match = splitAssignableBuilderRoutePath(trimmed);
  if (!match) return pagePathForSlug(trimmed.split("/").pop() ?? "");
  return pagePathForSlug(match.slug, match.routePrefix);
}

/**
 * Splits `/{prefix}/{slug}` for prefixes in the given exact list (defaults to
 * the five built-ins). Use this where only known prefixes may match — e.g.
 * the proxy, whose matcher covers exactly the default prefixes.
 */
export function splitBuilderRoutePath(
  path: string,
  prefixes: readonly string[] = builderRoutePrefixes,
): {
  routePrefix: BuilderRoutePrefix;
  slug: string;
} | null {
  const pathname = path.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  for (const routePrefix of prefixes) {
    const prefixWithSlash = `${routePrefix}/`;
    if (!pathname.startsWith(prefixWithSlash)) continue;
    const slug = pathname.slice(prefixWithSlash.length);
    if (!slug || slug.includes("/")) return null;
    return { routePrefix, slug: normalizeSlug(slug) };
  }
  return null;
}

/**
 * Splits `/{prefix}/{slug}` for any assignable prefix (shape-valid and not
 * reserved), so custom-prefix paths persisted in the DB round-trip without
 * the caller having to thread the configured list through sync code.
 */
export function splitAssignableBuilderRoutePath(path: string): {
  routePrefix: BuilderRoutePrefix;
  slug: string;
} | null {
  const pathname = path.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  const slashIndex = pathname.indexOf("/", 1);
  if (!pathname.startsWith("/") || slashIndex === -1) return null;
  const routePrefix = pathname.slice(0, slashIndex);
  const slug = pathname.slice(slashIndex + 1);
  if (!slug || slug.includes("/")) return null;
  if (!isAssignableRoutePrefix(routePrefix)) return null;
  return { routePrefix, slug: normalizeSlug(slug) };
}

export function isBuilderRoutePath(
  path: string,
  prefixes: readonly string[] = builderRoutePrefixes,
) {
  return splitBuilderRoutePath(path, prefixes) !== null;
}

export function isAssignableBuilderRoutePath(path: string) {
  return splitAssignableBuilderRoutePath(path) !== null;
}
