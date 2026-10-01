import { Fragment } from "react";
import Script from "next/script";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { CalendlyEmbed } from "@/components/embeds/CalendlyEmbed";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { WhenNearViewport } from "@/components/media/WhenNearViewport";
import { Wordmark } from "@/components/site/Wordmark";
import { buttonClass } from "@/components/ui/Button";
import {
  REPLAY_ANCHORS,
  REPLAY_GHL_FORM_ID,
  REPLAY_GHL_FORM_SCRIPT,
  REPLAY_GHL_FORM_SRC,
  replayExpiresLabel,
  replayTestimonials,
  replayTestimonialsCopy,
  type ReplayCtaParagraph,
  type ReplayVariant,
  type ReplayVideo,
} from "@/lib/content/masterclass-replay";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import { cn } from "@/lib/utils";
import replayHostStill from "./replay-host-still.jpg";

/**
 * `bare` drops the player's own ink frame, for players that sit inside a card
 * which already carries the border and shadow. Those card players also get the
 * corner play button, so the thumbnail's result text stays readable.
 */
export function ReplayVideoPlayer({
  video,
  title,
  loadOn = "near",
  bare = false,
  poster,
}: {
  video: ReplayVideo;
  title: string;
  loadOn?: "near" | "click";
  bare?: boolean;
  /** Overrides the video's own poster (the hero's branded host still). */
  poster?: string;
}) {
  if (video.kind === "vidalytics") {
    return (
      <VidalyticsPlayer
        embedId={video.embedId}
        title={title}
        loadOn={loadOn}
        poster={poster ?? video.poster}
        framed={!bare}
        playButton={bare ? "card" : "hero"}
        playLabel={`Play ${title}`}
        posterSizes={
          bare
            ? "(min-width: 1024px) 400px, 100vw"
            : "(min-width: 1024px) 1060px, 100vw"
        }
      />
    );
  }
  const embed = getVideoEmbed(`https://www.youtube.com/watch?v=${video.id}`);
  if (!embed) return null;
  const frame = (
    <YouTubeEmbedFrame
      embed={embed}
      title={title}
      className="aspect-video w-full"
      variant={bare ? "card" : "hero"}
    />
  );
  if (bare) return frame;
  return (
    <div className="rounded-card border-ink shadow-card overflow-hidden border-2">
      {frame}
    </div>
  );
}

const anchorHref = (target: "video" | "cta") => `#${REPLAY_ANCHORS[target]}`;

function AnchorButton({
  label,
  target,
}: {
  label: string;
  target: "video" | "cta";
}) {
  return (
    <a
      href={anchorHref(target)}
      className={buttonClass({
        size: "lg",
        className:
          "w-full px-5 text-[15px] text-balance sm:w-auto sm:px-10 sm:text-base",
      })}
    >
      <span className="text-center leading-tight">{label}</span>
    </a>
  );
}

/**
 * The slim, unlinked brand bar /masterclass opens with. The wordmark PNG is
 * ~47% transparent margin, so height 52 draws a ~28px mark with ~15px of
 * air above and below it.
 */
function ReplayLogoBar() {
  return (
    <div className="border-ink border-b-2 bg-white">
      <div className="mx-auto flex max-w-[1180px] items-center px-5 py-0.5 lg:px-10">
        <Wordmark height={52} eager />
      </div>
    </div>
  );
}

/** The countdown sits in its own tinted strip so it reads as a timer. */
function ReplayCountdownStrip({ expiresAt }: { expiresAt: string }) {
  return (
    <div className="border-ink bg-tint border-b-2">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-2 px-5 py-4 lg:px-10">
        <p className="text-eyebrow text-sm font-black tracking-[0.14em] uppercase">
          {replayExpiresLabel}
        </p>
        <Countdown startsAt={expiresAt} expiredLabel="This replay has ended" />
      </div>
    </div>
  );
}

