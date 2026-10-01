import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { EventDateLine } from "@/components/sections/masterclass/EventDateLine";
import { CheckDisc } from "@/components/sections/masterclass/MasterclassHero";
import { StoriesToggle } from "@/components/sections/masterclass/StoriesToggle";
import { Wordmark } from "@/components/site/Wordmark";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { buttonClass } from "@/components/ui/Button";
import { Highlight } from "@/components/ui/Highlight";
import { APPLY_QUIZ_ANCHOR, APPLY_VSL_ANCHOR } from "@/lib/content/apply-page";
import {
  ANTHONY_VIDEO_ID,
  MASTERCLASS_DISCLAIMER,
  fitCopy,
  fitFor,
  hostCandids,
  hostCopy,
  hostVideoPoster,
  masterclassLiveEnd,
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

/** Section headline size shared by the host line, stories and Fit titles. */
const SECTION_HEADING =
  "v2-display text-ink text-[clamp(1.75rem,9vw,2.2rem)] leading-[1.0] uppercase sm:text-[clamp(2.2rem,4.4vw,3.4rem)]";

/**
 * Anthony's story video beside his live GHL numbers. The figures render as
 * they are: a count-up showed totals that were never real mid-animation.
 */
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
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:px-10">
        {embed ? (
          <div
            data-reveal
            className="rounded-card border-ink shadow-card min-w-0 border-2"
          >
            <YouTubeEmbedFrame
              embed={embed}
              title={hostCopy.videoTitle}
              thumbnailUrl={hostVideoPoster}
              className="aspect-video w-full rounded-[10px]"
            />
          </div>
        ) : null}
        <div
          data-reveal
          className="min-w-0"
          style={{ "--v2-delay": "0.1s" } as React.CSSProperties}
        >
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {hostCopy.eyebrow}
          </p>
          <h2 className={cn(SECTION_HEADING, "mt-3 text-balance")}>
            <Emphasis text={hostCopy.line} phrase={hostCopy.highlight} />
          </h2>
          {rows.length ? (
            <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.7fr)]">
              {rows.map(([label, value], index) => (
                <div
                  key={label}
                  className={cn(
                    "rounded-control border-ink bg-tint flex min-w-0 flex-col-reverse border-2 px-4 py-3",
                    index === 2 && "col-span-2 sm:col-span-1",
                  )}
                >
                  <dt className="text-eyebrow text-xs font-black tracking-[0.12em] uppercase">
                    {label}
                  </dt>
                  <dd className="v2-display text-ink text-[clamp(1.6rem,2.8vw,2.1rem)] leading-none tabular-nums">
                    {value}
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
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <div data-reveal>
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {storiesCopy.eyebrow}
          </p>
          <h2 className={cn(SECTION_HEADING, "mt-3 text-balance")}>
            <Emphasis
              text={storiesCopy.heading}
              phrase={storiesCopy.highlight}
            />
          </h2>
          <p className="mt-2 text-[15px] text-slate-600">
            {members.length} members, in their own words. {storiesCopy.body}
          </p>
        </div>
        <StoriesToggle
          total={members.length}
          mobile={storiesCopy.initialMobile}
          desktop={storiesCopy.initial}
        >
          <StoryList
            stories={members}
            collapse={{
              mobile: storiesCopy.initialMobile,
              desktop: storiesCopy.initial,
            }}
          />
        </StoriesToggle>
      </div>
    </section>
  );
}

/**
 * Thumbnails whose burned-in text reaches the bottom-right corner, where the
 * card play button sits by default; theirs moves to the top-right. Keyed by
 * YouTube id because the stories come from the CMS. Javier Zeder: "$8.5K
 * FIRST MONTH" runs to the bottom edge.
 */
const TOP_RIGHT_PLAY = new Set(["GO6C25-1mf8"]);

export function StoryList({
  stories,
  columns = 4,
  collapse,
}: {
  stories: CaseStudyStory[];
  columns?: 3 | 4;
  /**
   * Cards past these counts hide until the surrounding StoriesToggle opens
   * (it sets data-expanded on its group). Mobile shows fewer.
   */
  collapse?: { mobile: number; desktop: number };
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
            data-story-index={index}
            style={
              { "--v2-delay": `${(index % 4) * 0.07}s` } as React.CSSProperties
            }
            className={cn(
              "rounded-card border-ink shadow-card hover:shadow-card-hover outline-brand-700 flex flex-col overflow-hidden border-2 bg-white outline-offset-4 transition hover:-translate-y-1 has-[button:focus-visible]:outline-3 data-[revealed]:has-[button:focus]:outline-3",
              collapse &&
                index >= collapse.desktop &&
                "group-data-[expanded=false]/stories:hidden",
              collapse &&
                index >= collapse.mobile &&
                "max-md:group-data-[expanded=false]/stories:hidden",
            )}
          >
            {embed ? (
              <YouTubeEmbedFrame
                embed={embed}
                title={`${story.member_name}'s story`}
                className="aspect-video w-full"
                variant="card"
                playPosition={
                  TOP_RIGHT_PLAY.has(story.youtube_video_id!) ? "tr" : "br"
                }
              />
            ) : null}
            <div className="flex flex-1 flex-col p-4">
              <p className="text-ink font-black uppercase">
                {story.member_name}
              </p>
              {story.prior_occupation ? (
                <p className="text-ink/70 text-[14px] leading-snug font-semibold sm:min-h-[3lh]">
                  Was: {story.prior_occupation}
                </p>
              ) : null}
              {first || second ? (
                <div className="mt-auto pt-4">
                  {first ? (
                    <p className="flex flex-col items-start gap-1">
                      <Highlight className="v2-display px-1.5 text-2xl leading-none tabular-nums">
                        {first.value}
                      </Highlight>
                      <span className="text-eyebrow text-xs font-black tracking-[0.1em] uppercase">
                        {first.label}
                      </span>
                    </p>
                  ) : null}
                  {/* Two lines reserved, so a wrapped detail never lifts
                      this card's badge above its neighbours'. */}
                  <p className="mt-1 text-sm font-semibold text-slate-600 sm:min-h-[2lh]">
                    {second
                      ? `${second.value} ${second.label.toLowerCase()}`
                      : null}
                  </p>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The close: the GHL "Your freedom starts here" block with the date and a
 * live countdown, who it is for, then one CTA back to the form in the hero.
 */
export function FitSection({
  label,
  startsAt,
  renderedAt,
}: {
  label: string | null;
  startsAt: string | null;
  renderedAt: number;
}) {
  const endsAt = masterclassLiveEnd(startsAt);
  return (
    <section className="border-ink bg-tint border-t-2">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <div data-reveal className="flex flex-col items-center text-center">
          <h2 className={cn(SECTION_HEADING, "text-balance")}>
            <Emphasis text={fitCopy.heading} phrase={fitCopy.highlight} />
          </h2>
          <p className="text-ink mt-3 text-xl font-bold text-balance">
            {fitCopy.subheading}
          </p>
          {label ? (
            <p className="text-ink mt-4 text-lg font-bold">
              <EventDateLine
                label={label}
                startsAt={startsAt}
                renderedAt={renderedAt}
              />
            </p>
          ) : null}
          <HostCandids />
          {startsAt && endsAt ? (
            <div className="mt-8">
              <Countdown startsAt={startsAt} endsAt={endsAt} />
            </div>
          ) : null}
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 md:items-start">
          <FitCard title={fitCopy.forTitle} items={fitFor} good />
          <FitCard title={fitCopy.notForTitle} items={notFitFor} />
        </div>
        <div className="mt-12 flex flex-col items-center gap-3">
          <SaveSeatButton />
          <p className="text-[15px] font-semibold text-slate-600">
            {fitCopy.ctaNote}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The one CTA back to the form in the hero. */
function SaveSeatButton({ className }: { className?: string }) {
  return (
    <a
      href={`#${APPLY_QUIZ_ANCHOR}`}
      className={buttonClass({
        size: "lg",
        className: cn("w-full sm:w-auto", className),
      })}
    >
      {fitCopy.cta}
    </a>
  );
}

/**
 * Two candid shots of Anthony, the portrait one wider. The side tile stays
 * short enough (6:5) that its 628px-tall source is not upscaled on 2x
 * screens. Below sm only the portrait shot shows, landscape, so the closing
 * button stays near the heading.
 */
function HostCandids() {
  return (
    <div className="mx-auto mt-8 grid w-full max-w-[860px] grid-cols-1 items-center gap-3 sm:grid-cols-[1.2fr_1fr] sm:gap-6">
      {hostCandids.map((photo, index) => {
        const main = index === 0;
        return (
          <div
            key={photo.src}
            className={cn(
              "rounded-card border-ink shadow-card relative overflow-hidden border-2 bg-white",
              main
                ? "aspect-[4/3] sm:aspect-[4/5]"
                : "hidden aspect-[6/5] sm:block",
            )}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={
                main
                  ? "(min-width: 860px) 460px, (min-width: 640px) 52vw, 100vw"
                  : "(min-width: 860px) 380px, 44vw"
              }
              className={cn("object-cover", photo.position)}
            />
          </div>
        );
      })}
    </div>
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
      <h3 className="v2-display text-ink text-[clamp(1.6rem,2.6vw,2rem)] leading-none uppercase">
        {title}
      </h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-[15px] font-medium text-slate-700"
          >
            {good ? (
              <CheckDisc />
            ) : (
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-400 text-sm font-black text-white"
              >
                –
              </span>
            )}
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
        <Wordmark height={56} className="mb-2" />
        <p className="text-[13px] text-slate-500">{MASTERCLASS_DISCLAIMER}</p>
        <p className="flex items-center justify-center text-[13px] text-slate-500">
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center px-2 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/terms"
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline underline-offset-2"
          >
            Terms
          </Link>
        </p>
      </div>
    </footer>
  );
}
