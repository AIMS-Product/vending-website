import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseStudyArticle } from "@/components/sections/CaseStudyArticle";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import { FinalCta } from "@/components/sections/FinalCta";
import { renderMarkdown } from "@/lib/markdown";

/**
 * TEMPORARY design-review route.
 *
 * Renders the real stories straight off disk so the template can be reviewed
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

const DATA_DIR = "data/case-studies";

/** Preview links stay inside the preview route; /case-studies/* 404s until the migration runs. */
const previewHref = (slug: string) => `/case-study-preview?slug=${slug}`;

async function listSlugs(): Promise<string[]> {
  const files = await fs.readdir(path.join(process.cwd(), DATA_DIR));
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();
}

async function readStory(slug: string) {
  // Guard the path: this route takes a slug from the query string.
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  const file = path.join(process.cwd(), DATA_DIR, `${slug}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    notFound();
  }
}

/** Shapes a raw JSON story into the card data the real components expect. */
function toCard(item: Record<string, unknown>) {
  return {
    slug: item.slug as string,
    title: item.title as string,
    member_name: item.member_name as string,
    member_role: (item.member_role as string) ?? null,
    excerpt: (item.excerpt as string) ?? null,
    youtube_video_id: (item.video_id as string) ?? null,
    cover_url: null,
    cover_alt: null,
    monthly_revenue_usd: (item.monthly_revenue_usd as number) ?? null,
    machine_count: (item.machine_count as number) ?? null,
    location_count: (item.location_count as number) ?? null,
    prior_occupation: (item.prior_occupation as string) ?? null,
    location_types: (item.location_types as string[]) ?? [],
    tags: (item.tags as string[]) ?? [],
    published_at: "2026-08-20T00:00:00.000Z",
  };
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();

  const params = await searchParams;
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug) return <PreviewIndex />;

  const story = await readStory(slug);
  const slugs = await listSlugs();

  // Four other stories, wrapping around from this one, so every page shows a
  // different set rather than the same hardcoded four.
  const start = slugs.indexOf(slug);
  const related = await Promise.all(
    Array.from({ length: 4 }, (_, i) => slugs[(start + i + 1) % slugs.length])
      .filter((entry) => entry !== slug)
      .map(async (entry) => toCard(await readStory(entry))),
  );

  const html = await renderMarkdown(story.body);

  return (
    <>
      <PreviewBanner />
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
        cardHrefFor={previewHref}
      />
      <FinalCta />
    </>
  );
}

/** The grid of every story, so a reviewer can browse instead of guessing URLs. */
async function PreviewIndex() {
  const slugs = await listSlugs();
  const cards = await Promise.all(
    slugs.map(async (slug) => toCard(await readStory(slug))),
  );

  return (
    <>
      <PreviewBanner />
      <section className="bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32">
        <div className="mx-auto max-w-[1500px]">
          <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.96] font-black text-[#111111] uppercase">
            Member success stories
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-8 font-semibold text-slate-700">
            {cards.length} stories, every one from a real interview. Click any
            card to see the full page.
          </p>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <li key={card.slug} className="min-w-0">
                <CaseStudyCard
                  caseStudy={card}
                  headingLevel="h2"
                  href={previewHref(card.slug)}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <FinalCta />
    </>
  );
}

/**
 * Says out loud that this is not the real URL, so nobody reviewing it walks
 * away thinking /case-study-preview is what ships.
 */
function PreviewBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-center">
      <p className="text-sm font-black text-[#111111] uppercase">
        Design preview · real URL will be /case-studies/
        <Link href="/case-study-preview" className="ml-3 underline">
          All stories
        </Link>
      </p>
    </div>
  );
}
