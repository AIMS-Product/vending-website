import "server-only";

import {
  preCallVideoByEmbedId,
  preCallVideos,
} from "@/lib/content/pre-call-resources";
import { chunk, ID_BATCH } from "@/lib/batch";
import type { BookingLinks } from "@/lib/services/calendly-booking-sessions";
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
export function summariseEngagement(
  allRows: VideoViewRow[],
): PreCallEngagement {
  if (allRows.length === 0) return EMPTY_ENGAGEMENT;

  // One row per video: the same video seen in two sessions keeps its furthest.
  const deepest = new Map<string, VideoViewRow>();
  for (const row of allRows) {
    const seen = deepest.get(row.embed_id);
    if (!seen || row.max_percent > seen.max_percent) {
      deepest.set(row.embed_id, row);
    }
  }
  const rows = [...deepest.values()];

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
      allRows
        .map((row) => row.last_seen_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Sessions per view request. A session holds one row per video (fifteen
 * today), and PostgREST silently stops at 1,000 rows, so 200 sessions could
 * lose rows without an error. 50 x 15 = 750.
 */
export const VIEW_SESSION_BATCH = 50;

/** PostgREST's silent row ceiling; a batch that reaches it may be cut short. */
export const POSTGREST_MAX_ROWS = 1000;

/**
 * Engagement for a set of sessions, keyed by session id.
 *
 * Sessions with no rows are absent from the map rather than present and empty,
 * so a caller can tell "watched nothing" from "we never had a session id for
 * this booking at all" — they read differently to a rep and only one of them
 * is a reason to pick up the phone.
 *
 * Null when any batch fails or may have been truncated. A partial map would
 * read everyone in the missing batch as "watched nothing" — the call list —
 * so callers must treat null as "cannot tell", never as zero.
 */
export async function loadEngagementBySession(
  sessionIds: string[],
): Promise<Map<string, PreCallEngagement> | null> {
  const unique = [...new Set(sessionIds.filter((id) => id.trim()))];
  if (unique.length === 0) return new Map();

  try {
    const client = createAdminClient();
    const batches = await Promise.all(
      chunk(unique, VIEW_SESSION_BATCH).map((batch) =>
        client
          .from("lead_video_views")
          .select("vp_session_id, embed_id, max_percent, last_seen_at")
          .in("vp_session_id", batch)
          .gte("first_played_at", VIDEO_VIEWS_TRUSTED_FROM),
      ),
    );
    const rows: VideoViewRow[] = [];
    for (const { data, error } of batches) {
      if (error || !data || data.length >= POSTGREST_MAX_ROWS) return null;
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
    return null;
  }
}

/**
 * One person's engagement across every session tied to them: the furthest
 * point reached per video, whichever browser reached it.
 */
export function mergeEngagement(parts: PreCallEngagement[]): PreCallEngagement {
  if (parts.length === 0) return EMPTY_ENGAGEMENT;
  if (parts.length === 1) return parts[0];
  return summariseEngagement(
    parts.flatMap((part) =>
      part.videos.map((video) => ({
        embed_id: video.embedId,
        max_percent: video.percent,
        last_seen_at: part.lastSeenAt ?? "",
      })),
    ),
  );
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
 * The browser sessions behind each booking, by booking id.
 *
 * Up to two, merged by every reader:
 *  1. The lead row's session — the browser that filled a site form.
 *  2. The booking's own link (calendly_booking_sessions) — the browser that
 *     booked in an on-site calendar. The only route for webinar attendees,
 *     who book on /start without ever filling a site form.
 * Someone who fills the form on a laptop and books and watches on a phone has
 * both, and their watching is the union; taking only one would put a watcher
 * on the call list.
 *
 * A link is trusted only when its browser booked for ONE person. A setter or
 * a family member booking several people from one browser would otherwise
 * credit every one of them with whatever that browser watched. Every booking
 * the browser made must be in `rows` under the same email; a booking outside
 * the window cannot be checked, so the link is dropped (reads as unknown,
 * never as watched).
 *
 * Pure so the rules are testable; callers load leadFacts and links.
 */
export function resolveBookingSessions(
  rows: {
    id: string;
    leadSubmissionId: string | null;
    inviteeUri?: string | null;
    inviteeEmail?: string | null;
  }[],
  leadFacts: Map<string, LeadFacts>,
  links: BookingLinks,
): Map<string, string[]> {
  const emailByInvitee = new Map<string, string>();
  for (const row of rows) {
    if (row.inviteeUri) {
      emailByInvitee.set(
        row.inviteeUri,
        row.inviteeEmail?.trim().toLowerCase() ?? "",
      );
    }
  }

  const onePerson = (session: string): boolean => {
    const emails = (links.inviteesBySession.get(session) ?? []).map((uri) =>
      emailByInvitee.get(uri),
    );
    return (
      emails.length > 0 && emails.every((email) => email && email === emails[0])
    );
  };

  const sessionsByBooking = new Map<string, string[]>();
  for (const row of rows) {
    const leadSession = row.leadSubmissionId
      ? leadFacts.get(row.leadSubmissionId)?.sessionId
      : null;
    const linked = row.inviteeUri
      ? links.sessionByInvitee.get(row.inviteeUri)
      : undefined;
    const sessions = [
      ...new Set(
        [leadSession, linked && onePerson(linked) ? linked : null].filter(
          (session): session is string => Boolean(session),
        ),
      ),
    ];
    if (sessions.length > 0) sessionsByBooking.set(row.id, sessions);
  }
  return sessionsByBooking;
}
