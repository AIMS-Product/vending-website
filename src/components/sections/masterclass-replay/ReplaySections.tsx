import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import Script from "next/script";
import { CalendlyEmbed } from "@/components/embeds/CalendlyEmbed";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { buttonClass } from "@/components/ui/Button";
import {
  REPLAY_ANCHORS,
  REPLAY_GHL_FORM_ID,
  REPLAY_GHL_FORM_SCRIPT,
  REPLAY_GHL_FORM_SRC,
  replayExpiresLabel,
  replayTestimonials,
  replayTestimonialsCopy,
  type ReplayVariant,
  type ReplayVideo,
} from "@/lib/content/masterclass-replay";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { getVideoEmbed } from "@/lib/page-builder/video-embeds";

export function ReplayVideoPlayer({
  video,
  title,
  loadOn = "near",
}: {
  video: ReplayVideo;
  title: string;
  loadOn?: "near" | "click";
}) {
  if (video.kind === "vidalytics") {
    return (
      <VidalyticsPlayer embedId={video.embedId} title={title} loadOn={loadOn} />
    );
  }
  const embed = getVideoEmbed(`https://www.youtube.com/watch?v=${video.id}`);
  if (!embed) return null;
  return (
    <div className="rounded-card border-ink shadow-card overflow-hidden border-2">
      <YouTubeEmbedFrame
        embed={embed}
        title={title}
        className="aspect-video w-full"
      />
    </div>
  );
}

function AnchorButton({
  label,
  subLabel,
  target,
}: {
  label: string;
  subLabel?: string;
  target: "video" | "cta";
}) {
  return (
    <a
      href={`#${REPLAY_ANCHORS[target]}`}
      className={buttonClass({ size: "lg" })}
    >
      <span className="flex flex-col items-center text-center leading-tight">
        <span>{label}</span>
        {subLabel ? (
          <span className="text-xs font-semibold normal-case">{subLabel}</span>
        ) : null}
      </span>
    </a>
  );
}

export function ReplayHero({
  variant,
  expiresAt,
}: {
  variant: ReplayVariant;
  expiresAt: string | null;
}) {
  return (
    <section className="border-ink border-b-2 bg-white">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-6 px-5 py-14 text-center lg:px-10">
        {expiresAt ? (
          <>
            <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
              {replayExpiresLabel}
            </p>
            <Countdown
              startsAt={expiresAt}
              expiredLabel="This replay has ended"
            />
          </>
        ) : null}
        <h1 className="v2-display text-ink text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] uppercase">
          {variant.heading}
        </h1>
        {variant.sub.map((line) => (
          <p key={line} className="max-w-[720px] text-lg text-slate-700">
            {line}
          </p>
        ))}
        {variant.hero ? (
          <AnchorButton
            label={variant.hero.label}
            target={variant.hero.target}
          />
        ) : null}
        <div id={REPLAY_ANCHORS.video} className="w-full scroll-mt-6">
          <ReplayVideoPlayer
            video={variant.mainVideo}
            title="Masterclass replay"
          />
        </div>
        {variant.steps.length ? (
          <ol className="text-ink text-xl leading-snug font-black">
            {variant.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

export function ReplayBooking({
  variant,
  attribution,
}: {
  variant: ReplayVariant;
  attribution: LeadAttribution;
}) {
  const cta = variant.cta;
  if (!cta) return null;
  return (
    <section
      id={REPLAY_ANCHORS.cta}
      className="border-ink bg-tint scroll-mt-6 border-b-2"
    >
      <div className="mx-auto max-w-[760px] px-5 py-14 lg:px-10">
        <h2 className="v2-display text-ink text-center text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] uppercase">
          {cta.heading}
        </h2>
        <div className="mt-5 space-y-3 text-center text-[17px] text-slate-700">
          {cta.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        <div className="mt-8">
          {cta.action.kind === "ghl-form" ? (
            <GhlForm attribution={attribution} />
          ) : (
            <CalendlyEmbed
              url={cta.action.calendlyUrl}
              attribution={attribution}
            />
          )}
        </div>
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

/**
 * GHL's own form, so GHL receives the submission, the score, and runs its
 * redirect exactly as on the GHL page. Deliberately not the site lead form,
 * which would write lead_submissions and sync to Close.
 */
function GhlForm({ attribution }: { attribution: LeadAttribution }) {
  const src = new URL(REPLAY_GHL_FORM_SRC);
  for (const key of FORWARDED) {
    if (attribution[key]) src.searchParams.set(key, attribution[key]);
  }
  return (
    <div className="rounded-card border-ink shadow-card overflow-hidden border-2 bg-white">
      <iframe
        id={`inline-${REPLAY_GHL_FORM_ID}`}
        src={src.toString()}
        title="Lead Scoring -> Book a Call"
        className="block h-[900px] w-full border-0"
        data-form-id={REPLAY_GHL_FORM_ID}
        data-layout="{'id':'INLINE'}"
        data-form-name="Lead Scoring -> Book a Call"
      />
      <Script src={REPLAY_GHL_FORM_SCRIPT} strategy="lazyOnload" />
    </div>
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
        <ul className="mt-10 flex flex-wrap justify-center gap-6">
          {replayTestimonials.map((item, index) => {
            const video = variant.testimonialVideos[index];
            return (
              <li
                key={item.name}
                className="rounded-card border-ink shadow-card flex w-full flex-col overflow-hidden border-2 bg-white md:w-[calc(50%-0.75rem)] lg:w-[calc((100%-3rem)/3)]"
              >
                {video ? (
                  <ReplayVideoPlayer
                    video={video}
                    title={`${item.name}'s story`}
                    loadOn="click"
                  />
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-eyebrow text-xs font-black tracking-[0.12em] uppercase">
                    {item.tag}
                  </p>
                  <blockquote className="mt-3 text-[15px] text-slate-700">
                    &ldquo;{item.quote}&rdquo;
                    <span className="text-ink font-black"> - {item.name}</span>
                  </blockquote>
                  <p className="text-ink mt-auto pt-4 text-sm font-black">
                    {item.result}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {variant.closing ? (
          <div className="mt-12 flex justify-center">
            <AnchorButton
              label={variant.closing.label}
              subLabel={variant.closing.subLabel}
              target={variant.closing.target}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
