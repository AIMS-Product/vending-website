import Image from "next/image";
import Link from "next/link";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import type {
  CaseStudy,
  CaseStudyCard as CaseStudyCardData,
} from "@/lib/services/case-studies";
import { parseStats } from "@/lib/case-studies/stats";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import { siteUrl } from "@/lib/site";

type CaseStudyArticleProps = {
  caseStudy: Pick<
    CaseStudy,
    | "slug"
    | "title"
    | "member_name"
    | "member_role"
    | "excerpt"
    | "youtube_video_id"
    | "quote"
    | "quote_attribution"
    | "cover_url"
    | "cover_alt"
    | "stats"
    | "published_at"
  >;
  /** Sanitised HTML rendered from the markdown body. */
  html: string;
  /** Already resolved and ordered by the page. Empty is a valid state. */
  related: readonly CaseStudyCardData[];
  /**
   * Overrides where the related cards link. Only the temporary preview route
   * passes this; production uses the real `/case-studies/<slug>` URLs.
   */
  cardHrefFor?: (slug: string) => string;
};

/**
 * The single template every case study page renders through. Editing this
 * file changes all of them — that is the point of the collection living in
 * the CMS rather than as builder blocks.
 *
 * Layout deliberately matches `NewsArticle`: same share rail, same sticky
 * sidebar, same prose class. The differences are the video hero, the stats
 * strip and the pull quote.
 */
export function CaseStudyArticle({
  caseStudy,
  html,
  related,
  cardHrefFor,
}: CaseStudyArticleProps) {
  const headings = extractArticleHeadings(html);
  const stats = parseStats(caseStudy.stats);
  const articleUrl = new URL(
    `/case-studies/${caseStudy.slug}`,
    siteUrl,
  ).toString();
  const embed = caseStudy.youtube_video_id
    ? getVideoEmbed(
        `https://www.youtube.com/watch?v=${caseStudy.youtube_video_id}`,
      )
    : null;

  return (
    <>
      <div className="bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32">
        <div className="mx-auto grid max-w-[1500px] gap-12 xl:grid-cols-[64px_minmax(0,920px)_360px] xl:gap-14">
          <ShareRail title={caseStudy.title} url={articleUrl} />

          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/"
                className="text-sm font-black text-[#066a99] uppercase transition hover:text-[#2d9fd6]"
              >
                Home
              </Link>
              <span aria-hidden className="font-black text-[#066a99]">
                /
              </span>
              <Link
                href="/case-studies"
                className="text-sm font-black text-[#066a99] uppercase transition hover:text-[#2d9fd6]"
              >
                Case Studies
              </Link>
              <span className="rounded-[8px] border-2 border-[#066a99] bg-[#066a99] px-4 py-2 text-xs font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
                {caseStudy.member_name}
              </span>
            </div>

            <header className="mt-10">
              <h1 className="max-w-[900px] text-[clamp(2.25rem,4.4vw,4rem)] leading-[1.02] font-black break-words text-[#111111] uppercase">
                {caseStudy.title}
              </h1>
              {caseStudy.excerpt && (
                <p className="mt-6 max-w-3xl text-xl leading-8 font-semibold text-slate-700">
                  {caseStudy.excerpt}
                </p>
              )}
              <Byline
                memberName={caseStudy.member_name}
                memberRole={caseStudy.member_role}
                publishedAt={caseStudy.published_at}
              />
            </header>

            <VideoHero
              embed={embed}
              title={caseStudy.title}
              memberName={caseStudy.member_name}
              coverUrl={caseStudy.cover_url}
              coverAlt={caseStudy.cover_alt}
            />

            {stats.length > 0 && <StatsStrip stats={stats} />}

            {caseStudy.quote && (
              <PullQuote
                quote={caseStudy.quote}
                attribution={
                  caseStudy.quote_attribution ?? caseStudy.member_name
                }
              />
            )}

            <div
              className="public-news-prose mt-14"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </article>

          <ArticleSidebar headings={headings} />
        </div>
      </div>

      <MoreSuccessStories related={related} cardHrefFor={cardHrefFor} />
    </>
  );
}

/**
 * Click-to-play facade. No YouTube iframe or script is mounted until the
 * visitor actually presses play, which keeps the largest asset on the page
 * off the critical path.
 *
 * A row with no video id still renders: it falls back to the cover image, and
 * failing that to nothing at all, rather than leaving a broken frame.
 */
function VideoHero({
  embed,
  title,
  memberName,
  coverUrl,
  coverAlt,
}: {
  embed: ReturnType<typeof getVideoEmbed>;
  title: string;
  memberName: string;
  coverUrl: string | null;
  coverAlt: string | null;
}) {
  if (embed) {
    return (
      <div className="mt-12 overflow-hidden rounded-[8px] border-2 border-[#111111] bg-black shadow-[8px_8px_0_#55b8e8]">
        <YouTubeEmbedFrame
          embed={embed}
          title={`${memberName}: ${title}`}
          thumbnailUrl={coverUrl ?? undefined}
          className="aspect-video w-full"
        />
      </div>
    );
  }

  if (coverUrl) {
    return (
      <div className="relative mt-12 aspect-video w-full overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[8px_8px_0_#55b8e8]">
        <Image
          src={coverUrl}
          alt={coverAlt ?? title}
          fill
          sizes="(max-width: 1024px) 100vw, 920px"
          priority
          className="object-cover"
        />
      </div>
    );
  }

  return null;
}

