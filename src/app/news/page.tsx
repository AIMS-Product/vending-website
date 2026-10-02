import type { Metadata } from "next";
import { NewsHero } from "@/components/sections/NewsHero";
import { NewsGuides } from "@/components/sections/NewsGuides";
import { NewsList } from "@/components/sections/NewsList";
import { FinalCta } from "@/components/sections/FinalCta";
import { listPublishedPosts } from "@/lib/services/news";
import { listResourceGuides } from "@/lib/services/seo-page-public";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "News";
const DESCRIPTION =
  "Vending industry insights, location strategies, and program updates from Vendingpreneurs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/news",
  },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/news"),
};

/** Fall back to ISR every 60s in production so newly published posts appear without a redeploy. */
export const revalidate = 60;

export default async function NewsPage() {
  const [posts, guides] = await Promise.all([
    listPublishedPosts({ limit: 30 }),
    listResourceGuides(),
  ]);
  return (
    <>
      <NewsHero />
      <NewsGuides guides={guides} />
      <NewsList posts={posts} />
      <FinalCta />
    </>
  );
}
