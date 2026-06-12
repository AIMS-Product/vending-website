import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import {
  generateBuilderPageMetadata,
  renderBuilderPage,
} from "@/lib/page-builder/public-page-route";
import { DEFAULT_ROUTE_PREFIXES } from "@/lib/page-builder/route-prefix-defaults";
import type { LeadSearchParams } from "@/lib/lead-attribution";
import { hasPublishedPostSlug } from "@/lib/services/news";
import {
  getBuilderRedirectBySourcePath,
  getPublishedSeoPageByPath,
} from "@/lib/services/seo-page-public";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";

// Catch-all (not `[prefix]/[slug]`): Next's route sorter rejects two
// different slug names at the same dynamic position, and `[legacyLeadPath]`
// already occupies the top-level slot (sorted-routes E337). The catch-all is
// the lowest-priority route, so every static page, `/news/[slug]`,
// `/authors/[slug]`, `/resources/preview/[token]`, and `[legacyLeadPath]`
// keep winning — only unmatched multi-segment paths land here.
type Params = { builderPath: string[] };

export const revalidate = 0;

// The proxy matcher only covers the five default prefixes, so their redirect
// rows are served there. Custom prefixes bypass the proxy entirely and must
// resolve redirect rows here instead.
const PROXY_COVERED_PREFIXES = new Set<string>(
  DEFAULT_ROUTE_PREFIXES.map((entry) => entry.prefix),
);

// Resolves /{prefix}/{slug} against the configured prefix list (defaults +
// admin-added customs; the service falls back to the defaults if the table
// is missing). Anything else 404s.
async function resolveBuilderRoute(
  params: Promise<Params>,
): Promise<{ routePrefix: string; slug: string }> {
  const { builderPath } = await params;
  if (builderPath.length !== 2) notFound();
  const [prefixSegment, slug] = builderPath;
  const routePrefix = `/${prefixSegment}`;
  const configured = await listRoutePrefixes();
  if (!configured.some((entry) => entry.prefix === routePrefix)) notFound();
  return { routePrefix, slug };
}

// A builder page published at /blog/{slug} wins — render it unchanged.
// Only when no builder page exists do we treat /blog/{slug} as a legacy
// link and permanently redirect it to the news article of the same slug.
// Must run in BOTH generateMetadata and the page: generateMetadata's
// builder lookup calls notFound() first, which would 404 the request
// before the page component ever renders.
async function redirectLegacyNewsSlug(slug: string): Promise<void> {
  const builderPage = await getPublishedSeoPageByPath(`/blog/${slug}`);
  if (!builderPage && (await hasPublishedPostSlug(slug))) {
    permanentRedirect(`/news/${slug}`);
  }
}

// Shared between generateMetadata and the page component so a redirect
// always fires before either lookup can 404 the request.
async function applyBuilderRedirects(
  routePrefix: string,
  slug: string,
): Promise<void> {
  if (routePrefix === "/blog") {
    await redirectLegacyNewsSlug(slug);
  }
  if (PROXY_COVERED_PREFIXES.has(routePrefix)) return;

  const redirectRow = await getBuilderRedirectBySourcePath(
    `${routePrefix}/${slug}`,
  );
  if (!redirectRow) return;
  if (redirectRow.status_code === 301 || redirectRow.status_code === 308) {
    permanentRedirect(redirectRow.destination_path);
  }
  redirect(redirectRow.destination_path);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { routePrefix, slug } = await resolveBuilderRoute(params);
  await applyBuilderRedirects(routePrefix, slug);
  return generateBuilderPageMetadata(routePrefix, slug);
}

export default async function BuilderPrefixPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<LeadSearchParams>;
}) {
  const { routePrefix, slug } = await resolveBuilderRoute(params);
  await applyBuilderRedirects(routePrefix, slug);
  return renderBuilderPage({ routePrefix, slug, searchParams });
}
