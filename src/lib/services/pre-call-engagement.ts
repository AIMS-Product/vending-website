import "server-only";

import {
  preCallVideoByEmbedId,
  preCallVideos,
} from "@/lib/content/pre-call-resources";
import { chunk, ID_BATCH } from "@/lib/batch";
import { VIDEO_VIEWS_TRUSTED_FROM } from "@/lib/tracking/video-engagement";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * What a prospect watched before their call, in the shape a rep reads.
 *
 * The join is the first-party session id: the lead row stores it under
 * `metadata.attribution_session.vp_session_id`, and so does every video event,
 * because both come from the same browser. That is the whole mechanism — no
 * new identifier, no link parameter, nothing for sales to remember to send.
 *
 * Its one limit, stated plainly because a rep will otherwise read a blank as
 * disinterest: the match is per browser. Someone who books on their phone and
 * watches on a laptop has no row. The redirect path is same-browser by
 * construction, so most bookers land, but "watched nothing" and "watched
 * somewhere we could not see" are the same value here.
 */

export type WatchedVideo = {
  embedId: string;
  /** The question or member name, never the embed id — see preCallVideos. */
  label: string;
  percent: number;
};

export type PreCallEngagement = {
  /** Videos with any recorded progress. */
  watchedCount: number;
  /** Videos on the page today, so the count has a denominator. */
  totalVideos: number;
  /** Videos reached 75% or more — "actually watched", not "opened". */
  finishedCount: number;
  /** Furthest-first, so the top of the list is what they cared about most. */
  videos: WatchedVideo[];
  lastSeenAt: string | null;
};

export const EMPTY_ENGAGEMENT: PreCallEngagement = {
  watchedCount: 0,
  totalVideos: preCallVideos.length,
  finishedCount: 0,
  videos: [],
  lastSeenAt: null,
};

/** A video counts as finished at three quarters; the last quarter is outro. */
const FINISHED_PERCENT = 75;

type VideoViewRow = {
  embed_id: string;
  max_percent: number;
  last_seen_at: string;
};

/**
 * Turns one session's rows into the rep-facing summary.
 *
 * Pure so the shaping is testable without a database. Rows for embed ids that
 * are no longer on the page (marketing swapped a story out) are kept and
 * labelled by their id — dropping them would quietly shrink a prospect's
 * engagement because we changed the page after they watched it.
 */
export function summariseEngagement(rows: VideoViewRow[]): PreCallEngagement {
  if (rows.length === 0) return EMPTY_ENGAGEMENT;

  const videos = rows
    .map((row) => ({
      embedId: row.embed_id,
      label: preCallVideoByEmbedId.get(row.embed_id)?.label ?? row.embed_id,
      percent: row.max_percent,
    }))
    .sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label));

  return {
    watchedCount: videos.length,
    totalVideos: preCallVideos.length,
    finishedCount: videos.filter((v) => v.percent >= FINISHED_PERCENT).length,
    videos,
    lastSeenAt:
      rows
        .map((row) => row.last_seen_at)
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Engagement for a set of sessions, keyed by session id.
 *
 * Sessions with no rows are absent from the map rather than present and empty,
 * so a caller can tell "watched nothing" from "we never had a session id for
 * this booking at all" — they read differently to a rep and only one of them
 * is a reason to pick up the phone.
 */
export async function loadEngagementBySession(
  sessionIds: string[],
): Promise<Map<string, PreCallEngagement>> {
  const unique = [...new Set(sessionIds.filter((id) => id.trim()))];
  if (unique.length === 0) return new Map();

  try {
    const client = createAdminClient();
    const batches = await Promise.all(
      chunk(unique, ID_BATCH).map((batch) =>
        client
          .from("lead_video_views")
          .select("vp_session_id, embed_id, max_percent, last_seen_at")
          .in("vp_session_id", batch)
          .gte("first_played_at", VIDEO_VIEWS_TRUSTED_FROM),
      ),
    );
    const rows: VideoViewRow[] = [];
    for (const { data, error } of batches) {
      if (error || !data) continue;
      rows.push(...(data as (VideoViewRow & { vp_session_id: string })[]));
    }

    const bySession = new Map<string, VideoViewRow[]>();
    for (const row of rows as (VideoViewRow & { vp_session_id: string })[]) {
      const rows = bySession.get(row.vp_session_id) ?? [];
      rows.push(row);
      bySession.set(row.vp_session_id, rows);
    }

    return new Map(
      [...bySession].map(([session, rows]) => [
        session,
        summariseEngagement(rows),
      ]),
    );
  } catch {
    // The table may not exist yet (migration is hand-applied). A booking list
    // that renders without an engagement column beats one that 500s.
    return new Map();
  }
}

/**
 * The session id a lead was captured under, or null.
 *
 * Reaches into `metadata` because that is where the lead pipeline puts it;
 * kept in one function so the path is written down once and every reader is
 * equally defensive about a column that is free-form JSON.
 */
export function sessionIdFromLeadMetadata(
  metadata: Json | null,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const session = (metadata as Record<string, Json>).attribution_session;
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return null;
  }
  const id = (session as Record<string, Json>).vp_session_id;
  return typeof id === "string" && id.trim() ? id : null;
}

