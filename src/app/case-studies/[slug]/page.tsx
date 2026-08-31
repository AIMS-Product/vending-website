import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyArticle } from "@/components/sections/CaseStudyArticle";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  getPublishedCaseStudyBySlug,
  listCaseStudyCardsBySlugs,
  listPublishedCaseStudies,
  listPublishedCaseStudySlugs,
} from "@/lib/services/case-studies";
import { renderMarkdown } from "@/lib/markdown";
import { caseStudyStructuredData } from "@/lib/case-studies/structured-data";
import { breadcrumbStructuredData } from "@/lib/site-structured-data";

type Params = { slug: string };

export const revalidate = 60;

const RELATED_COUNT = 4;

const getPublishedCaseStudy = cache((slug: string) =>
  getPublishedCaseStudyBySlug(slug),
);

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await listPublishedCaseStudySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) notFound();

  const ogImage =
    caseStudy.cover_url ??
    (caseStudy.youtube_video_id
      ? `https://i.ytimg.com/vi/${caseStudy.youtube_video_id}/maxresdefault.jpg`
      : undefined);

  return {
    title: `${caseStudy.member_name}: ${caseStudy.title}`,
    description: caseStudy.excerpt ?? undefined,
    alternates: { canonical: `/case-studies/${caseStudy.slug}` },
    openGraph: {
      title: `${caseStudy.member_name}: ${caseStudy.title}`,
      description: caseStudy.excerpt ?? undefined,
      images: ogImage ? [ogImage] : undefined,
      type: "article",
      publishedTime: caseStudy.published_at ?? undefined,
    },
  };
}

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) notFound();

  const html = await renderMarkdown(caseStudy.body);
  const related = await resolveRelated(slug, caseStudy.related_slugs);
  const structuredData = caseStudyStructuredData(caseStudy);
  const breadcrumbs = breadcrumbStructuredData([
    { name: "Case Studies", path: "/case-studies" },
    { name: caseStudy.title, path: `/case-studies/${caseStudy.slug}` },
  ]);

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          // Serialised server-side from our own columns, never from user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <CaseStudyArticle caseStudy={caseStudy} html={html} related={related} />
      <FinalCta />
    </>
  );
}

/**
 * The editor's curated picks come first. Any that are missing or unpublished
 * silently drop out, so we top the rail up with the most recent other stories
 * — a half-empty "More success stories" row looks broken, and an editor
 * shouldn't have to hand-maintain four links on twenty-five pages.
 */
async function resolveRelated(
  currentSlug: string,
  relatedSlugs: readonly string[],
) {
  const curated = (
    await listCaseStudyCardsBySlugs(
      relatedSlugs.filter((slug) => slug !== currentSlug),
    )
  ).slice(0, RELATED_COUNT);

  if (curated.length >= RELATED_COUNT) return curated;

  const seen = new Set([currentSlug, ...curated.map((item) => item.slug)]);
  const fallback = (await listPublishedCaseStudies({ limit: 12 })).filter(
    (item) => !seen.has(item.slug),
  );

  return [...curated, ...fallback].slice(0, RELATED_COUNT);
}
