"use client";

import { useRef } from "react";
import { useYouTubeTracking } from "@/components/media/useYouTubeTracking";
import { youtubeTrackedEmbedUrl } from "@/lib/tracking/youtube-iframe-api";

/**
 * A YouTube player started by a press (so with sound), counted through the
 * IFrame API. For sections with their own poster facade; YouTubeEmbedFrame
 * is the facade-included version. Client-only by construction: it mounts
 * after a click, so `window` is always there.
 */
export function YouTubeTrackedIframe({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  useYouTubeTracking(frameRef, videoId, true);
  return (
    <iframe
      ref={frameRef}
      // youtube.com, not youtube-nocookie: the privacy-enhanced player keeps
      // the play out of the viewer's YouTube history and ad audiences.
      src={youtubeTrackedEmbedUrl(videoId, {
        autoplay: true,
        mute: false,
        origin: window.location.origin,
      })}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      className={className}
    />
  );
}
