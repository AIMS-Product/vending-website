"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  PlayGlyph,
  type PlayButtonVariant,
  type PlayPosition,
} from "@/components/media/ClickToLoad";
import { claim, subscribe } from "@/components/media/nowPlaying";
import { useYouTubeTracking } from "@/components/media/useYouTubeTracking";
import { cn } from "@/lib/utils";
import type { VideoEmbed } from "@/lib/page-builder/video-embeds";
import { youtubeTrackedEmbedUrl } from "@/lib/tracking/youtube-iframe-api";

type YouTubeEmbedFrameProps = {
  embed: VideoEmbed;
  title: string;
  className?: string;
  thumbnailUrl?: string;
  /**
   * "hero" (default): a large disc in the middle. "card": a small button in
   * a corner, so a member thumbnail's burned-in result text ("$600K/Yr")
   * stays readable. The whole thumbnail is the button either way.
   */
  variant?: PlayButtonVariant;
  /** Corner for the "card" button: bottom-right (default) or top-right. */
  playPosition?: PlayPosition;
  /**
   * Start playing silently once at least half of it is on screen (YouTube
   * allows autoplay only muted), with a "Tap for sound" button that restarts
   * it from 0:00 with sound. Silent playback is never counted as watching.
   * One per page: YouTube allows one autoplaying player.
   */
  autoplayMuted?: boolean;
};

/** "poster": the facade. "sound": pressed play. "muted": silent autoplay. */
type Mode = "poster" | "sound" | "muted";

export function YouTubeEmbedFrame({
  embed,
  title,
  className,
  thumbnailUrl,
  variant = "hero",
  playPosition = "br",
  autoplayMuted = false,
}: YouTubeEmbedFrameProps) {
  const [mode, setMode] = useState<Mode>("poster");
  const [soundOn, setSoundOn] = useState(false);
  const isPlaying = mode !== "poster";
  const playerId = useId();
  const posterRef = useRef<HTMLButtonElement>(null);
  const autoplayed = useRef(false);
  // Muted autoplay starts once half the poster is visible, per YouTube's
  // embedded-player rules, and only once: a visitor who stopped it (another
  // video took over) keeps the poster.
  useEffect(() => {
    const poster = posterRef.current;
    if (!autoplayMuted || autoplayed.current || mode !== "poster" || !poster)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.intersectionRatio >= 0.5)) {
          observer.disconnect();
          autoplayed.current = true;
          setMode("muted");
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(poster);
    return () => observer.disconnect();
  }, [autoplayMuted, mode]);
  // Another player started: drop back to the poster facade, which unloads
  // the iframe and stops its sound. No YouTube JS API needed.
  useEffect(() => {
    if (!isPlaying) return;
    return subscribe((claimed) => {
      if (claimed !== playerId) setMode("poster");
    });
  }, [isPlaying, playerId]);
  const playerRef = useRef<HTMLIFrameElement>(null);
  // "sound" only comes from a press. The button unmounts, so move focus to
  // the player rather than letting it fall back to <body>. A muted autoplay
  // never takes focus: nobody asked for it.
  useEffect(() => {
    if (mode === "sound") playerRef.current?.focus({ preventScroll: true });
  }, [mode]);
  const player = useYouTubeTracking(playerRef, embed.id, isPlaying);
  // Stable while the mode holds: a changed src reloads the iframe, which is
  // only wanted for the muted -> sound fallback.
  const src = useMemo(
    () =>
      mode === "poster"
        ? null
        : youtubeTrackedEmbedUrl(embed.id, {
            autoplay: true,
            mute: mode === "muted",
            origin: window.location.origin,
          }),
    [mode, embed.id],
  );
  const previewThumbnailUrl = thumbnailUrl || embed.thumbnailUrl;
  // Cards keep a light scrim: the corner button needs no contrast help, and a
  // heavy one made the thumbnails read dim next to the white card bodies.
  const scrim =
    variant === "hero"
      ? "rgba(0,0,0,0.08), rgba(0,0,0,0.35)"
      : "rgba(0,0,0,0), rgba(0,0,0,0.15)";
  const thumbnailStyle: CSSProperties = {
    backgroundImage: `linear-gradient(180deg, ${scrim}), url("${previewThumbnailUrl}")`,
  };

  if (isPlaying && src) {
    const frame = (
      <iframe
        ref={playerRef}
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={cn(
          "block bg-black",
          mode === "muted" ? "absolute inset-0 size-full" : className,
        )}
      />
    );
    if (mode !== "muted") return frame;
    return (
      <div className={cn("relative bg-black", className)}>
        {frame}
        {soundOn ? null : (
          <button
            type="button"
            onClick={() => {
              claim(playerId);
              setSoundOn(true);
              if (!player) {
                // The API never loaded: reload the player with sound instead.
                setMode("sound");
                return;
              }
              player.unMute();
              player.seekTo(0, true);
              player.playVideo();
            }}
            className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border-2 border-[#111111] bg-white px-5 py-3 text-sm font-black tracking-[0.08em] whitespace-nowrap text-[#111111] uppercase shadow-[4px_4px_0_#111111] transition hover:-translate-y-[calc(50%+2px)] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/40 focus-visible:outline-none"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5a10 10 0 0 1 0 14" />
            </svg>
            Tap for sound
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      ref={posterRef}
      type="button"
      aria-label={`Play ${title}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        claim(playerId);
        setMode("sound");
      }}
      style={thumbnailStyle}
      className={cn(
        "group relative block overflow-hidden bg-black bg-cover bg-center text-left transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/25 focus-visible:outline-none",
        className,
      )}
    >
      {variant === "card" ? (
        <PlayGlyph variant="card" position={playPosition} />
      ) : (
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
        >
          <span className="ml-1 size-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-[#111111]" />
        </span>
      )}
    </button>
  );
}
