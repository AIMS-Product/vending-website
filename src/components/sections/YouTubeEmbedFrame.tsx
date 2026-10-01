"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  PlayGlyph,
  type PlayButtonVariant,
  type PlayPosition,
} from "@/components/media/ClickToLoad";
import { claim, subscribe } from "@/components/media/nowPlaying";
import { cn } from "@/lib/utils";
import {
  createVideoEmbedAutoplayUrl,
  type VideoEmbed,
} from "@/lib/page-builder/video-embeds";

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
};

export function YouTubeEmbedFrame({
  embed,
  title,
  className,
  thumbnailUrl,
  variant = "hero",
  playPosition = "br",
}: YouTubeEmbedFrameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playerId = useId();
  // Another player started: drop back to the poster facade, which unloads
  // the iframe and stops its sound. No YouTube JS API needed.
  useEffect(() => {
    if (!isPlaying) return;
    return subscribe((claimed) => {
      if (claimed !== playerId) setIsPlaying(false);
    });
  }, [isPlaying, playerId]);
  const playerRef = useRef<HTMLIFrameElement>(null);
  // isPlaying only turns true from a press. The button unmounts, so move
  // focus to the player rather than letting it fall back to <body>.
  useEffect(() => {
    if (isPlaying) playerRef.current?.focus({ preventScroll: true });
  }, [isPlaying]);
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

  if (isPlaying) {
    return (
      <iframe
        ref={playerRef}
        src={createVideoEmbedAutoplayUrl(embed)}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={cn("block bg-black", className)}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Play ${title}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        claim(playerId);
        setIsPlaying(true);
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
