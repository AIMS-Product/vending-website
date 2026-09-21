import "server-only";

import { preCallVideos } from "@/lib/content/pre-call-resources";
import { buildCallCreditReport } from "@/lib/services/call-credit-data";
import { chunk, ID_BATCH } from "@/lib/batch";
import { loadLeadFacts } from "@/lib/services/pre-call-engagement";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who watched what, for the people who actually booked a call.
 *
 * Scoped to booked prospects on purpose (Adam, 2026-09-21): the page is only
 * shown after a booking, so anyone else on it is a stray visit, and mixing them
 * in would move every rate without telling you whose behaviour changed.
 *
 * Two readings of the same rows:
 *  - `people` — one line per booked prospect, for a rep deciding who to chase.
 *  - `videos` — one line per video, for marketing deciding what to recut.
 *
 * "Watched" throughout means FURTHEST POINT REACHED, never cumulative seconds.
 * We keep a high-water mark, so a rewatch is not counted twice. Labels say
 * "reached", not "watched", wherever the distinction could mislead.
 */

export type VideoWatcherRow = {
  bookingId: string;
  name: string;
  email: string | null;
  /** When the call is (or was). */
  startAt: string | null;
  upcoming: boolean;
  canceled: boolean;
  videosStarted: number;
  videosMostlyWatched: number;
  /** Furthest point summed across videos, in seconds. */
  secondsReached: number;
  /** Their deepest video, for the "what do they care about" column. */
  deepest: { label: string; percent: number } | null;
  lastSeenAt: string | null;
};

export type VideoBreakdownRow = {
  embedId: string;
  label: string;
  group: string;
  durationSeconds: number | null;
  /** Booked prospects who started this video. */
  started: number;
  reached25: number;
  reached50: number;
  reached75: number;
  reached100: number;
  /** Mean furthest point, in percent, over those who started it. */
  averagePercent: number | null;
};

export type VideoEngagementReport = {
  /** Booked prospects in the window, engaged or not. */
  bookedCount: number;
  /** Of those, how many opened at least one video. */
  watcherCount: number;
  /** Booked, matched to a session, and watched nothing — the outreach list. */
  coldCount: number;
  /** Booked but with no session id, so we genuinely cannot say. */
  unknownCount: number;
  totalVideos: number;
  people: VideoWatcherRow[];
  videos: VideoBreakdownRow[];
  /** False when the table is missing, so the tab can say so plainly. */
  connected: boolean;
};

type ViewRow = {
  vp_session_id: string;
  embed_id: string;
  max_percent: number;
  duration_seconds: number | null;
  last_seen_at: string;
};

const MOSTLY_WATCHED = 75;

export async function getVideoEngagementReport({
  days = 90,
  now = new Date(),
}: { days?: number; now?: Date } = {}): Promise<VideoEngagementReport> {
  const report = await buildCallCreditReport({ days });
  const leadFacts = await loadLeadFacts(
    report.rows.flatMap((row) =>
      row.leadSubmissionId ? [row.leadSubmissionId] : [],
    ),
  );

  const sessionByBooking = new Map<string, string>();
  for (const row of report.rows) {
    const session = row.leadSubmissionId
      ? leadFacts.get(row.leadSubmissionId)?.sessionId
      : null;
    if (session) sessionByBooking.set(row.id, session);
  }

  const { rows: viewRows, connected } = await loadViewRows([
    ...new Set(sessionByBooking.values()),
  ]);

  const bySession = new Map<string, ViewRow[]>();
  for (const row of viewRows) {
    bySession.set(row.vp_session_id, [
      ...(bySession.get(row.vp_session_id) ?? []),
      row,
    ]);
  }

  const people = report.rows
    .map((row) => {
      const session = sessionByBooking.get(row.id);
      const views = session ? (bySession.get(session) ?? []) : [];
      return buildWatcherRow(row, views, now);
    })
    .filter((row): row is VideoWatcherRow => row !== null)
    .sort(byEngagementThenSoonest);

  return {
    bookedCount: report.rows.length,
    watcherCount: people.filter((p) => p.videosStarted > 0).length,
    coldCount: report.rows.filter(
      (row) =>
        sessionByBooking.has(row.id) &&
        !bySession.has(sessionByBooking.get(row.id) as string),
    ).length,
    unknownCount: report.rows.filter((row) => !sessionByBooking.has(row.id))
      .length,
    totalVideos: preCallVideos.length,
    people,
    videos: buildVideoBreakdown(viewRows),
    connected,
  };
}

