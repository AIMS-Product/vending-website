"use client";

import { useEffect } from "react";
import {
  emitAttributionEvent,
  readStoredAttributionSession,
} from "@/lib/attribution-client";
import {
  getVidalyticsPlayer,
  vidalyticsContainerId,
} from "@/lib/tracking/vidalytics-player";
import {
  audiblePercentWatched,
  milestonesReached,
} from "@/lib/tracking/video-engagement";

/**
 * Reports how far a visitor got through one Vidalytics video.
 *
 * Mounted beside every player (see VidalyticsPlayer), it attaches to the
 * player's own API and emits `video_progress` at each quarter. That event goes
 * through the existing attribution pipeline, which means it arrives carrying
 * the session's full UTM and paid-click slice for free, lands in PostHog next
 * to the form and calendar events, and is stored against the same
 * `vp_session_id` the lead row already holds — so "watched 6 of 15" is one
 * join away from a name, a booked call and a rep.
 *
 * Silent by contract. No session (cookies blocked, private mode), no player
 * (blocked script, dead embed id) or a thrown listener all end in no events
 * rather than a broken page: nobody's pre-call video should fail to play
 * because we wanted to count it.
 */
export function VideoEngagement({ embedId }: { embedId: string }) {
  useEffect(() => {
    // Read once at mount: the session id is stable for the page's life, and
    // re-reading it inside a listener that fires several times a second would
    // parse JSON out of localStorage for nothing.
    const session = readStoredAttributionSession();
    if (!session) return;

    const reported = new Set<number>();
    let detach: (() => void) | undefined;
    let cancelled = false;

    const report = (
      percent: number,
      pagePath: string,
      durationSeconds: number,
    ) => {
      const crossed = milestonesReached(percent, reported);
      if (crossed.length === 0) return;
      for (const milestone of crossed) reported.add(milestone);

      // One event carrying the furthest milestone, not one per milestone. A
      // scrub crosses several at once and storage keeps only the maximum, so
      // the extra beacons said nothing the first one did not — while racing
      // each other and spending four times the rate-limit budget.
      const milestone = crossed[crossed.length - 1];
      emitAttributionEvent("video_progress", session, {
        embed_id: embedId,
        // Sent as a string because the attribution route's schema and the
        // downstream ingest both take string properties; the service parses
        // it back before storing.
        percent: String(milestone),
        page_path: pagePath,
        // The video's full length, so a percent can be read back as time.
        // Sent per event rather than looked up: only the player knows it,
        // and marketing swaps videos without telling anyone.
        duration_seconds: String(Math.round(durationSeconds)),
      });
    };

    // The container id is the key the player registers under; the embed id is
    // what we store, because that is what names a video to a human.
    void getVidalyticsPlayer(vidalyticsContainerId(embedId)).then((player) => {
      // The page can navigate away while a player is still loading, and this
      // promise never rejects or times out — without the guard a late resolve
      // attaches listeners to a player nobody is watching.
      if (cancelled) return;

      // Captured at attach time rather than per event: a client-side route
      // change would otherwise label a video on the page the visitor left.
      const pagePath = window.location.pathname;

      function onTimeUpdate() {
        try {
          const duration = player.duration();
          const percent = audiblePercentWatched(
            player.currentTime(),
            duration,
            player.muted(),
          );
          if (percent === null) return;
          report(percent, pagePath, duration);
        } catch {
          // A player that throws mid-playback is Vidalytics' problem, not the
          // visitor's.
        }
      }

      function onEnded() {
        try {
          // A muted autoplay runs short videos to the end on its own.
          if (player.muted()) return;
          report(100, pagePath, player.duration());
        } catch {
          // Same contract as above: a throwing player is never our crash.
        }
      }

      player.on("timeupdate", onTimeUpdate);
      player.on("ended", onEnded);
      detach = () => {
        player.off("timeupdate", onTimeUpdate);
        player.off("ended", onEnded);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [embedId]);

  return null;
}
