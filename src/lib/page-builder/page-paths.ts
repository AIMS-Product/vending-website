import { normalizeSlug } from "@/lib/page-builder/blocks";
import type { PageTypeId } from "@/lib/page-builder/page-templates";

const builderRoutePrefixes = [
  "/resources",
  "/blog",
  "/landing",
  "/videos",
  "/solutions",
] as const;

export type BuilderRoutePrefix = (typeof builderRoutePrefixes)[number];

export const builderRoutePrefixOptions = [
  { value: "/resources", label: "Resources" },
  { value: "/blog", label: "Blog" },
  { value: "/landing", label: "Landing" },
  { value: "/videos", label: "Videos" },
  { value: "/solutions", label: "Solutions" },
] as const satisfies readonly {
  value: BuilderRoutePrefix;
  label: string;
}[];

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

export function normalizeRoutePrefix(
  value: string | null | undefined,
  fallbackPageType?: PageTypeId | string | null,
): BuilderRoutePrefix {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (isBuilderRoutePrefix(trimmed)) return trimmed;
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
  const match = splitBuilderRoutePath(trimmed);
  if (!match) return pagePathForSlug(trimmed.split("/").pop() ?? "");
  return pagePathForSlug(match.slug, match.routePrefix);
}

export function splitBuilderRoutePath(path: string): {
  routePrefix: BuilderRoutePrefix;
  slug: string;
} | null {
  const pathname = path.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  for (const routePrefix of builderRoutePrefixes) {
    const prefixWithSlash = `${routePrefix}/`;
    if (!pathname.startsWith(prefixWithSlash)) continue;
    const slug = pathname.slice(prefixWithSlash.length);
    if (!slug || slug.includes("/")) return null;
    return { routePrefix, slug: normalizeSlug(slug) };
  }
  return null;
}

function isBuilderRoutePrefix(
  value: string | null | undefined,
): value is BuilderRoutePrefix {
  return builderRoutePrefixes.includes(value as BuilderRoutePrefix);
}

export function isBuilderRoutePath(path: string) {
  return splitBuilderRoutePath(path) !== null;
}
