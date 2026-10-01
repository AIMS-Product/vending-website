import { Fragment } from "react";
import Script from "next/script";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
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
  REPLAY_BOOKING_EYEBROW,
  replayTestimonialCards,
  replayTestimonials,
  replayTestimonialsCopy,
  type ReplayCtaParagraph,
  type ReplayVariant,
  type ReplayVideo,
  youtubePoster,
} from "@/lib/content/masterclass-replay";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";
import { cn } from "@/lib/utils";
import { GhlFormLoading } from "./GhlFormLoading";
import { ReplayAnchorLink } from "./ReplayAnchorLink";
import { ReplayCountdownStrip } from "./ReplayCountdownStrip";
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
  posterClassName,
  heroWidth = 940,
}: {
  video: ReplayVideo;
  title: string;
  loadOn?: "near" | "click";
  bare?: boolean;
  /** Overrides the video's own poster (the hero's host still). */
  poster?: string;
  /** Extra classes on the Vidalytics root; reaches the poster `img` child. */
  posterClassName?: string;
  /** Desktop CSS width of a framed (hero) player, for the poster's `sizes`. */
  heroWidth?: number;
}) {
  if (video.kind === "vidalytics") {
    return (
      <VidalyticsPlayer
        embedId={video.embedId}
        title={title}
        loadOn={loadOn}
        poster={poster ?? video.poster}
        className={posterClassName}
        framed={!bare}
        playButton={bare ? "card" : "hero"}
        playLabel={`Play ${title}`}
        priority={!bare}
        posterSizes={
          bare
            ? "(min-width: 1024px) 400px, 100vw"
            : `(min-width: 1024px) ${heroWidth}px, 100vw`
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
      thumbnailUrl={youtubePoster(video.id)}
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

/**
 * Where an in-page CTA moves focus after the scroll: the booking heading, or
 * the replay column, where ReplayAnchorLink focuses its play button (the
 * shared player has no id hook for the button itself).
 */
const BOOKING_HEADING_ID = `${REPLAY_ANCHORS.cta}-heading`;
const focusIdFor = (target: "video" | "cta") =>
  target === "cta" ? BOOKING_HEADING_ID : REPLAY_ANCHORS.video;

function AnchorButton({
  label,
  target,
}: {
  label: string;
  target: "video" | "cta";
}) {
  return (
    <ReplayAnchorLink
      href={anchorHref(target)}
      focusId={focusIdFor(target)}
      className={buttonClass({
        size: "lg",
        className:
          "w-full px-4 text-[14px] tracking-[-0.01em] text-balance sm:w-auto sm:px-10 sm:text-base sm:tracking-normal",
      })}
    >
      <span className="text-center leading-tight">{label}</span>
    </ReplayAnchorLink>
  );
}

/**
 * The slim, unlinked brand bar /masterclass opens with. The wordmark PNG is
 * ~47% transparent margin, so height 52 draws a ~28px mark with ~15px of
 * air above and below it. Its column is the 840px framed player's (840 +
 * 2x40 gutter) on every variant, so the mark sits at the same x on all four
 * replays whatever the variant's player width.
 */
function ReplayLogoBar() {
  return (
    <div className="border-ink border-b-2 bg-white">
      <div className="mx-auto flex max-w-[920px] items-center px-5 py-0.5 lg:px-10">
        <Wordmark height={52} eager />
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
  // The framed player (every variant but advisory) is capped at 840px and set
  // closer to the headline, so at 1440x900 it ends above the fold. The column
  // keeps a 24px rhythm; the sub copy under the H1 tucks up to 16px.
  const subCopy = variant.sub.map((line) => (
    <p
      key={line}
      className={cn(
        "max-w-[720px] text-lg text-slate-700",
        !midHeading && !copyAfterVideo && "-mt-2",
      )}
    >
      {line}
    </p>
  ));
  // A page with no steps and no booking (advisory) is the replay and the
  // stories alone: its player takes the testimonial grid's own column
  // (1180 - 2x40 gutter), so the two share their left and right edges.
  const wideVideo = !variant.cta && variant.steps.length === 0;
  const playerWidth = wideVideo ? 1100 : midHeading ? 940 : 840;
  const video = (
    <div
      id={REPLAY_ANCHORS.video}
      className={cn(
        "w-full scroll-mt-6",
        !wideVideo && (midHeading ? "max-w-[940px]" : "max-w-[840px]"),
      )}
    >
      <ReplayVideoPlayer
        video={variant.mainVideo}
        title="Masterclass replay"
        poster={replayHostStill.src}
        // The still is 16:9 like the player, so object-position alone
        // cannot move it: a 2.5% zoom anchored at the bottom lifts the
        // half-cut "1%" line on the wall sign out of frame (the top ~16 of
        // 675 source rows) and leaves the host's face in the right third.
        posterClassName="[&>img]:origin-bottom [&>img]:scale-[1.025]"
        loadOn="click"
        heroWidth={playerWidth}
      />
    </div>
  );
  return (
    <section className="border-ink border-b-2 bg-white">
      <ReplayLogoBar />
      {expiresAt ? <ReplayCountdownStrip expiresAt={expiresAt} /> : null}
      <div
        className={cn(
          "mx-auto flex flex-col items-center px-5 text-center lg:px-10",
          wideVideo ? "pb-5" : "pb-10 md:pb-12",
          midHeading ? "gap-5 pt-7" : "gap-6 pt-9",
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
        {/* As on GHL, the steps sit above the player, so "set up call below"
            is on screen at load (1440x900) rather than under the fold. */}
        {variant.steps.length ? <ReplaySteps variant={variant} /> : null}
        {wideVideo ? null : video}
        {copyAfterVideo ? subCopy : null}
        {variant.hero ? (
          <AnchorButton
            label={variant.hero.label}
            target={variant.hero.target}
          />
        ) : null}
      </div>
      {wideVideo ? (
        <div className="mx-auto max-w-[1180px] px-5 pb-10 md:pb-12 lg:px-10">
          {video}
        </div>
      ) : null}
    </section>
  );
}

function ReplaySteps({ variant }: { variant: ReplayVariant }) {
  const row = "text-ink flex items-center gap-3 text-base font-bold";
  return (
    <ol className="flex w-full flex-col gap-3 text-left sm:w-auto sm:flex-row sm:justify-center sm:gap-6">
      {variant.steps.map((step, index) => {
        const badge = (
          <span
            aria-hidden="true"
            className="rounded-control border-ink grid size-8 shrink-0 place-items-center border-2 bg-white text-sm font-black tabular-nums"
          >
            {index + 1}
          </span>
        );
        return (
          <li key={step.label}>
            {step.target ? (
              <ReplayAnchorLink
                href={anchorHref(step.target)}
                focusId={focusIdFor(step.target)}
                className={cn(
                  row,
                  "group rounded-control focus-visible:ring-sky focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                {badge}
                <span className="decoration-brand-600 underline decoration-2 underline-offset-4 group-hover:decoration-[3px]">
                  {step.label}
                </span>
              </ReplayAnchorLink>
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
        {calendly ? <Eyebrow>{REPLAY_BOOKING_EYEBROW}</Eyebrow> : null}
        <h2
          id={BOOKING_HEADING_ID}
          tabIndex={-1}
          className={cn(
            "v2-display text-ink text-center text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] text-balance uppercase focus:outline-none",
            calendly && "mt-3",
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
          On phones hideDetails drops Calendly's event-details panel (the copy above already says it), so the frame opens on the month; md+ keeps the two-column layout with the event title and prep note. Once Calendly reports its real height the frame takes it. Pre-load minimum on a phone: a five-row month plus time zone ends ~480px into the frame, a six-row one ~530px, hence 520; a six-row month grows it through page_height. Phones keep the ink frame; from md up Calendly's own grey-bordered card sits straight on the tint (as on GHL) instead of inside a second frame. CalendlyEmbed takes no className, so its root is reached as this wrapper's child. */}
      <div
        className={cn(
          "mx-auto px-5 lg:px-10",
          calendly
            ? "max-w-[1100px] pt-6 pb-10 md:pt-0 md:pb-6 md:[&>div]:border-0 md:[&>div]:bg-transparent md:[&>div]:shadow-none"
            : "max-w-[760px] pt-8 pb-14",
        )}
      >
        {cta.action.kind === "ghl-form" ? (
          <GhlForm attribution={attribution} />
        ) : (
          <CalendlyEmbed
            url={cta.action.calendlyUrl}
            attribution={attribution}
            hideDetails="phone"
            heightClassName="h-[520px] md:h-[700px]"
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
      {/* Stalled (GHL blocked), the slot drops its reserved height and the
          blank iframe collapses to 0 under the fallback panel; a late
          form_embed.js inline height overrides the h-0. */}
      <GhlFormLoading
        iframeId={`inline-${REPLAY_GHL_FORM_ID}`}
        fallbackHref={src.toString()}
        slotId={GHL_FORM_SLOT_ID}
        className="relative -mt-2 min-h-[1206px] overflow-hidden data-[stalled]:min-h-0 sm:-mt-10 sm:min-h-[787px] [&[data-stalled]_iframe]:mb-0 [&[data-stalled]_iframe]:h-0 [&[data-stalled]_iframe]:min-h-0"
      >
        <WhenNearViewport
          targetId={GHL_FORM_SLOT_ID}
          margin="0px 0px 200px 0px"
        >
          <iframe
            id={`inline-${REPLAY_GHL_FORM_ID}`}
            src={src.toString()}
            title="Book your free advisory call"
            className="relative z-10 -mb-8 block min-h-[787px] w-full border-0 sm:mb-0"
            data-form-id={REPLAY_GHL_FORM_ID}
            data-layout="{'id':'INLINE'}"
            data-form-name="Lead Scoring -> Book a Call"
          />
          <Script src={REPLAY_GHL_FORM_SCRIPT} strategy="lazyOnload" />
        </WhenNearViewport>
      </GhlFormLoading>
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

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
      {children}
    </p>
  );
}

export function ReplayTestimonials({ variant }: { variant: ReplayVariant }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 pt-12 pb-16 md:pt-16 lg:px-10">
        {/* No eyebrow: "Testimonials" over this heading only repeated it. */}
        <h2 className="v2-display text-ink text-center text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] uppercase">
          {replayTestimonialsCopy.heading}
        </h2>
        {/* Below md a scroll-snap rail (next card peeking); a grid above. */}
        <ul className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 items-start gap-4 overflow-x-auto px-5 pb-4 md:mx-0 md:snap-none md:flex-wrap md:items-stretch md:justify-center md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {replayTestimonialCards(variant).map(({ item, video }) => {
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
                  {/* Name and result sit at the card foot (at least 24px
                      under the quote), so a row's attributions share a
                      baseline; a shorter quote's spare height falls above. */}
                  <div className="mt-auto pt-6">
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
        <p className="text-eyebrow mt-3 text-center text-xs font-black tracking-[0.14em] uppercase md:hidden">
          Swipe for {replayTestimonials.length} stories
        </p>
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
