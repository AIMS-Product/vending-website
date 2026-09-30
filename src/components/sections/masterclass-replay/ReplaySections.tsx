import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import { BookingForm } from "@/components/sections/apply/BookingForm";
import { CalendlyEmbed } from "@/components/embeds/CalendlyEmbed";
import { VidalyticsPlayer } from "@/components/media/VidalyticsPlayer";
import { buttonClass } from "@/components/ui/Button";
import {
  REPLAY_ANCHORS,
  REPLAY_EXPIRES_AT,
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
      <span className="flex flex-col items-center leading-tight">
        <span>{label}</span>
        {subLabel ? (
          <span className="text-xs font-semibold normal-case">{subLabel}</span>
        ) : null}
      </span>
    </a>
  );
}

export function ReplayHero({ variant }: { variant: ReplayVariant }) {
  return (
    <section className="border-ink border-b-2 bg-white">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-6 px-5 py-14 text-center lg:px-10">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {replayExpiresLabel}
        </p>
        <Countdown
          startsAt={REPLAY_EXPIRES_AT}
          expiredLabel="This replay has ended"
        />
        <h1 className="text-ink text-[clamp(1.7rem,3.6vw,2.8rem)] leading-[1.15] font-black uppercase">
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
          <ol className="text-ink text-xl font-black">
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
  idempotencyKey,
}: {
  variant: ReplayVariant;
  attribution: LeadAttribution;
  idempotencyKey: string;
}) {
  const cta = variant.cta;
  if (!cta) return null;
  return (
    <section
      id={REPLAY_ANCHORS.cta}
      className="border-ink bg-tint scroll-mt-6 border-b-2"
    >
      <div className="mx-auto max-w-[760px] px-5 py-14 lg:px-10">
        <h2 className="text-ink text-center text-[clamp(1.6rem,3vw,2.3rem)] leading-[1.15] font-black uppercase">
          {cta.heading}
        </h2>
        <div className="mt-5 space-y-3 text-center text-[17px] text-slate-700">
          {cta.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        <div className="mt-8">
          {cta.action.kind === "form" ? (
            <BookingForm
              attribution={attribution}
              idempotencyKey={idempotencyKey}
              calendlyUrl={cta.action.calendlyUrl}
            />
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

export function ReplayTestimonials({ variant }: { variant: ReplayVariant }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <p className="text-eyebrow text-center text-xs font-black tracking-[0.14em] uppercase">
          {replayTestimonialsCopy.eyebrow}
        </p>
        <h2 className="text-ink mt-3 text-center text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.15] font-black uppercase">
          {replayTestimonialsCopy.heading}
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {replayTestimonials.map((item, index) => {
            const video = variant.testimonialVideos[index];
            return (
              <li
                key={item.name}
                className="rounded-card border-ink shadow-card flex flex-col overflow-hidden border-2 bg-white"
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
