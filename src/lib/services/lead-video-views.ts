import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records how far one session got through one video.
 *
 * Fed by the `video_progress` attribution event, which the player listener
 * emits at each quarter. One row per session per video holding the furthest
 * point reached, so a replay is not a second view and a milestone that arrives
 * out of order (a 429 dropped the 50 but the 75 landed) still lands on the
 * larger number.
 *
 * Unlike `recordTaggedPageView`, this deliberately does NOT require a UTM
 * campaign. That filter is right for landing views, where an untagged visit
 * cannot be attributed to anything; it would be exactly wrong here, because
 * the visits this table exists for happen AFTER a booking, on a page reached
 * by redirect, and never carry a campaign at all.
 *
 * Progress only ever moves up, and the database enforces that rather than the
 * application: two milestones crossed by one scrub arrive as two simultaneous
 * requests, and a read-compare-write loses the higher one. See the
 * record_video_view migration.
 *
 * Best-effort by contract: never throws, so a missing function (before the
 * migration is applied) is a no-op rather than a failed request.
 */
export async function recordVideoView({
  vpSessionId,
  embedId,
  percent,
  pagePath,
  durationSeconds,
  occurredAt,
}: {
  vpSessionId: string;
  embedId: string;
  percent: number;
  pagePath?: string | null;
  /** The video's full length, so a percent can be read back as time. */
  durationSeconds?: number | null;
  occurredAt?: Date;
}): Promise<void> {
  const session = vpSessionId.trim();
  const embed = embedId.trim();
  if (!session || !embed) return;
  if (!Number.isFinite(percent) || percent <= 0) return;

  const at = (occurredAt ?? new Date()).toISOString();
  const bounded = Math.min(100, Math.floor(percent));

  try {
    // One statement, and the database does the comparing: see the
    // record_video_view migration. The read-then-write this replaces lost the
    // higher number whenever two milestones landed together, which on a scrub
    // is every time.
    await createAdminClient().rpc("record_video_view", {
      p_vp_session_id: session.slice(0, 160),
      p_embed_id: embed.slice(0, 64),
      p_percent: bounded,
      p_page_path: pagePath?.trim().slice(0, 300) || null,
      // Capped at eight hours: it comes from a public endpoint, and a
      // nonsense length would poison every average built on it.
      p_duration_seconds:
        durationSeconds &&
        Number.isFinite(durationSeconds) &&
        durationSeconds > 0
          ? Math.min(Math.round(durationSeconds), 28_800)
          : null,
      p_occurred_at: at,
    });
  } catch {
    // Reporting, not the product. A failure here must never reach a visitor.
  }
}
