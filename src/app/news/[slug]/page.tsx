import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticle } from "@/components/sections/NewsArticle";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  getPublishedPostBySlug,
  listPublishedSlugs,
} from "@/lib/services/news";
import { renderMarkdown } from "@/lib/markdown";
import { newsStructuredData } from "@/lib/news/structured-data";
import { breadcrumbStructuredData } from "@/lib/site-structured-data";

type Params = { slug: string };

export const revalidate = 60;

const getPublishedPost = cache((slug: string) => getPublishedPostBySlug(slug));

export async function generateStaticParams(): Promise<Params[]> {
  const slugs = await listPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: {
      canonical: `/news/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.cover_url ? [post.cover_url] : undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();
  const html = await renderMarkdown(post.body);
  const structuredData = newsStructuredData(post.body);
  const breadcrumbs = breadcrumbStructuredData([
    { name: "News", path: "/news" },
    { name: post.title, path: `/news/${post.slug}` },
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
      <NewsArticle post={post} html={html} />
      <FinalCta />
    </>
  );
}
