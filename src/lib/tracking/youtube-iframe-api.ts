/**
 * The YouTube IFrame Player API, loaded once per page on first use.
 *
 * developers.google.com/youtube/iframe_api_reference: the script at
 * https://www.youtube.com/iframe_api defines `window.YT` and then calls
 * `window.onYouTubeIframeAPIReady`. An existing <iframe> can be wrapped with
 * `new YT.Player(iframe, { events })` as long as its src carries
 * `enablejsapi=1` (and `origin`, so the player trusts our postMessages).
 * Typed here by hand: only the calls this site makes.
 */

export type YouTubePlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  isMuted(): boolean;
  unMute(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
};

type PlayerEvent = { target: YouTubePlayer; data: number };

export type YouTubeNamespace = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: PlayerEvent) => void;
      };
    },
  ) => YouTubePlayer;
};

/** YT.PlayerState values (fixed by the API). */
export const YT_ENDED = 0;
export const YT_PLAYING = 1;

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YouTubeNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    // Another script may have set the hook first; keep it working.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Embed URL for a player we listen to. `mute` starts it silent (autoplay is
 * only allowed muted); the page then offers "Tap for sound".
 */
export function youtubeTrackedEmbedUrl(
  videoId: string,
  {
    autoplay,
    mute,
    origin,
  }: { autoplay: boolean; mute: boolean; origin: string },
): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    origin,
    playsinline: "1",
    // Related videos at the end come from our own channel only.
    rel: "0",
  });
  if (autoplay) params.set("autoplay", "1");
  if (mute) params.set("mute", "1");
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}
