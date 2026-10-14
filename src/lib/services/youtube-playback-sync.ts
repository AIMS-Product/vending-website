import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import {
  recordSyncRun,
  type SyncRunOutcome,
} from "@/lib/services/channel-daily";
import { skipped } from "@/lib/services/channel-sync";
import { readAllPages } from "@/lib/services/paged-read";
import { isMissingTable } from "@/lib/seo/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { YouTubeAnalyticsError } from "@/lib/youtube-analytics/client";
import {
  createYouTubePlaybackClient,
  EMBEDDED,
  type PlaybackDayRow,
  type YouTubePlaybackClient,
} from "@/lib/youtube-analytics/playback";
import type { Database } from "@/types/database";

type SyncClient = Pick<SupabaseClient<Database>, "from">;

export const YOUTUBE_PLAYBACK_CONNECTOR = "youtube-playback";

/** YouTube finalises a day two to three days late; re-read a week. */
export const REFRESH_DAYS = 7;
/** A video counts as active (worth re-reading) with views this recently. */
export const ACTIVE_DAYS = 10;
/** Already refreshed this recently: leave it for the next run. */
const FRESH_HOURS = 20;
/** Before the channel existed; used only when a video has no publish date. */
export const FALLBACK_START = "2015-01-01";
/** Days per request: keeps one response well inside any row cap. */
const WINDOW_DAYS = 365;
const WORKERS = 4;
/** Stop starting new videos after this; the route allows 300s. */
const DEFAULT_BUDGET_MS = 240_000;
const UPSERT_CHUNK = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const TABLES_MISSING =
  "table missing; paste section 13 of supabase/migrations/APPLY-IN-SQL-EDITOR.md";

export type YouTubePlaybackSyncResult = {
  endDate: string;
  connector: SyncRunOutcome;
};

export async function syncYouTubePlayback(
  deps: {
    client?: SyncClient;
    /** Explicit null means "not configured"; undefined builds from config. */
    youtube?: YouTubePlaybackClient | null;
    now?: Date;
    budgetMs?: number;
    clock?: () => number;
  } = {},
): Promise<YouTubePlaybackSyncResult> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const youtube =
    deps.youtube === undefined ? playbackFromConfig() : deps.youtube;
  const clock = deps.clock ?? (() => Date.now());
  const deadline = clock() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const endDate = dayKey(addDays(now, -1));

  const connector = await recordSyncRun(
    client,
    YOUTUBE_PLAYBACK_CONNECTOR,
    async () => {
      if (!youtube) {
        return skipped(
          "YouTube OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN). Metricool has no playback locations.",
        );
      }
      const inputs = await readInputs(client, now);
      if (inputs === "missing") return skipped(TABLES_MISSING);

      const queue = videoQueue({ ...inputs, now });
      let written = 0;
      let failed = 0;
      let done = 0;
      let fatal: unknown = null;

      async function worker() {
        while (queue.length > 0 && !fatal && clock() < deadline) {
          const video = queue.shift();
          if (!video) return;
          try {
            written += await syncVideo(client, youtube!, video, endDate, now);
            done += 1;
          } catch (error) {
            // A refused token or a revoked grant fails every video the same
            // way: stop the run rather than log the same failure 600 times.
            if (
              error instanceof YouTubeAnalyticsError &&
              (error.status === 401 || error.status === 403)
            ) {
              fatal = error;
              return;
            }
            failed += 1;
            console.error("youtube playback sync: video failed", {
              videoId: video.videoId,
              name: error instanceof Error ? error.name : "UnknownError",
              message: error instanceof Error ? error.message : undefined,
            });
          }
        }
      }
      await Promise.all(Array.from({ length: WORKERS }, worker));
      if (fatal) throw fatal;

      if (queue.length > 0) {
        // Not an error: the next run resumes from youtube_playback_sync_state.
        console.warn("youtube playback sync: time budget reached", {
          synced: done,
          remaining: queue.length,
        });
      }
      return {
        rowsWritten: written,
        error:
          failed > 0
            ? `${failed} of ${done + failed} videos failed; see the server log.`
            : null,
      };
    },
  );
  return { endDate, connector };
}

export type QueuedVideo = { videoId: string; start: string };

type Inputs = {
  published: Map<string, string | null>;
  active: Set<string>;
  state: Map<string, { syncedThrough: string; syncedAt: string }>;
};

/**
 * Which videos to read this run, and from which day. Never-synced videos come
 * first (newest first), each from its publish date: that is the backfill, and
 * it finishes over as many runs as it needs. Then videos with recent views,
 * least recently refreshed first, from a week before their last synced day.
 * A video with no recent views has nothing new to read.
 */
export function videoQueue({
  published,
  active,
  state,
  now,
}: Inputs & { now: Date }): QueuedVideo[] {
  const ids = new Set([...published.keys(), ...active]);
  const fresh = now.getTime() - FRESH_HOURS * 60 * 60 * 1000;

  const backfill = [...ids]
    .filter((id) => !state.has(id))
    .sort((a, b) =>
      (published.get(b) ?? "").localeCompare(published.get(a) ?? ""),
    )
    .map((videoId) => ({
      videoId,
      start: (published.get(videoId) ?? FALLBACK_START).slice(0, 10),
    }));

  const refresh = [...state.entries()]
    .filter(([id, row]) => active.has(id) && Date.parse(row.syncedAt) < fresh)
    .sort(([, a], [, b]) => a.syncedAt.localeCompare(b.syncedAt))
    .map(([videoId, row]) => ({
      videoId,
      start: dayKey(
        addDays(new Date(`${row.syncedThrough}T00:00:00Z`), -REFRESH_DAYS),
      ),
    }));

  return [...backfill, ...refresh];
}

