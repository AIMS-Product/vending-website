import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { preCallVideoByEmbedId } from "@/lib/content/pre-call-resources";
import { CONFIRMED_VIDEO_EMBED_ID } from "@/lib/content/masterclass";
import {
  REPLAY_MAIN_VIDEO,
  RETIRED_VIDALYTICS_TESTIMONIALS,
} from "@/lib/content/masterclass-replay";
import { readAllPages } from "@/lib/services/paged-read";
import { isMissingTable } from "@/lib/seo/db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VIDEO_VIEWS_TRUSTED_FROM,
  WATCHED_FROM_PERCENT,
} from "@/lib/tracking/video-engagement";
import { EMBEDDED } from "@/lib/youtube-analytics/playback";
import type { Database } from "@/types/database";

/**
 * Every video on the site, from two independent sources, side by side.
 *
 * - Ours (`lead_video_views`): one row per browser per video, written by the
 *   player when the sound is on. "Played" is a press with sound; muted
 *   autoplay never counts. This is the realistic number for our site.
 * - YouTube's (`youtube_video_playback_daily`, the youtube-playback
 *   connector): EMBEDDED views are plays inside an embed on any site (ours,
 *   per the monthly page split); everything else is on YouTube itself.
 *   Engaged views are YouTube's stricter count; plain views now count an
 *   autoplay from the first frame, so engaged is the one shown first.
 *
 * Nothing here is added together: a site play and a YouTube embedded view are
 * the same event seen twice, never two events.
 */

type Client = Pick<SupabaseClient<Database>, "from">;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A YouTube id is 11 characters; Vidalytics embed ids are 16. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const OUR_SITE = /vendingpreneurs\.com/i;

export type Reach = {
  /** Browsers that played it with sound. */
  played: number;
  reached25: number;
  reached50: number;
  reached75: number;
  finished: number;
};

export type SiteVideoPage = Reach & { path: string };

export type YouTubeSplit = {
  embeddedEngaged: number | null;
  embeddedViews: number;
  embeddedMinutes: number;
  onYouTubeEngaged: number | null;
  onYouTubeViews: number;
  onYouTubeMinutes: number;
  /** Our pages among YouTube's monthly top-25 embedding pages, most viewed first. */
  ourEmbedPages: Array<{ page: string; views: number }>;
};

export type SiteVideoRow = {
  videoId: string;
  label: string;
  player: "YouTube" | "Vidalytics";
  site: Reach;
  pages: SiteVideoPage[];
  /** Null for Vidalytics videos, which YouTube knows nothing about. */
  youtube: YouTubeSplit | null;
};

export type SiteVideoReport = {
  since: string;
  /** Our tracking is trustworthy from here (muted autoplay was counted before). */
  trackedFrom: string;
  /** False until the youtube-playback tables exist (APPLY-IN-SQL-EDITOR §13). */
  youtubeConnected: boolean;
  videos: SiteVideoRow[];
};

type ViewRow = {
  vp_session_id: string;
  embed_id: string;
  page_path: string | null;
  max_percent: number;
};

type PlaybackRow = {
  video_id: string;
  location_type: string;
  views: number | null;
  engaged_views: number | null;
  minutes_watched: number | null;
};

