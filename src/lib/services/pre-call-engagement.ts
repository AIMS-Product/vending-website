import "server-only";

import {
  preCallVideoByEmbedId,
  preCallVideos,
} from "@/lib/content/pre-call-resources";
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
    const { data, error } = await createAdminClient()
      .from("lead_video_views")
      .select("vp_session_id, embed_id, max_percent, last_seen_at")
      .in("vp_session_id", unique);

    if (error || !data) return new Map();

    const bySession = new Map<string, VideoViewRow[]>();
    for (const row of data) {
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

  const { data, error } = await createAdminClient()
    .from("lead_submissions")
    .select("id, metadata, close_lead_id")
    .in("id", unique);

  if (error || !data) return new Map();

  return new Map(
    data.map((row) => [
      row.id,
      {
        sessionId: sessionIdFromLeadMetadata(row.metadata),
        closeLeadId: row.close_lead_id,
      },
    ]),
  );
}

/** Session ids only, for callers that do not touch Close. */
export async function loadSessionIdsByLead(
  leadIds: string[],
): Promise<Map<string, string>> {
  const facts = await loadLeadFacts(leadIds);
  return new Map(
    [...facts].flatMap(([leadId, { sessionId }]) =>
      sessionId ? ([[leadId, sessionId]] as [string, string][]) : [],
    ),
  );
}
