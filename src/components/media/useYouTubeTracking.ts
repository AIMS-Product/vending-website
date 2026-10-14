"use client";

import { useEffect, useState, type RefObject } from "react";
import { readStoredAttributionSession } from "@/lib/attribution-client";
import { audiblePercentWatched } from "@/lib/tracking/video-engagement";
import { createVideoProgressReporter } from "@/lib/tracking/video-progress-reporter";
import {
  loadYouTubeIframeApi,
  YT_ENDED,
  YT_PLAYING,
  type YouTubePlayer,
} from "@/lib/tracking/youtube-iframe-api";

/** The IFrame API has no timeupdate event; a second is fine for quarters. */
const POLL_MS = 1000;

/**
 * Wraps a YouTube <iframe> in the IFrame API and reports how far it was
 * watched, the same way VideoEngagement does for Vidalytics: one
 * `video_progress` per milestone, counted only while the sound is on, so a
 * muted autoplay is never a view. Returns the player once ready (for
 * "Tap for sound"), or null.
 *
 * Silent by contract: no session, a blocked script or a throwing player all
 * end in no events, never a broken video.
 */
export function useYouTubeTracking(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  videoId: string,
  active: boolean,
): YouTubePlayer | null {
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!active || !iframe) return;
    const session = readStoredAttributionSession();
    const report = session
      ? createVideoProgressReporter(videoId, session)
      : null;
    // Captured once: a client-side route change must not relabel the video.
    const pagePath = window.location.pathname;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const sample = (target: YouTubePlayer, ended: boolean) => {
      if (!report) return;
      try {
        const duration = target.getDuration();
        const muted = target.isMuted();
        if (ended) {
          // A muted autoplay runs to the end on its own.
          if (!muted) report(100, pagePath, duration);
          return;
        }
        const percent = audiblePercentWatched(
          target.getCurrentTime(),
          duration,
          muted,
        );
        if (percent !== null) report(percent, pagePath, duration);
      } catch {
        // A player that throws mid-playback is YouTube's problem, not the
        // visitor's.
      }
    };

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        new YT.Player(iframe, {
          events: {
            onReady: (event) => {
              if (!cancelled) setPlayer(event.target);
            },
            onStateChange: (event) => {
              clearInterval(timer);
              if (cancelled) return;
              if (event.data === YT_PLAYING) {
                sample(event.target, false);
                timer = setInterval(() => sample(event.target, false), POLL_MS);
              } else if (event.data === YT_ENDED) {
                sample(event.target, true);
              }
            },
          },
        });
      })
      .catch((error: unknown) => {
        // Blocked by an extension or offline: the video still plays, uncounted.
        console.warn("YouTube IFrame API unavailable", {
          message: error instanceof Error ? error.message : undefined,
        });
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
      setPlayer(null);
      // No destroy(): it would remove the iframe React owns. The listeners
      // above check `cancelled` and the poll is cleared.
    };
  }, [iframeRef, videoId, active]);

  return player;
}
