import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { normalizeBrandedPageTitle } from "@/lib/metadata-titles";
import { getPublishedSeoPageBySlug } from "@/lib/services/seo-page-public";

type Params = { slug: string };

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedSeoPageBySlug(slug);
  if (!page) notFound();
  const title = normalizeBrandedPageTitle(page.seo_title ?? page.title);

  return {
    title,
    description: page.meta_description ?? undefined,
    robots: page.noindex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: page.canonical_url ?? `/resources/${page.slug}`,
    },
    openGraph: {
      title,
      description: page.meta_description ?? undefined,
      type: "article",
    },
  };
}

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<LeadSearchParams>;
}) {
  const { slug } = await params;
  const [page, query] = await Promise.all([
    getPublishedSeoPageBySlug(slug),
    searchParams,
  ]);
  if (!page) notFound();
  const landingPath = `/resources/${page.slug}`;
  const attribution = buildLeadAttribution(query, landingPath);

  return (
    <ResourcePageRenderer
      page={page}
      leadAttribution={attribution}
      idempotencyKeyPrefix={randomUUID()}
    />
  );
}