export function ReplayHero({
  variant,
  expiresAt,
}: {
  variant: ReplayVariant;
  expiresAt: string | null;
}) {
  // A variant with its own hero button (meta) sets the video straight under
  // the headline, with the sub copy and button after it: the copy refers to
  // having watched the replay.
  const copyAfterVideo = Boolean(variant.hero);
  const longHeading = variant.heading.length > 90;
  // A mid-length heading (advisory) set at the short size breaks to three
  // lines and pushes the player below the fold; a smaller size and wider
  // column keep it to two.
  const midHeading = !longHeading && variant.heading.length > 70;
  const subCopy = variant.sub.map((line) => (
    <p key={line} className="max-w-[720px] text-lg text-slate-700">
      {line}
    </p>
  ));
  return (
    <section className="border-ink border-b-2 bg-white">
      <ReplayLogoBar />
      {expiresAt ? <ReplayCountdownStrip expiresAt={expiresAt} /> : null}
      <div
        className={cn(
          "mx-auto flex flex-col items-center px-5 pb-12 text-center lg:px-10",
          midHeading ? "gap-5 pt-7" : "gap-6 pt-10 lg:pt-12",
          longHeading || midHeading ? "max-w-[1120px]" : "max-w-[980px]",
        )}
      >
        <h1
          className={cn(
            "v2-display text-ink text-balance uppercase",
            longHeading
              ? "text-[clamp(1.6rem,7vw,2rem)] sm:text-[2.4rem] md:text-[clamp(2rem,3.6vw,3.25rem)]"
              : midHeading
                ? "text-[clamp(2.2rem,4vw,3.4rem)]"
                : "text-[clamp(2.4rem,5vw,4rem)]",
            // After the size: tailwind-merge drops a leading-* set before it.
            "leading-[1.02]",
          )}
        >
          {variant.heading}
        </h1>
        {copyAfterVideo ? null : subCopy}
        <div
          id={REPLAY_ANCHORS.video}
          className={cn(
            "w-full scroll-mt-6",
            midHeading ? "max-w-[1060px]" : "mt-2",
          )}
        >
          <ReplayVideoPlayer
            video={variant.mainVideo}
            title="Masterclass replay"
            poster={replayHostStill.src}
          />
        </div>
        {copyAfterVideo ? subCopy : null}
        {variant.hero ? (
          <AnchorButton
            label={variant.hero.label}
            target={variant.hero.target}
          />
        ) : null}
        {variant.steps.length ? <ReplaySteps variant={variant} /> : null}
      </div>
    </section>
  );
}

