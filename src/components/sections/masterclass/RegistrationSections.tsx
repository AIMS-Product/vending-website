import Link from "next/link";
import { AnimatedStatValue } from "@/components/sections/AnimatedStatValue";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { APPLY_QUIZ_ANCHOR, APPLY_VSL_ANCHOR } from "@/lib/content/apply-page";
import {
  ANTHONY_VIDEO_ID,
  MASTERCLASS_DISCLAIMER,
  fitCopy,
  fitFor,
  hostCopy,
  notFitFor,
  storiesCopy,
} from "@/lib/content/masterclass";
import { parseStats } from "@/lib/case-studies/stats";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import type { CaseStudyStory } from "@/lib/services/case-studies";
import type { MasterclassEvent } from "@/lib/services/masterclass-event";
import { cn } from "@/lib/utils";

type AnthonyStats = NonNullable<MasterclassEvent["anthony"]>;

/** Sets `phrase` inside `text` in the blue highlight block. */
export function Emphasis({ text, phrase }: { text: string; phrase: string }) {
  const at = text.indexOf(phrase);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Highlight>{phrase}</Highlight>
      {text.slice(at + phrase.length)}
    </>
  );
}

const youtube = (id: string) =>
  getVideoEmbed(`https://www.youtube.com/watch?v=${id}`);