async function syncVideo(
  client: SyncClient,
  youtube: YouTubePlaybackClient,
  { videoId, start }: QueuedVideo,
  endDate: string,
  now: Date,
): Promise<number> {
  const syncedAt = now.toISOString();
  let written = 0;
  const rows: PlaybackDayRow[] = [];
  for (const [from, to] of dateWindows(start, endDate)) {
    rows.push(...(await youtube.fetchPlaybackDays(videoId, from, to)));
  }
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK) {
    const { error } = await client.from("youtube_video_playback_daily").upsert(
      rows.slice(index, index + UPSERT_CHUNK).map((row) => ({
        video_id: row.videoId,
        day: row.day,
        location_type: row.locationType,
        views: row.views,
        engaged_views: row.engagedViews,
        minutes_watched: row.minutesWatched,
        synced_at: syncedAt,
      })),
      { onConflict: "video_id,day,location_type" },
    );
    if (error)
      throw new Error(
        `youtube_video_playback_daily upsert failed: ${error.message}`,
      );
  }
  written += rows.length;

  for (const month of embeddedMonths(rows)) {
    const pages = await youtube.fetchEmbedPages(
      videoId,
      month,
      monthEnd(month, endDate),
    );
    if (pages.length === 0) continue;
    const { error } = await client.from("youtube_video_embed_pages").upsert(
      pages.map((page) => ({
        video_id: page.videoId,
        month: page.month,
        page: page.page,
        views: page.views,
        engaged_views: page.engagedViews,
        minutes_watched: page.minutesWatched,
        synced_at: syncedAt,
      })),
      { onConflict: "video_id,month,page" },
    );
    if (error)
      throw new Error(
        `youtube_video_embed_pages upsert failed: ${error.message}`,
      );
    written += pages.length;
  }

  // Last, so a video that failed part-way is read again from the same start.
  const { error } = await client
    .from("youtube_playback_sync_state")
    .upsert(
      { video_id: videoId, synced_through: endDate, synced_at: syncedAt },
      { onConflict: "video_id" },
    );
  if (error)
    throw new Error(
      `youtube_playback_sync_state upsert failed: ${error.message}`,
    );
  return written;
}

/** Inclusive [from, to] ranges of at most WINDOW_DAYS covering start..end. */
export function dateWindows(
  start: string,
  end: string,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let from = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (from <= last) {
    const to = new Date(
      Math.min(addDays(from, WINDOW_DAYS - 1).getTime(), last.getTime()),
    );
    out.push([dayKey(from), dayKey(to)]);
    from = addDays(to, 1);
  }
  return out;
}

/** Months (YYYY-MM-01) in which the video had any embedded plays. */
export function embeddedMonths(rows: PlaybackDayRow[]): string[] {
  const months = new Set<string>();
  for (const row of rows) {
    if (row.locationType !== EMBEDDED) continue;
    if ((row.views ?? 0) > 0 || (row.engagedViews ?? 0) > 0)
      months.add(`${row.day.slice(0, 7)}-01`);
  }
  return [...months].sort();
}

/** Last day of `month`, or `cap` when the month is not over yet. */
export function monthEnd(month: string, cap: string): string {
  const start = new Date(`${month}T00:00:00Z`);
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
  const end = dayKey(last);
  return end < cap ? end : cap;
}

async function readInputs(
  client: SyncClient,
  now: Date,
): Promise<Inputs | "missing"> {
  const state = await readAllPages((from, to, count) =>
    client
      .from("youtube_playback_sync_state")
      .select("video_id,synced_through,synced_at", { count })
      .order("video_id")
      .range(from, to),
  );
  if (isMissingTable(state.error)) return "missing";
  if (state.error)
    throw new Error(
      `youtube_playback_sync_state read failed: ${state.error.message}`,
    );

  const videos = await readAllPages((from, to, count) =>
    client
      .from("youtube_videos")
      .select("video_id,published_at", { count })
      .not("video_id", "is", null)
      .order("video_id")
      .range(from, to),
  );
  if (videos.error)
    throw new Error(`youtube_videos read failed: ${videos.error.message}`);

  const recent = await readAllPages((from, to, count) =>
    client
      .from("youtube_video_daily")
      .select("video_id,day", { count })
      .gte("day", dayKey(addDays(now, -ACTIVE_DAYS)))
      .gt("views", 0)
      .order("video_id")
      .order("day")
      .range(from, to),
  );
  if (recent.error)
    throw new Error(`youtube_video_daily read failed: ${recent.error.message}`);

  const published = new Map<string, string | null>();
  for (const row of videos.rows)
    if (row.video_id) published.set(row.video_id, row.published_at ?? null);
  return {
    published,
    active: new Set(recent.rows.map((row) => row.video_id)),
    state: new Map(
      state.rows.map((row) => [
        row.video_id,
        { syncedThrough: row.synced_through, syncedAt: row.synced_at },
      ]),
    ),
  };
}

function playbackFromConfig(): YouTubePlaybackClient | null {
  const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    YOUTUBE_REFRESH_TOKEN,
  } = config;
  if (
    !GOOGLE_OAUTH_CLIENT_ID ||
    !GOOGLE_OAUTH_CLIENT_SECRET ||
    !YOUTUBE_REFRESH_TOKEN
  )
    return null;
  return createYouTubePlaybackClient({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: YOUTUBE_REFRESH_TOKEN,
  });
}

function addDays(date: Date, delta: number): Date {
  return new Date(date.getTime() + delta * DAY_MS);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
