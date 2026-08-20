import Image from "next/image";
import Link from "next/link";
import type { CaseStudyCard as CaseStudyCardData } from "@/lib/services/case-studies";

/**
 * The one card used by both the index grid and the "More Success Stories"
 * rail. Both surfaces show the same thing, so they share one component —
 * a restyle lands in both places at once.
 */
export function CaseStudyCard({
  caseStudy,
  headingLevel = "h3",
  href,
}: {
  caseStudy: CaseStudyCardData;
  /** The grid owns the section heading, so the card's title level varies. */
  headingLevel?: "h2" | "h3";
  /** Overridable so the temporary preview route can link within itself. */
  href?: string;
}) {
  const Heading = headingLevel;
  const cardHref = href ?? `/case-studies/${caseStudy.slug}`;
  const thumbnailUrl = caseStudy.cover_url ?? youtubeThumbnail(caseStudy);

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8] transition focus-within:-translate-y-0.5 hover:-translate-y-0.5 hover:shadow-[9px_9px_0_#55b8e8]">
      <div className="relative aspect-video w-full border-b-2 border-[#111111] bg-[#eaf8ff]">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={caseStudy.cover_alt ?? ""}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 360px"
            className="object-cover"
          />
        ) : null}
        {/*
          Only promise a video when there is one. Video is optional on a case
          study, and a play badge over a text-only story is a broken promise.
        */}
        {caseStudy.youtube_video_id ? (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#111111] bg-white/95"
          >
            <span className="ml-1 size-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-[#111111]" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {caseStudy.member_name}
          {caseStudy.member_role ? ` · ${caseStudy.member_role}` : ""}
        </p>
        <Heading className="text-lg leading-tight font-black text-[#111111] uppercase">
          {/*
            The whole card is the target, but only the title is a link — one
            link per card keeps the tab order and the accessible name honest.
          */}
          <Link
            href={cardHref}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {caseStudy.title}
          </Link>
        </Heading>
        {caseStudy.excerpt ? (
          <p className="line-clamp-3 text-sm leading-relaxed font-semibold text-slate-600">
            {caseStudy.excerpt}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * `i.ytimg.com` rather than `img.youtube.com`: both serve the same image, but
 * only i.ytimg.com is in next.config.ts `remotePatterns`, so this avoids
 * widening the image allowlist for a second host that adds nothing.
 *
 * `hqdefault` over `maxresdefault` because maxres is not generated for every
 * upload and 404s silently into a broken card.
 */
function youtubeThumbnail(caseStudy: CaseStudyCardData): string | null {
  return caseStudy.youtube_video_id
    ? `https://i.ytimg.com/vi/${caseStudy.youtube_video_id}/hqdefault.jpg`
    : null;
}