/** Anthony's story video beside his live GHL numbers, counting up on arrival. */
export function HostBand({ stats }: { stats: AnthonyStats | null }) {
  const embed = youtube(ANTHONY_VIDEO_ID);
  const rows = stats
    ? [
        [hostCopy.statLabels.locations, stats.locations],
        [hostCopy.statLabels.machines, stats.machines],
        [hostCopy.statLabels.revenue, stats.revenue],
      ]
    : [];
  return (
    <section
      id={APPLY_VSL_ANCHOR}
      className="border-ink scroll-mt-6 border-y-2 bg-white"
    >
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-16 lg:grid-cols-[1.15fr_1fr] lg:px-10">
        {embed ? (
          <div
            data-reveal
            className="rounded-card border-ink shadow-card border-2"
          >
            <YouTubeEmbedFrame
              embed={embed}
              title={hostCopy.videoTitle}
              className="aspect-video w-full rounded-[10px]"
            />
          </div>
        ) : null}
        <div
          data-reveal
          style={{ "--v2-delay": "0.1s" } as React.CSSProperties}
        >
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {hostCopy.eyebrow}
          </p>
          <p className="text-ink mt-3 text-[clamp(1.6rem,3vw,2.3rem)] leading-[1.15] font-black uppercase">
            <Emphasis text={hostCopy.line} phrase={hostCopy.highlight} />
          </p>
          {rows.length ? (
            <dl className="mt-7 grid grid-cols-[1fr_1fr_1.7fr] gap-3">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-control border-ink bg-tint flex flex-col-reverse border-2 px-3 py-3"
                >
                  <dt className="text-eyebrow text-[11px] font-black tracking-[0.12em] uppercase">
                    {label}
                  </dt>
                  <dd className="text-ink text-[clamp(1.25rem,2.6vw,1.9rem)] font-black tabular-nums">
                    <AnimatedStatValue value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">{hostCopy.footnote}</p>
        </div>
      </div>
    </section>
  );
}

/** One headline number per story: the first stat the member published. */
function headline(story: CaseStudyStory) {
  const [first, second] = parseStats(story.stats);
  return { first, second };
}

/** A light marquee of member results; decorative, so screen readers get a summary. */
export function ResultsTicker({ stories }: { stories: CaseStudyStory[] }) {
  const items = stories.flatMap((story) => {
    const { first } = headline(story);
    return first
      ? [`${story.member_name}: ${first.value} ${first.label.toLowerCase()}`]
      : [];
  });
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <section
      aria-label="Member results"
      className="border-ink bg-tint overflow-hidden border-b-2 py-4"
    >
      <p className="sr-only">
        Results from {items.length} Vendingpreneurs members.
      </p>
      <div
        aria-hidden
        className="brand-marquee flex w-max items-center gap-8 hover:[animation-play-state:paused]"
      >
        {row.map((item, index) => (
          <span
            key={index}
            className="text-ink flex items-center gap-8 text-sm font-black whitespace-nowrap uppercase"
          >
            {item}
            <span className="bg-brand-600 size-2 rotate-45" />
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * Every published member story, playing in place. Nothing here links out: the
 * page's only job is the form, so a story opens where it sits and "more" is a
 * native disclosure, not a new page.
 */
export function StoriesGrid({ stories }: { stories: CaseStudyStory[] }) {
  const members = stories.filter(
    (s) => s.youtube_video_id && s.youtube_video_id !== ANTHONY_VIDEO_ID,
  );
  if (!members.length) return null;
  const shown = members.slice(0, storiesCopy.initial);
  const rest = members.slice(storiesCopy.initial);
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <div data-reveal>
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {storiesCopy.eyebrow}
          </p>
          <h2 className="text-ink mt-3 text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.15] font-black uppercase">
            <Emphasis
              text={storiesCopy.heading}
              phrase={storiesCopy.highlight}
            />
          </h2>
          <p className="mt-2 text-[15px] text-slate-600">
            {members.length} members, in their own words. {storiesCopy.body}
          </p>
        </div>
        <StoryList stories={shown} />
        {rest.length ? (
          <details className="group mt-6">
            <summary
              className={cn(
                buttonClass({ variant: "ghost" }),
                "mx-auto flex w-fit cursor-pointer list-none group-open:hidden [&::-webkit-details-marker]:hidden",
              )}
            >
              {storiesCopy.more(rest.length)}
            </summary>
            <StoryList stories={rest} />
          </details>
        ) : null}
      </div>
    </section>
  );
}

export function StoryList({
  stories,
  columns = 4,
}: {
  stories: CaseStudyStory[];
  columns?: 3 | 4;
}) {
  return (
    <ul
      className={cn(
        "mt-8 grid gap-6 sm:grid-cols-2",
        columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {stories.map((story, index) => {
        const embed = youtube(story.youtube_video_id!);
        const { first, second } = headline(story);
        return (
          <li
            key={story.slug}
            data-reveal
            style={
              { "--v2-delay": `${(index % 4) * 0.07}s` } as React.CSSProperties
            }
            className="rounded-card border-ink shadow-card hover:shadow-card-hover overflow-hidden border-2 bg-white transition hover:-translate-y-1"
          >
            {embed ? (
              <YouTubeEmbedFrame
                embed={embed}
                title={`${story.member_name}'s story`}
                className="aspect-video w-full"
              />
            ) : null}
            <div className="p-4">
              <p className="text-ink font-black uppercase">
                {story.member_name}
              </p>
              {story.prior_occupation ? (
                <p className="line-clamp-2 text-xs font-semibold text-slate-500">
                  Was: {story.prior_occupation}
                </p>
              ) : null}
              {first ? (
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <Highlight className="text-lg">{first.value}</Highlight>
                  <span className="text-eyebrow text-xs font-black tracking-[0.1em] uppercase">
                    {first.label}
                  </span>
                </p>
              ) : null}
              {second ? (
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {second.value} {second.label.toLowerCase()}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Who it is for, then one CTA back to the form in the hero. */
export function FitSection() {
  return (
    <section className="border-ink bg-tint border-t-2">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-16 md:grid-cols-2 lg:px-10">
        <FitCard title={fitCopy.forTitle} items={fitFor} good />
        <FitCard title={fitCopy.notForTitle} items={notFitFor} />
      </div>
      <div className="flex justify-center pb-16">
        <a
          href={`#${APPLY_QUIZ_ANCHOR}`}
          className={buttonClass({ size: "lg" })}
        >
          {fitCopy.cta}
        </a>
      </div>
    </section>
  );
}

function FitCard({
  title,
  items,
  good = false,
}: {
  title: string;
  items: readonly string[];
  good?: boolean;
}) {
  return (
    <div
      data-reveal
      className="rounded-card border-ink shadow-card border-2 bg-white p-6"
    >
      <p className="text-ink text-lg font-black uppercase">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-[15px] font-medium text-slate-700"
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white",
                good ? "bg-brand-700" : "bg-slate-400",
              )}
            >
              {good ? "✓" : "–"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Light footer: the shortened approved disclaimer plus the legal links. */
export function MasterclassFooter() {
  return (
    <footer className="border-ink border-t-2 bg-white">
      <div className="mx-auto flex max-w-[860px] flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-ink text-lg font-black tracking-wide uppercase">
          Vendingpreneurs
        </p>
        <p className="text-[13px] text-slate-500">{MASTERCLASS_DISCLAIMER}</p>
        <p className="text-[13px] text-slate-500">
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </p>
      </div>
    </footer>
  );
}
