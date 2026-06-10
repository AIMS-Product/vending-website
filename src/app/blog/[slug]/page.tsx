import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import {
  generateBuilderPageMetadata,
  renderBuilderPage,
} from "@/lib/page-builder/public-page-route";
import type { LeadSearchParams } from "@/lib/lead-attribution";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";
import { hasPublishedPostSlug } from "@/lib/services/news";

type Params = { slug: string };

export const revalidate = 0;

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

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  await redirectLegacyNewsSlug(slug);
  return generateBuilderPageMetadata("/blog", slug);
}

export default async function BlogBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<LeadSearchParams>;
}) {
  const { slug } = await params;

  await redirectLegacyNewsSlug(slug);

  return renderBuilderPage({ routePrefix: "/blog", slug, searchParams });
}
