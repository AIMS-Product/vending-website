import type { Metadata } from "next";
import { NewsHero } from "@/components/sections/NewsHero";
import { NewsList } from "@/components/sections/NewsList";
import { FinalCta } from "@/components/sections/FinalCta";
import { listPublishedPosts } from "@/lib/services/news";

export const metadata: Metadata = {
  title: "News",
  description:
    "Vending industry insights, location strategies, and program updates from Vendingpreneurs.",
  alternates: {
    canonical: "/news",
  },
};

/** Fall back to ISR every 60s in production so newly published posts appear without a redeploy. */
export const revalidate = 60;

export default async function NewsPage() {
  const posts = await listPublishedPosts({ limit: 30 });
  return (
    <>
      <NewsHero />
      <NewsList posts={posts} />
      <FinalCta />
    </>
  );
}
