import Image from "next/image";
import Link from "next/link";
import type { CaseStudyCard as CaseStudyCardData } from "@/lib/services/case-studies";
import { humanBadges } from "@/lib/case-studies/index-filters";

/**
 * The one card used by both the index grid and the "More Success Stories"
 * rail. Both surfaces show the same thing, so they share one component —
 * a restyle lands in both places at once.
 */
export function CaseStudyCard({
  caseStudy,
  headingLevel = "h3",
}: {
  caseStudy: CaseStudyCardData;
  /** The grid owns the section heading, so the card's title level varies. */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const cardHref = `/case-studies/${caseStudy.slug}`;
  const thumbnailUrl = caseStudy.cover_url ?? youtubeThumbnail(caseStudy);
  // Two at most. The card is already carrying a name, a role, a title and an
  // excerpt; a third badge pushes the excerpt below the fold of the card and
  // the grid stops scanning.
  const badges = humanBadges(caseStudy.tags, 2);

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

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        {/*
          Name and role were one small uppercase tracked line, which shouted
          at the same volume as the uppercase title directly beneath it and
          made the cards hard to skim. Three ranks now: the title is the only
          uppercase element, the name reads as a name, the role recedes.
        */}
        <div>
          <p className="text-sm leading-snug font-black text-[#111111]">
            {caseStudy.member_name}
          </p>
          {caseStudy.member_role ? (
            <p className="mt-0.5 text-xs leading-snug font-semibold text-slate-500">
              {caseStudy.member_role}
            </p>
          ) : null}
        </div>
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
        {/*
          Pushed to the bottom of the card so every card's badges sit on one
          line however long the excerpt above them runs.
        */}
        {badges.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {badges.map((badge) => (
              <li
                key={badge}
                className="rounded-full border border-[#111111] bg-[#eaf8ff] px-2.5 py-1 text-[11px] leading-none font-black text-[#111111]"
              >
                {badge}
              </li>
            ))}
          </ul>
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