function StatsStrip({
  stats,
}: {
  stats: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <section
      aria-label="Results at a glance"
      className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      {stats.map((stat) => (
        <div
          key={`${stat.label}-${stat.value}`}
          className="rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#f47b3b]"
        >
          <p className="text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-black text-[#111111] tabular-nums">
            {stat.value}
          </p>
          <p className="mt-3 text-xs font-black tracking-[0.12em] text-[#066a99] uppercase">
            {stat.label}
          </p>
        </div>
      ))}
    </section>
  );
}

function PullQuote({
  quote,
  attribution,
}: {
  quote: string;
  attribution: string;
}) {
  return (
    <figure className="mt-14 rounded-[12px] border-2 border-[#111111] bg-[#111111] p-8 text-white shadow-[8px_8px_0_#55b8e8] lg:p-10">
      <blockquote className="text-[clamp(1.5rem,2.6vw,2.15rem)] leading-[1.25] font-black text-balance">
        {/* Curly quotes are decorative here; the quote text itself is the
            accessible content, so the marks stay out of the string. */}
        <span aria-hidden>&ldquo;</span>
        {quote}
        <span aria-hidden>&rdquo;</span>
      </blockquote>
      <figcaption className="mt-6 text-sm font-black tracking-[0.12em] text-[#55b8e8] uppercase">
        {attribution}
      </figcaption>
    </figure>
  );
}

function Byline({
  memberName,
  memberRole,
  publishedAt,
}: {
  memberName: string;
  memberRole: string | null;
  publishedAt: string | null;
}) {
  const parts: string[] = [
    memberRole ? `${memberName}, ${memberRole}` : memberName,
  ];
  if (publishedAt) {
    parts.push(
      new Date(publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }
  return (
    <div className="mt-12 border-y-2 border-[#bfeeff] py-6">
      <div className="flex flex-wrap items-center gap-5 text-[#066a99]">
        {parts.map((part) => (
          <span key={part} className="flex items-center gap-5 text-lg">
            <span aria-hidden className="size-1.5 rounded-full bg-[#55b8e8]" />
            <span className="font-semibold">{part}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareRail({ title, url }: { title: string; url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links = [
    {
      label: "Share on X",
      text: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      label: "Share on LinkedIn",
      text: "in",
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      label: "Share on Facebook",
      text: "f",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    { label: "Open case study link", text: "link", href: url },
  ];

  return (
    <aside className="hidden xl:block" aria-label="Share this case study">
      <div className="sticky top-32 flex flex-col items-center gap-5">
        {links.slice(0, 3).map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-12 items-center justify-center rounded-[8px] border-2 border-[#066a99] bg-white text-base font-black text-[#066a99] shadow-[4px_4px_0_#55b8e8] transition hover:-translate-y-0.5 hover:bg-[#eaf8ff]"
          >
            {link.text}
          </a>
        ))}
        <span className="my-2 h-px w-12 bg-[#55b8e8]" aria-hidden />
        <a
          href={links[3].href}
          aria-label={links[3].label}
          className="flex size-12 items-center justify-center rounded-[8px] border-2 border-[#066a99] bg-white text-base font-black text-[#066a99] shadow-[4px_4px_0_#55b8e8] transition hover:-translate-y-0.5 hover:bg-[#eaf8ff]"
        >
          {links[3].text}
        </a>
      </div>
    </aside>
  );
}

function ArticleSidebar({ headings }: { headings: string[] }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-32 space-y-10">
        {headings.length > 0 && (
          <section className="rounded-[12px] border-2 border-[#066a99] bg-white p-7 shadow-[7px_7px_0_#55b8e8]">
            <p className="inline-flex rounded-[5px] border border-[#9fe6ff] bg-[#d6f4ff] px-3 py-2 text-xs font-black text-[#111111] uppercase">
              In this story
            </p>
            <ol className="mt-6 space-y-4 text-lg font-semibold text-[#066a99]">
              {headings.slice(0, 6).map((heading, index) => (
                <li key={`${heading}-${index}`} className="flex gap-3">
                  <span>{index + 1}.</span>
                  <span>{heading}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="rounded-[12px] border-2 border-[#066a99] bg-[#066a99] p-8 text-white shadow-[7px_7px_0_#55b8e8]">
          <h2 className="text-3xl leading-tight font-black uppercase">
            Start your own story.
          </h2>
          <p className="mt-5 text-lg leading-7 font-semibold text-white">
            Get the complete A-Z blueprint to building a vending route.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-[8px] border-2 border-white bg-[#f47b3b] px-6 text-sm font-black text-[#111111] uppercase transition hover:-translate-y-0.5"
          >
            Book a call
          </Link>
        </section>
      </div>
    </aside>
  );
}

function MoreSuccessStories({
  related,
  cardHrefFor,
}: {
  related: readonly CaseStudyCardData[];
  cardHrefFor?: (slug: string) => string;
}) {
  if (related.length === 0) return null;

  return (
    <section className="border-t-2 border-[#111111] bg-white px-5 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-[1500px]">
        <h2 className="text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
          More success stories
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <li key={item.slug} className="min-w-0">
              <CaseStudyCard caseStudy={item} href={cardHrefFor?.(item.slug)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function extractArticleHeadings(html: string): string[] {
  return [...html.matchAll(/<h2(?:\s[^>]*)?>(.*?)<\/h2>/gi)].flatMap(
    (match) => {
      const heading = decodeHtmlEntities(stripTags(match[1]).trim());
      return heading ? [heading] : [];
    },
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