function buildWatcherRow(
  row: {
    id: string;
    inviteeName: string | null;
    inviteeEmail: string | null;
    startAt: string | null;
    canceled: boolean;
  },
  views: ViewRow[],
  now: Date,
): VideoWatcherRow | null {
  const startsAt = row.startAt ? Date.parse(row.startAt) : Number.NaN;

  const deepest = views
    .map((view) => ({
      label:
        preCallVideos.find((video) => video.embedId === view.embed_id)?.label ??
        view.embed_id,
      percent: view.max_percent,
    }))
    .sort((a, b) => b.percent - a.percent)[0];

  return {
    bookingId: row.id,
    name: row.inviteeName?.trim() || row.inviteeEmail || "Unknown",
    email: row.inviteeEmail,
    startAt: row.startAt,
    upcoming: Number.isFinite(startsAt) && startsAt >= now.getTime(),
    canceled: row.canceled,
    videosStarted: views.length,
    videosMostlyWatched: views.filter((v) => v.max_percent >= MOSTLY_WATCHED)
      .length,
    // Furthest point, converted to time. Videos whose length we never captured
    // contribute nothing rather than a guessed average — a made-up minute is
    // worse than a short one.
    secondsReached: views.reduce(
      (total, view) =>
        total +
        (view.duration_seconds
          ? (view.duration_seconds * view.max_percent) / 100
          : 0),
      0,
    ),
    deepest: deepest ?? null,
    lastSeenAt:
      views
        .map((v) => v.last_seen_at)
        .sort()
        .at(-1) ?? null,
  };
}

/** Engaged first, then by whose call is soonest — the order a rep works in. */
function byEngagementThenSoonest(a: VideoWatcherRow, b: VideoWatcherRow) {
  if (a.videosStarted !== b.videosStarted) {
    return b.videosStarted - a.videosStarted;
  }
  return Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? "");
}

function buildVideoBreakdown(viewRows: ViewRow[]): VideoBreakdownRow[] {
  const byEmbed = new Map<string, ViewRow[]>();
  for (const row of viewRows) {
    byEmbed.set(row.embed_id, [...(byEmbed.get(row.embed_id) ?? []), row]);
  }

  return preCallVideos
    .map((video) => {
      const views = byEmbed.get(video.embedId) ?? [];
      const at = (floor: number) =>
        views.filter((v) => v.max_percent >= floor).length;

      return {
        embedId: video.embedId,
        label: video.label,
        group: video.group,
        durationSeconds:
          views.find((v) => v.duration_seconds)?.duration_seconds ?? null,
        started: views.length,
        reached25: at(25),
        reached50: at(50),
        reached75: at(75),
        reached100: at(100),
        averagePercent: views.length
          ? Math.round(
              views.reduce((sum, v) => sum + v.max_percent, 0) / views.length,
            )
          : null,
      };
    })
    .sort((a, b) => b.started - a.started);
}

async function loadViewRows(
  sessionIds: string[],
): Promise<{ rows: ViewRow[]; connected: boolean }> {
  if (sessionIds.length === 0) return { rows: [], connected: true };

  try {
    const client = createAdminClient();
    const rows: ViewRow[] = [];

    // Chunked for the same reason as loadLeadFacts: a 90-day window carries
    // thousands of sessions, and one `in` list that long makes a URL the
    // request never returns from. The live Video tab hung on exactly this.
    for (const batch of chunk(sessionIds, ID_BATCH)) {
      const { data, error } = await client
        .from("lead_video_views")
        .select(
          "vp_session_id, embed_id, max_percent, duration_seconds, last_seen_at",
        )
        .in("vp_session_id", batch);

      if (error) return { rows: [], connected: false };
      rows.push(...(data ?? []));
    }

    return { rows, connected: true };
  } catch {
    return { rows: [], connected: false };
  }
}
