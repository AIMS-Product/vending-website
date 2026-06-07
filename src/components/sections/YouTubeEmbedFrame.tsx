"use client";

import { useState, type CSSProperties } from "react";
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
};

export function YouTubeEmbedFrame({
  embed,
  title,
  className,
  thumbnailUrl,
}: YouTubeEmbedFrameProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const previewThumbnailUrl = thumbnailUrl || embed.thumbnailUrl;
  const thumbnailStyle: CSSProperties = {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.35)), url("${previewThumbnailUrl}")`,
  };

  if (isPlaying) {
    return (
      <iframe
        src={createVideoEmbedAutoplayUrl(embed)}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-presentation allow-popups"
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
        setIsPlaying(true);
      }}
      style={thumbnailStyle}
      className={cn(
        "relative block overflow-hidden bg-black bg-cover bg-center text-left transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/25 focus-visible:outline-none",
        className,
      )}
    >
      <span className="absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <span className="sr-only">Play video</span>
        <span className="ml-1 size-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-[#111111]" />
      </span>
    </button>
  );
}