function ReplaySteps({ variant }: { variant: ReplayVariant }) {
  const row = "text-ink flex items-center gap-3 text-base font-bold";
  return (
    <ol className="mt-2 flex w-full flex-col gap-3 text-left sm:w-auto sm:flex-row sm:justify-center sm:gap-6">
      {variant.steps.map((step, index) => {
        const badge = (
          <span
            aria-hidden
            className="rounded-control border-ink grid size-8 shrink-0 place-items-center border-2 bg-white text-sm font-black tabular-nums"
          >
            {index + 1}
          </span>
        );
        return (
          <li key={step.label}>
            {step.target ? (
              <a
                href={anchorHref(step.target)}
                className={cn(
                  row,
                  "group rounded-control focus-visible:ring-sky focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                {badge}
                <span className="decoration-brand-600 underline decoration-2 underline-offset-4 group-hover:decoration-[3px]">
                  {step.label}
                </span>
              </a>
            ) : (
              <span className={row}>
                {badge}
                <span>{step.label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const PARAGRAPH_WEIGHT: Record<
  NonNullable<ReplayCtaParagraph["weight"]>,
  string
> = {
  black: "text-ink font-black",
  semibold: "text-ink font-semibold",
};

export function ReplayBooking({
  variant,
  attribution,
}: {
  variant: ReplayVariant;
  attribution: LeadAttribution;
}) {
  const cta = variant.cta;
  if (!cta) return null;
  const calendly = cta.action.kind === "calendly";
  return (
    <section
      id={REPLAY_ANCHORS.cta}
      className="border-ink bg-tint scroll-mt-6 border-b-2"
    >
      <div className="mx-auto max-w-[760px] px-5 pt-14 lg:px-10">
        <h2
          className={cn(
            "v2-display text-ink text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] uppercase",
            calendly ? "text-left md:text-center" : "text-center",
          )}
        >
          {cta.heading}
        </h2>
        <div
          className={cn(
            "mx-auto mt-5 max-w-[60ch] space-y-2 text-[17px] text-slate-700",
            calendly ? "text-left md:text-center" : "text-center",
          )}
        >
          {cta.lead ? (
            <p className="text-ink text-lg font-semibold">{cta.lead}</p>
          ) : null}
          {cta.paragraphs.map((paragraph) => (
            <p
              key={paragraph.lines.join(" ")}
              className={
                paragraph.weight ? PARAGRAPH_WEIGHT[paragraph.weight] : ""
              }
            >
              {paragraph.lines.map((line, index) => (
                <Fragment key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </Fragment>
              ))}
            </p>
          ))}
        </div>
      </div>
      {/* Calendly switches to its two-column layout at 1000px; 1100 - 2x40 gutter - border leaves 1016px. The form needs no more than the copy column.
          hideDetails drops Calendly's event-details panel (the copy above already says it), so a phone opens on the month: a six-row month plus time zone ends at ~650px, hence 680. */}
      <div
        className={cn(
          "mx-auto px-5 lg:px-10",
          calendly
            ? "max-w-[1100px] pt-0 pb-10 md:pb-14"
            : "max-w-[760px] pt-8 pb-14",
        )}
      >
        {cta.action.kind === "ghl-form" ? (
          <GhlForm attribution={attribution} />
        ) : (
          <CalendlyEmbed
            url={cta.action.calendlyUrl}
            attribution={attribution}
            hideDetails
            heightClassName="h-[680px] md:h-[700px]"
            framed={false}
          />
        )}
      </div>
    </section>
  );
}

const FORWARDED = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const GHL_FORM_SLOT_ID = `ghl-slot-${REPLAY_GHL_FORM_ID}`;

/**
 * GHL's own form, so GHL receives the submission, the score, and runs its
 * redirect exactly as on the GHL page. Deliberately not the site lead form,
 * which would write lead_submissions and sync to Close.
 *
 * GHL's form carries built-in top padding (~64px desktop, less on phones); the
 * iframe is pulled up inside the overflow-hidden card so the first field sits
 * ~24px from the border. On phones GHL's own rounded card edge and grey
 * shadow show under the legal links, so the slot (overflow-hidden) clips the
 * iframe's bottom 32px; at sm and up form_embed.js sizes the iframe short of
 * that edge already and the links sit in its last pixels, so nothing is
 * clipped there. The card's pb-6 sits under the links either way.
 *
 * form_embed.js hides the iframe while it loads, then sizes it (by its
 * `inline-<id>` id) to the form: 787px at sm and up, 1238px on a 390px phone.
 * The slot reserves the visible height (1238 - 32 crop; 787) unconditionally,
 * so the page height is the same before mount, while hidden and after load.
 * The iframe mounts only within 200px of the viewport, so the form's
 * Turnstile does not start polling on page load.
 */
function GhlForm({ attribution }: { attribution: LeadAttribution }) {
  const src = new URL(REPLAY_GHL_FORM_SRC);
  for (const key of FORWARDED) {
    if (attribution[key]) src.searchParams.set(key, attribution[key]);
  }
  return (
    <div className="rounded-card border-ink shadow-card overflow-hidden border-2 bg-white pb-6">
      <div
        id={GHL_FORM_SLOT_ID}
        className="-mt-2 min-h-[1206px] overflow-hidden sm:-mt-10 sm:min-h-[787px]"
      >
        <WhenNearViewport
          targetId={GHL_FORM_SLOT_ID}
          margin="0px 0px 200px 0px"
        >
          <iframe
            id={`inline-${REPLAY_GHL_FORM_ID}`}
            src={src.toString()}
            title="Book your free advisory call"
            className="-mb-8 block min-h-[787px] w-full border-0 sm:mb-0"
            data-form-id={REPLAY_GHL_FORM_ID}
            data-layout="{'id':'INLINE'}"
            data-form-name="Lead Scoring -> Book a Call"
          />
          <Script src={REPLAY_GHL_FORM_SCRIPT} strategy="lazyOnload" />
        </WhenNearViewport>
      </div>
    </div>
  );
}

function ReplayResult({ result }: { result: string }) {
  const parts = result.split(" | ");
  return (
    <p className="text-ink mt-3 flex flex-wrap items-center gap-x-3 text-sm font-black">
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 ? (
            <span aria-hidden className="bg-ink h-4 w-px self-center" />
          ) : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

export function ReplayTestimonials({ variant }: { variant: ReplayVariant }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
          {replayTestimonialsCopy.eyebrow}
        </p>
        <h2 className="v2-display text-ink mt-3 text-center text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] uppercase">
          {replayTestimonialsCopy.heading}
        </h2>
        {/* Below md a scroll-snap rail (next card peeking); a grid above. */}
        <ul className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:snap-none md:flex-wrap md:justify-center md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {replayTestimonials.map((item, index) => {
            const video = variant.testimonialVideos[index];
            return (
              <li
                key={item.name}
                className="rounded-card border-ink shadow-card flex w-[85%] shrink-0 snap-start flex-col overflow-hidden border-2 bg-white md:w-[calc(50%-0.75rem)] lg:w-[calc((100%-3rem)/3)]"
              >
                {video ? (
                  <div className="border-ink border-b-2">
                    <ReplayVideoPlayer
                      video={video}
                      title={`${item.name}'s story`}
                      loadOn="click"
                      bare
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-eyebrow text-xs font-black tracking-[0.12em] uppercase">
                    {item.tag}
                  </p>
                  <blockquote className="mt-3 text-[15px] text-slate-700">
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                  {/* Name and result travel together to the card foot, so a
                      short quote leaves its space above, not inside, them. */}
                  <div className="mt-auto pt-4">
                    <p className="text-ink text-[15px] font-black whitespace-nowrap">
                      &mdash; {item.name}
                    </p>
                    <ReplayResult result={item.result} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {variant.closing ? (
          <div className="mt-12 flex justify-center">
            <AnchorButton
              label={variant.closing.label}
              target={variant.closing.target}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
