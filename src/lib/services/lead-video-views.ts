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
 * Best-effort by contract: never throws, so a missing table (before the
 * migration is applied) is a no-op rather than a failed request.
 */
export async function recordVideoView({
  vpSessionId,
  embedId,
  percent,
  pagePath,
  occurredAt,
}: {
  vpSessionId: string;
  embedId: string;
  percent: number;
  pagePath?: string | null;
  occurredAt?: Date;
}): Promise<void> {
  const session = vpSessionId.trim();
  const embed = embedId.trim();
  if (!session || !embed) return;
  if (!Number.isFinite(percent) || percent <= 0) return;

  const at = (occurredAt ?? new Date()).toISOString();
  const bounded = Math.min(100, Math.floor(percent));

  try {
    const client = createAdminClient();

    // Postgres has no "upsert taking the larger value" without either an
    // ON CONFLICT ... DO UPDATE expression or a trigger, and PostgREST exposes
    // neither. Read-then-write is the honest version: the race is two beacons
    // from the SAME session arriving together, where both writers are the same
    // person watching the same video, so the loser costs at most one quarter
    // of resolution on a number a rep reads as "most of it".
    // ponytail: move to a DO UPDATE with greatest() in SQL if that quarter
    // ever matters.
    const { data: existing } = await client
      .from("lead_video_views")
      .select("max_percent")
      .eq("vp_session_id", session)
      .eq("embed_id", embed)
      .maybeSingle();

    if (existing && existing.max_percent >= bounded) {
      // Already recorded at least this far; only the recency is news.
      await client
        .from("lead_video_views")
        .update({ last_seen_at: at })
        .eq("vp_session_id", session)
        .eq("embed_id", embed);
      return;
    }

    await client.from("lead_video_views").upsert(
      {
        vp_session_id: session.slice(0, 160),
        embed_id: embed.slice(0, 64),
        max_percent: bounded,
        page_path: pagePath?.trim().slice(0, 300) || null,
        // Only meaningful on insert; the upsert leaves it alone on conflict
        // because the stored value is already the earlier timestamp.
        first_played_at: existing ? undefined : at,
        last_seen_at: at,
      },
      { onConflict: "vp_session_id,embed_id" },
    );
  } catch {
    // Reporting, not the product. A failure here must never reach a visitor.
  }
}
