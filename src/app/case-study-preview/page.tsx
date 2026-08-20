import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { CaseStudyArticle } from "@/components/sections/CaseStudyArticle";
import { FinalCta } from "@/components/sections/FinalCta";
import { renderMarkdown } from "@/lib/markdown";

/**
 * TEMPORARY design-review route.
 *
 * Renders a real story straight off disk so the template can be reviewed
 * before the `case_studies` table exists. It exists purely so Kody can see
 * the pages on a preview deployment while the migration is still pending.
 *
 * Gated on VERCEL_ENV rather than NODE_ENV: a Vercel preview build IS a
 * production Node build, so a NODE_ENV check would 404 exactly where we need
 * this to work. Production stays 404.
 *
 * DELETE THIS ROUTE once the migration is applied and /case-studies/[slug]
 * serves real rows.
 */
export const dynamic = "force-dynamic";

async function readStory(slug: string) {
  const file = path.join(process.cwd(), "data/case-studies", `${slug}.json`);
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();

  const params = await searchParams;
  const slug =
    (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? "musa-sadi";

  const story = await readStory(slug);
  const relatedSlugs = [
    "tim-barnes",
    "tyrone-lewis",
    "sandy-and-joe",
    "joe-retiree-route",
  ].filter((entry) => entry !== slug);

  const related = await Promise.all(
    relatedSlugs.slice(0, 4).map(async (entry) => {
      const item = await readStory(entry);
      return {
        slug: item.slug,
        title: item.title,
        member_name: item.member_name,
        member_role: item.member_role ?? null,
        excerpt: item.excerpt ?? null,
        youtube_video_id: item.video_id,
        cover_url: null,
        cover_alt: null,
        monthly_revenue_usd: item.monthly_revenue_usd ?? null,
        machine_count: item.machine_count ?? null,
        location_count: item.location_count ?? null,
        prior_occupation: item.prior_occupation ?? null,
        location_types: item.location_types ?? [],
        tags: item.tags ?? [],
        published_at: "2026-08-20T00:00:00.000Z",
      };
    }),
  );

  const html = await renderMarkdown(story.body);

  return (
    <>
      <CaseStudyArticle
        caseStudy={{
          slug: story.slug,
          title: story.title,
          member_name: story.member_name,
          member_role: story.member_role ?? null,
          excerpt: story.excerpt ?? null,
          youtube_video_id: story.video_id,
          quote: story.quote ?? null,
          quote_attribution: story.quote_attribution ?? story.member_name,
          cover_url: null,
          cover_alt: null,
          stats: story.stats ?? [],
          published_at: "2026-08-20T00:00:00.000Z",
        }}
        html={html}
        related={related}
      />
      <FinalCta />
    </>
  );
}
