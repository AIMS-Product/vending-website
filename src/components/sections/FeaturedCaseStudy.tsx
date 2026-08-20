import Image from "next/image";
import Link from "next/link";
import { parseStats } from "@/lib/case-studies/stats";
import type { FeaturedCaseStudy as FeaturedCaseStudyData } from "@/lib/services/case-studies";

/**
 * The story pinned above the grid. A bigger treatment than a card: media,
 * headline, the pull quote, and the curated numbers.
 *
 * Which story appears here comes from the `featured` column, so the editor
 * swaps it from /admin/case-studies without a deploy.
 *
 * The YouTube thumbnail is the fallback; `cover_url` overrides it, which is
 * how cleaner photos land later with no code change.
 */
export function FeaturedCaseStudy({
  caseStudy,
}: {
  caseStudy: FeaturedCaseStudyData;
}) {
  const href = `/case-studies/${caseStudy.slug}`;
  const stats = parseStats(caseStudy.stats).slice(0, 3);
  const thumbnailUrl =
    caseStudy.cover_url ??
    (caseStudy.youtube_video_id
      ? `https://i.ytimg.com/vi/${caseStudy.youtube_video_id}/hqdefault.jpg`
      : null);

  return (
    <section
      aria-labelledby="featured-case-study-title"
      className="border-b-2 border-[#111111] bg-white px-5 py-14 lg:px-10 lg:py-16"
    >
      <div className="mx-auto max-w-[1500px]">
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          Featured story
        </p>

        <article className="relative mt-6 grid gap-8 overflow-hidden rounded-[12px] border-2 border-[#111111] bg-[#f5fbff] p-6 shadow-[9px_9px_0_#55b8e8] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 lg:p-10">
          <div className="relative aspect-video w-full overflow-hidden rounded-[10px] border-2 border-[#111111] bg-[#eaf8ff]">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={caseStudy.cover_alt ?? ""}
                fill
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover"
                priority
              />
            ) : null}
            {caseStudy.youtube_video_id ? (
              <span
                aria-hidden
                className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#111111] bg-white/95"
              >
                <span className="ml-1.5 size-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-[#111111]" />
              </span>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-sm font-black text-[#111111]">
              {caseStudy.member_name}
            </p>
            {caseStudy.member_role ? (
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {caseStudy.member_role}
              </p>
            ) : null}

            <h2
              id="featured-case-study-title"
              className="mt-4 text-[clamp(1.75rem,3.1vw,2.75rem)] leading-[1.08] font-black text-[#111111] uppercase"
            >
              {/* The whole card is clickable, but only the title is a link. */}
              <Link
                href={href}
                className="after:absolute after:inset-0 focus-visible:outline-none"
              >
                {caseStudy.title}
              </Link>
            </h2>

            {caseStudy.quote ? (
              <blockquote className="mt-5 border-l-4 border-[#55b8e8] pl-4 text-lg leading-7 font-semibold text-slate-700">
                <span aria-hidden>&ldquo;</span>
                {caseStudy.quote}
                <span aria-hidden>&rdquo;</span>
              </blockquote>
            ) : caseStudy.excerpt ? (
              <p className="mt-5 text-lg leading-7 font-semibold text-slate-700">
                {caseStudy.excerpt}
              </p>
            ) : null}

            {stats.length > 0 ? (
              <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
                {stats.map((stat) => (
                  <div key={`${stat.label}-${stat.value}`}>
                    <dd className="text-[clamp(1.5rem,2.4vw,2rem)] leading-none font-black text-[#111111] tabular-nums">
                      {stat.value}
                    </dd>
                    <dt className="mt-2 text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>
            ) : null}

            <p
              aria-hidden
              className="mt-8 text-sm font-black text-[#066a99] uppercase"
            >
              Read the full story
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
