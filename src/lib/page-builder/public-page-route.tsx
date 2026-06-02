import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { normalizeBrandedPageTitle } from "@/lib/metadata-titles";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";

export async function generateBuilderPageMetadata(
  routePrefix: string,
  slug: string,
): Promise<Metadata> {
  const page = await getPublishedSeoPageByPath(`${routePrefix}/${slug}`);
  if (!page) notFound();
  const title = normalizeBrandedPageTitle(page.seo_title ?? page.title);

  return {
    title,
    description: page.meta_description ?? undefined,
    robots: page.noindex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: page.canonical_url ?? page.route_path,
    },
    openGraph: {
      title,
      description: page.meta_description ?? undefined,
      type: "article",
    },
  };
}

export async function renderBuilderPage({
  routePrefix,
  slug,
  searchParams,
}: {
  routePrefix: string;
  slug: string;
  searchParams: Promise<LeadSearchParams>;
}) {
  const [page, query] = await Promise.all([
    getPublishedSeoPageByPath(`${routePrefix}/${slug}`),
    searchParams,
  ]);
  if (!page) notFound();
  const attribution = buildLeadAttribution(query, page.route_path);

  return (
    <ResourcePageRenderer
      page={page}
      leadAttribution={attribution}
      idempotencyKeyPrefix={randomUUID()}
    />
  );
}