/**
 * The two things a lead row is needed for here: the session that identifies
 * its videos, and the Close lead the note goes on. One query because both
 * readers want both — the admin table needs the session, the pre-call note
 * needs the session AND somewhere to write.
 */
export type LeadFacts = {
  sessionId: string | null;
  closeLeadId: string | null;
};

export async function loadLeadFacts(
  leadIds: string[],
): Promise<Map<string, LeadFacts>> {
  const unique = [...new Set(leadIds.filter((id) => id.trim()))];
  if (unique.length === 0) return new Map();

  const client = createAdminClient();
  const facts = new Map<string, LeadFacts>();

  // Chunked because PostgREST puts `in` lists in the query string: a 90-day
  // window is thousands of bookings, and one request carrying every id builds
  // a URL long enough that the request never comes back. Measured on the live
  // Video tab, where the 90-day range hung on exactly this.
  // In parallel, not in series. A 90-day window is ~20 batches, and awaiting
  // them one at a time turned a correct page into one that never finished
  // loading — the fix for the URL-length hang reintroduced the hang as latency.
  const batches = await Promise.all(
    chunk(unique, ID_BATCH).map((batch) =>
      client
        .from("lead_submissions")
        .select("id, metadata, close_lead_id")
        .in("id", batch),
    ),
  );

  for (const { data, error } of batches) {
    if (error || !data) continue;
    for (const row of data) {
      facts.set(row.id, {
        sessionId: sessionIdFromLeadMetadata(row.metadata),
        closeLeadId: row.close_lead_id,
      });
    }
  }

  return facts;
}

/**
 * The browser session behind each booking, by booking id.
 *
 * Two routes, in this order:
 *  1. The lead row's session — the browser that filled a site form. Checked
 *     first so everyone matched before the booking link existed keeps exactly
 *     the session they had.
 *  2. The booking's own link (calendly_booking_sessions) — the browser that
 *     booked in an on-site calendar. This is the only route for webinar
 *     attendees, who book on /start without ever filling a site form.
 *
 * Pure so the precedence is testable; callers load both maps.
 */
export function resolveBookingSessions(
  rows: {
    id: string;
    leadSubmissionId: string | null;
    inviteeUri?: string | null;
  }[],
  leadFacts: Map<string, LeadFacts>,
  sessionByInvitee: Map<string, string>,
): Map<string, string> {
  const sessionByBooking = new Map<string, string>();
  for (const row of rows) {
    const session =
      (row.leadSubmissionId
        ? leadFacts.get(row.leadSubmissionId)?.sessionId
        : null) ??
      (row.inviteeUri ? sessionByInvitee.get(row.inviteeUri) : null);
    if (session) sessionByBooking.set(row.id, session);
  }
  return sessionByBooking;
}
