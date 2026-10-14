import { emitAttributionEvent } from "@/lib/attribution-client";
import type { AttributionSession } from "@/lib/attribution-session";
import { milestonesReached } from "@/lib/tracking/video-engagement";

/**
 * Sends `video_progress` for one video on one page, once per milestone.
 *
 * Shared by every player listener (Vidalytics and YouTube), so a video is
 * counted the same way whichever player shows it. The id sent is whatever
 * names the video to a human reader: a Vidalytics embed id or a YouTube id.
 */
export function createVideoProgressReporter(
  videoId: string,
  session: AttributionSession,
) {
  const reported = new Set<number>();
  return (percent: number, pagePath: string, durationSeconds: number) => {
    const crossed = milestonesReached(percent, reported);
    if (crossed.length === 0) return;
    for (const milestone of crossed) reported.add(milestone);

    // One event carrying the furthest milestone, not one per milestone. A
    // scrub crosses several at once and storage keeps only the maximum, so
    // the extra beacons said nothing the first one did not — while racing
    // each other and spending four times the rate-limit budget.
    const milestone = crossed[crossed.length - 1];
    emitAttributionEvent("video_progress", session, {
      embed_id: videoId,
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
}