export async function getSiteVideoReport({
  days,
  now = new Date(),
  client = createAdminClient(),
}: {
  days: number;
  now?: Date;
  client?: Client;
}): Promise<SiteVideoReport> {
  const sinceMs = Math.max(
    now.getTime() - days * DAY_MS,
    Date.parse(VIDEO_VIEWS_TRUSTED_FROM),
  );
  const since = new Date(sinceMs).toISOString();
  const sinceDay = since.slice(0, 10);

  const views = await readAllPages<ViewRow>((from, to, count) =>
    client
      .from("lead_video_views")
      .select("vp_session_id,embed_id,page_path,max_percent", { count })
      .gte("first_played_at", since)
      .order("vp_session_id")
      .order("embed_id")
      .range(from, to),
  );
  if (views.error)
    throw new Error(`lead_video_views read failed: ${views.error.message}`);

  const embedded = await readAllPages<PlaybackRow>((from, to, count) =>
    client
      .from("youtube_video_playback_daily")
      .select("video_id,location_type,views,engaged_views,minutes_watched", {
        count,
      })
      .eq("location_type", EMBEDDED)
      .gte("day", sinceDay)
      .order("video_id")
      .order("day")
      .range(from, to),
  );
  const youtubeConnected = !isMissingTable(embedded.error);
  if (embedded.error && youtubeConnected)
    throw new Error(
      `youtube_video_playback_daily read failed: ${embedded.error.message}`,
    );

  const viewRows = canonicalViews(views.rows);
  const ids = videoIds(viewRows, embedded.rows);
  const youtubeIds = ids.filter((id) => YOUTUBE_ID.test(id));
  const [elsewhere, embedPages, titles] = await Promise.all([
    youtubeConnected
      ? readOnYouTube(client, youtubeIds, sinceDay)
      : Promise.resolve([]),
    youtubeConnected
      ? readEmbedPages(client, youtubeIds, sinceDay)
      : Promise.resolve([]),
    readTitles(client, youtubeIds),
  ]);

  return {
    since,
    trackedFrom: VIDEO_VIEWS_TRUSTED_FROM,
    youtubeConnected,
    videos: buildSiteVideoRows({
      views: viewRows,
      playback: [...embedded.rows, ...elsewhere],
      embedPages,
      titles,
      youtubeConnected,
    }),
  };
}

/** Pure: shapes the rows the loader read. Exported for tests. */
export function buildSiteVideoRows({
  views,
  playback,
  embedPages,
  titles,
  youtubeConnected,
}: {
  views: ViewRow[];
  playback: PlaybackRow[];
  embedPages: Array<{ video_id: string; page: string; views: number | null }>;
  titles: Map<string, string>;
  youtubeConnected: boolean;
}): SiteVideoRow[] {
  return videoIds(views, playback)
    .map((videoId) => {
      const mine = views.filter((row) => row.embed_id === videoId);
      const byPage = new Map<string, ViewRow[]>();
      for (const row of mine) {
        const path = row.page_path ?? "(unknown page)";
        byPage.set(path, [...(byPage.get(path) ?? []), row]);
      }
      const isYouTube = YOUTUBE_ID.test(videoId);
      return {
        videoId,
        label: labelFor(videoId, titles),
        player: isYouTube ? ("YouTube" as const) : ("Vidalytics" as const),
        site: reach(mine),
        pages: [...byPage.entries()]
          .map(([path, rows]) => ({ path, ...reach(rows) }))
          .sort((a, b) => b.played - a.played),
        youtube:
          isYouTube && youtubeConnected
            ? youtubeSplit(
                playback.filter((row) => row.video_id === videoId),
                embedPages.filter((row) => row.video_id === videoId),
              )
            : null,
      };
    })
    .sort(
      (a, b) =>
        b.site.played - a.site.played ||
        (b.youtube?.embeddedViews ?? 0) - (a.youtube?.embeddedViews ?? 0),
    );
}

function reach(rows: ViewRow[]): Reach {
  const at = (floor: number) =>
    rows.filter((row) => row.max_percent >= floor).length;
  return {
    played: at(1),
    reached25: at(WATCHED_FROM_PERCENT),
    reached50: at(50),
    reached75: at(75),
    finished: at(100),
  };
}

function youtubeSplit(
  rows: PlaybackRow[],
  pages: Array<{ page: string; views: number | null }>,
): YouTubeSplit {
  const sum = (pick: (row: PlaybackRow) => number | null, embedded: boolean) =>
    rows
      .filter((row) => (row.location_type === EMBEDDED) === embedded)
      .reduce((total, row) => total + (pick(row) ?? 0), 0);
  // Engaged views are null when YouTube did not return them; say so rather
  // than print a zero that reads as "nobody really watched".
  const engaged = (embedded: boolean) =>
    rows.some(
      (row) =>
        (row.location_type === EMBEDDED) === embedded &&
        row.engaged_views !== null,
    )
      ? sum((row) => row.engaged_views, embedded)
      : null;

  const ours = new Map<string, number>();
  for (const row of pages) {
    if (!OUR_SITE.test(row.page)) continue;
    ours.set(row.page, (ours.get(row.page) ?? 0) + (row.views ?? 0));
  }
  return {
    embeddedEngaged: engaged(true),
    embeddedViews: sum((row) => row.views, true),
    embeddedMinutes: sum((row) => row.minutes_watched, true),
    onYouTubeEngaged: engaged(false),
    onYouTubeViews: sum((row) => row.views, false),
    onYouTubeMinutes: sum((row) => row.minutes_watched, false),
    ourEmbedPages: [...ours.entries()]
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views),
  };
}

