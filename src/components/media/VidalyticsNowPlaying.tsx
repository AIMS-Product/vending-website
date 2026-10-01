"use client";

import { useEffect } from "react";
import { claim, subscribe } from "./nowPlaying";

type PausablePlayer = { pause?: () => void };
type VidalyticsWindow = Window & {
  _vidalytics?: { embeds?: Record<string, { player?: PausablePlayer }> };
};

/**
 * Connects one Vidalytics player to the page's "now playing" channel.
 *
 * Claims the channel when the player makes sound (it starts unmuted, or the
 * visitor unmutes it), and pauses it when any other player claims. Media
 * events do not bubble, so they are heard in the capture phase on the
 * container the snippet renders into. Renders nothing.
 *
 * The player is read straight off `window._vidalytics` rather than through
 * getVidalyticsPlayer: that helper installs a one-shot setter, and a second
 * caller would replace VideoEngagement's.
 */
export function VidalyticsNowPlaying({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const onSound = (event: Event) => {
      const video = event.target;
      if (!(video instanceof HTMLMediaElement)) return;
      if (!video.paused && !video.muted) claim(containerId);
    };
    container.addEventListener("play", onSound, true);
    container.addEventListener("volumechange", onSound, true);

    const unsubscribe = subscribe((claimed) => {
      if (claimed === containerId) return;
      const scope = window as VidalyticsWindow;
      try {
        scope._vidalytics?.embeds?.[containerId]?.player?.pause?.();
      } catch (error) {
        // The API is Vidalytics'; fall through to pausing the element itself.
        console.warn("Vidalytics pause failed", error);
      }
      container.querySelectorAll("video").forEach((video) => video.pause());
    });

    return () => {
      container.removeEventListener("play", onSound, true);
      container.removeEventListener("volumechange", onSound, true);
      unsubscribe();
    };
  }, [containerId]);

  return null;
}
