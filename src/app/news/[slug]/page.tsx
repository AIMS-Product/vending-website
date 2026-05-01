import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticle } from "@/components/sections/NewsArticle";
import { FinalCta } from "@/components/sections/FinalCta";
import {
  getPublishedPostBySlug,
  listPublishedSlugs,
} from "@/lib/services/news";
import { renderMarkdown } from "@/lib/markdown";

type Params = { slug: string };

export const revalidate = 60;

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
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
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
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();
  const html = await renderMarkdown(post.body);
  return (
    <>
      <NewsArticle post={post} html={html} />
      <FinalCta />
    </>
  );
}
