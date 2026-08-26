import Image from "next/image";
import type { PageMedia, PageStat } from "@/lib/content/content-page";

/**
 * Pieces shared by the server shell (`ContentPage`) and the client-side
 * journey rail (`ContentJourney`). Kept free of `"use client"` and of any
 * server-only import so either side can pull them in without dragging the
 * other's runtime along.
 */

export const CARD =
  "rounded-[12px] border-2 border-[#111111] bg-white shadow-[8px_8px_0_#55b8e8]";
export const EYEBROW =
  "text-xs font-black tracking-[0.14em] text-brand-700 uppercase";
export const SECTION = "px-5 py-20 lg:px-10 lg:py-28";
export const WRAP = "mx-auto max-w-[1500px]";

/**
 * The sticky header is 82px (48px wordmark + 16px padding either side + 2px
 * rule) and the journey rail parks directly under it, so an anchored block has
 * to clear both before its heading is readable. Kept here, beside the rail's
 * own `top-[82px]`, so the two can't drift apart.
 */
export const RAIL_CLEARANCE = "scroll-mt-[13.5rem] lg:scroll-mt-[15rem]";

/**
 * Per-step accent, walked up the existing brand scale so the rail visibly
 * deepens as the reader advances. All three pair with `#111111` ink rather
 * than white text, so the 3.56:1 ceiling on `--brand-600` never applies.
 * See DESIGN.md, "Public site accent rules".
 */
export const STEP_ACCENTS = ["#8bd0ff", "#4fb6ee", "#2a8fcc"] as const;

/** Backdrop wash per active step. Three near-neighbours, so the shift reads
 *  as the page settling rather than as a colour flash. */
export const STEP_WASHES = ["#f5fbff", "#eef8ff", "#e6f3ff"] as const;

export function stepAccent(index: number): string {
  return STEP_ACCENTS[index % STEP_ACCENTS.length];
}

export function stepWash(index: number): string {
  return STEP_WASHES[index % STEP_WASHES.length];
}

/**
 * The figures a block is arguing with, set large. This is what replaced the
 * decorative frame on number-heavy blocks: the numbers are the visual.
 */
export function StatStrip({
  stats,
  accent,
}: {
  stats: ReadonlyArray<PageStat>;
  accent?: string;
}) {
  return (
    <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="reveal-item ease-out-quart rounded-[12px] border-2 border-[#111111] bg-white p-6 transition-shadow duration-500"
          style={{ boxShadow: `6px 6px 0 ${accent ?? "#55b8e8"}` }}
        >
          <dt className="sr-only">{stat.label}</dt>
          <dd>
            <span className="block text-3xl leading-none font-black text-[#111111] tabular-nums">
              {stat.value}
            </span>
            <span className="mt-3 block text-sm leading-6 font-semibold text-slate-600">
              {stat.label}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CheckIcon({ accent }: { accent?: string }) {
  return (
    <span
      aria-hidden
      className="ease-out-quart mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] text-[#111111] transition-colors duration-500"
      style={{ background: accent ?? "#ffffff" }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Product visual. A video if the record has one, else a still, else a bordered
 * frame labelled with the alt text so copy can ship ahead of its visuals.
 *
 * Videos are `preload="none"`: only the poster JPEG is fetched on load, so a
 * page can carry four walkthroughs without paying for them until someone
 * presses play. They loop muted so a click plays in place rather than
 * hijacking the page with sound.
 */
export function Media({
  media,
  className,
  sizes,
  priority = false,
  accent,
}: {
  media: PageMedia;
  className?: string;
  sizes: string;
  priority?: boolean;
  /** Offset-shadow colour. The journey rail passes the active step's accent
   *  so the visual picks up whichever blue the rail is currently on. */
  accent?: string;
}) {
  // The frame takes the asset's own ratio when it has one. Forcing 16:9 on a
  // 1700x1080 screen recording pillarboxes it with black bars; the inline
  // ratio also reserves the right height before the poster loads, so there is
  // no layout shift either.
  const ratio =
    media.width && media.height
      ? { aspectRatio: `${media.width} / ${media.height}` }
      : undefined;
  const frame = `relative w-full overflow-hidden rounded-[12px] border-2 border-[#111111] bg-[#eaf8ff] transition-shadow duration-500 ease-out-quart ${
    ratio ? "" : "aspect-video"
  } ${className ?? ""}`;
  const style = { ...ratio, boxShadow: `8px 8px 0 ${accent ?? "#55b8e8"}` };

  if (media.video) {
    return (
      <div className={frame} style={style}>
        {/* No <track>: these are silent UI screen recordings with no speech,
            and the surrounding copy carries the same content. */}
        <video
          className="h-full w-full object-cover"
          controls
          muted
          loop
          playsInline
          preload="none"
          poster={media.poster}
          aria-label={media.alt}
        >
          <source src={media.video} type="video/mp4" />
        </video>
      </div>
    );
  }

  if (!media.src) {
    return (
      <div
        role="img"
        aria-label={media.alt}
        className={`${frame} flex items-end justify-center`}
        style={style}
      >
        <span className="p-4 text-sm font-semibold text-slate-500">
          {media.alt}
        </span>
      </div>
    );
  }

  return (
    <div className={frame} style={style}>
      <Image
        src={media.src}
        alt={media.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
