import type { Metadata } from "next";
import { NewsHero } from "@/components/sections/NewsHero";
import { NewsList } from "@/components/sections/NewsList";
import { FinalCta } from "@/components/sections/FinalCta";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/services/news";
import { listResourceGuides } from "@/lib/services/seo-page-public";

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
  const [posts, guides] = await Promise.all([
    listPublishedPosts({ limit: 30 }),
    listResourceGuides(),
  ]);
  return (
    <>
      <NewsHero />
      {guides.length > 0 ? (
        <section
          aria-labelledby="guides-heading"
          className="mx-auto max-w-6xl px-6 py-12"
        >
          <h2 id="guides-heading" className="text-2xl font-semibold">
            Guides
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <li
                key={g.route_path}
                className="rounded-lg border border-black/10 p-5"
              >
                <Link
                  href={g.route_path}
                  className="font-medium hover:underline"
                >
                  {g.title}
                </Link>
                {g.meta_description ? (
                  <p className="mt-2 text-sm text-black/70">
                    {g.meta_description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <NewsList posts={posts} />
      <FinalCta />
    </>
  );
}
