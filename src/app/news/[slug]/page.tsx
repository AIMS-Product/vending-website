import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticle } from "@/components/sections/NewsArticle";
import { NewsKeepReading } from "@/components/sections/NewsKeepReading";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  getPublishedPostBySlug,
  listPublishedPosts,
  listPublishedSlugs,
} from "@/lib/services/news";
import { listResourceGuides } from "@/lib/services/seo-page-public";
import { pickRelatedReading } from "@/lib/news/related-reading";
import { newsSeoMeta } from "@/lib/news/seo-meta";
import { renderMarkdown } from "@/lib/markdown";
import { jsonLdHtml } from "@/lib/json-ld";
import {
  newsArticleStructuredData,
  newsStructuredData,
} from "@/lib/news/structured-data";
import { defaultOgImage } from "@/lib/site";
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

  const seo = newsSeoMeta(post.slug);
  const title = seo?.title ?? post.title;
  const description = seo?.description ?? post.excerpt ?? undefined;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/news/${post.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/news/${post.slug}`,
      images: post.cover_url ? [post.cover_url] : [defaultOgImage],
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
  const [html, posts, guides] = await Promise.all([
    renderMarkdown(post.body, { gfm: true }),
    listPublishedPosts({ limit: 30 }),
    listResourceGuides(),
  ]);
  const reading = pickRelatedReading(`/news/${post.slug}`, [
    ...posts.map((item) => ({
      href: `/news/${item.slug}`,
      title: item.title,
    })),
    ...guides.map((item) => ({ href: item.route_path, title: item.title })),
  ]);
  const structuredData = newsStructuredData(post.body);
  const breadcrumbs = breadcrumbStructuredData([
    { name: "News", path: "/news" },
    { name: post.title, path: `/news/${post.slug}` },
  ]);
  return (
    <>
      {/* CMS titles and bodies feed these, so jsonLdHtml escapes `<`. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(newsArticleStructuredData(post)),
        }}
      />
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(structuredData) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbs) }}
      />
      <NewsArticle post={post} html={html} />
      <NewsKeepReading links={reading} />
      <FinalCta />
    </>
  );
}