/**
 * A video swapped from Vidalytics to YouTube keeps its earlier plays: rows
 * stored under the retired Vidalytics id are read as the YouTube video, and a
 * browser that played both versions on one page counts once, at its furthest
 * point. Exported for tests.
 */
export function canonicalViews(rows: ViewRow[]): ViewRow[] {
  const merged = new Map<string, ViewRow>();
  for (const row of rows) {
    const embedId = currentVideoId(row.embed_id);
    const key = `${embedId}|${row.page_path ?? ""}|${row.vp_session_id}`;
    const seen = merged.get(key);
    if (!seen || row.max_percent > seen.max_percent)
      merged.set(key, { ...row, embed_id: embedId });
  }
  return [...merged.values()];
}

function currentVideoId(embedId: string): string {
  const story = preCallVideoByEmbedId.get(embedId);
  if (story?.legacyEmbedId === embedId) return story.embedId;
  return RETIRED_VIDALYTICS_TESTIMONIALS[embedId] ?? embedId;
}

/** Videos we saw played, plus videos YouTube saw played in an embed. */
function videoIds(
  views: Array<{ embed_id: string }>,
  playback: Array<{ video_id: string; location_type: string }>,
): string[] {
  return [
    ...new Set([
      ...views.map((row) => row.embed_id),
      ...playback
        .filter((row) => row.location_type === EMBEDDED)
        .map((row) => row.video_id),
    ]),
  ];
}

function labelFor(videoId: string, titles: Map<string, string>): string {
  const title = titles.get(videoId);
  if (title) return title;
  const preCall = preCallVideoByEmbedId.get(videoId);
  if (preCall) return `Pre-call: ${preCall.label}`;
  if (
    REPLAY_MAIN_VIDEO.kind === "vidalytics" &&
    REPLAY_MAIN_VIDEO.embedId === videoId
  )
    return "Masterclass replay";
  if (videoId === CONFIRMED_VIDEO_EMBED_ID)
    return "Masterclass confirmation page video";
  // A Vidalytics video no page plays any more (e.g. the pre-call cost and
  // financing answers pulled 2026-10-02): its plays stay, under its id.
  return `Retired video ${videoId}`;
}

async function readOnYouTube(
  client: Client,
  ids: string[],
  sinceDay: string,
): Promise<PlaybackRow[]> {
  if (ids.length === 0) return [];
  const { rows, error } = await readAllPages<PlaybackRow>((from, to, count) =>
    client
      .from("youtube_video_playback_daily")
      .select("video_id,location_type,views,engaged_views,minutes_watched", {
        count,
      })
      .in("video_id", ids)
      .neq("location_type", EMBEDDED)
      .gte("day", sinceDay)
      .order("video_id")
      .order("day")
      .order("location_type")
      .range(from, to),
  );
  if (error)
    throw new Error(
      `youtube_video_playback_daily read failed: ${error.message}`,
    );
  return rows;
}

async function readEmbedPages(
  client: Client,
  ids: string[],
  sinceDay: string,
): Promise<Array<{ video_id: string; page: string; views: number | null }>> {
  if (ids.length === 0) return [];
  // Monthly rows: include the month the window starts in.
  const sinceMonth = `${sinceDay.slice(0, 7)}-01`;
  const { rows, error } = await readAllPages<{
    video_id: string;
    page: string;
    views: number | null;
  }>((from, to, count) =>
    client
      .from("youtube_video_embed_pages")
      .select("video_id,page,views", { count })
      .in("video_id", ids)
      .gte("month", sinceMonth)
      .order("video_id")
      .order("month")
      .order("page")
      .range(from, to),
  );
  if (error)
    throw new Error(`youtube_video_embed_pages read failed: ${error.message}`);
  return rows;
}

async function readTitles(
  client: Client,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from("youtube_videos")
    .select("video_id,title")
    .in("video_id", ids);
  if (error) throw new Error(`youtube_videos read failed: ${error.message}`);
  return new Map(
    (data ?? []).flatMap((row) =>
      row.video_id && row.title ? [[row.video_id, row.title] as const] : [],
    ),
  );
}
