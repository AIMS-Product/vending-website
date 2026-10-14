import "server-only";

import {
  createYouTubeReportRequester,
  YouTubeAnalyticsError,
  type ResultTable,
} from "@/lib/youtube-analytics/client";

/**
 * Where a video's views happened, from YouTube Analytics' playback location
 * reports (developers.google.com/youtube/analytics/channel_reports, read
 * 2026-10-14):
 *
 * - type report: dimensions `day,insightPlaybackLocationType`, filter
 *   `video==<id>`. One request covers any date range for one video.
 * - detail report: dimension `insightPlaybackLocationDetail`, filter
 *   `insightPlaybackLocationType==EMBEDDED;video==<id>`, `sort=-views`,
 *   `maxResults` at most 25, no `day`. So it is asked per calendar month.
 *
 * `engagedViews` is YouTube's stricter count (the pre-August-2026 view rule);
 * `views` now counts autoplay from the first frame. Both are kept so a reader
 * can choose, and the stricter one is what a "real" view means here.
 */

export const EMBEDDED = "EMBEDDED";
const FULL_METRICS = ["views", "engagedViews", "estimatedMinutesWatched"];
/** Fallback if the channel's report ever refuses engagedViews. */
const CORE_METRICS = ["views", "estimatedMinutesWatched"];
const MAX_PAGES = "25";

export type PlaybackDayRow = {
  videoId: string;
  day: string;
  locationType: string;
  views: number | null;
  engagedViews: number | null;
  minutesWatched: number | null;
};

export type EmbedPageRow = {
  videoId: string;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  page: string;
  views: number | null;
  engagedViews: number | null;
  minutesWatched: number | null;
};

export type YouTubePlaybackClient = {
  fetchPlaybackDays(
    videoId: string,
    startDate: string,
    endDate: string,
  ): Promise<PlaybackDayRow[]>;
  /** Top 25 embedding pages for one month; `endDate` caps a current month. */
  fetchEmbedPages(
    videoId: string,
    month: string,
    endDate: string,
  ): Promise<EmbedPageRow[]>;
};

export function createYouTubePlaybackClient(
  options: Parameters<typeof createYouTubeReportRequester>[0],
): YouTubePlaybackClient {
  const request = createYouTubeReportRequester(options);
  let metrics = FULL_METRICS;

  async function report(
    query: Record<string, string>,
    what: string,
  ): Promise<ResultTable> {
    try {
      return await request({ ...query, metrics: metrics.join(",") }, what);
    } catch (error) {
      if (
        error instanceof YouTubeAnalyticsError &&
        error.status === 400 &&
        metrics === FULL_METRICS
      ) {
        // ponytail: one retry without engagedViews for the rest of the run;
        // engaged_views stays null rather than failing the connector.
        metrics = CORE_METRICS;
        return report(query, what);
      }
      throw error;
    }
  }

  return {
    async fetchPlaybackDays(videoId, startDate, endDate) {
      const table = await report(
        {
          startDate,
          endDate,
          dimensions: "day,insightPlaybackLocationType",
          filters: `video==${videoId}`,
          sort: "day",
        },
        `${videoId} ${startDate}..${endDate}`,
      );
      return parsePlaybackDays(table, videoId);
    },
    async fetchEmbedPages(videoId, month, endDate) {
      const table = await report(
        {
          startDate: month,
          endDate,
          dimensions: "insightPlaybackLocationDetail",
          filters: `insightPlaybackLocationType==${EMBEDDED};video==${videoId}`,
          sort: "-views",
          maxResults: MAX_PAGES,
        },
        `${videoId} embeds ${month}`,
      );
      return parseEmbedPages(table, videoId, month);
    },
  };
}

type Cell = string | number | null;

function reader(table: ResultTable) {
  const headers = (table.columnHeaders ?? []).map((header) => header.name);
  const at = (name: string) => headers.indexOf(name);
  const text = (row: Cell[], name: string): string | null => {
    const value = at(name) < 0 ? null : row[at(name)];
    return typeof value === "string" && value ? value : null;
  };
  const count = (row: Cell[], name: string): number | null => {
    const value = at(name) < 0 ? null : row[at(name)];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : null;
  };
  const metrics = (row: Cell[]) => ({
    views: count(row, "views"),
    engagedViews: count(row, "engagedViews"),
    minutesWatched: count(row, "estimatedMinutesWatched"),
  });
  return { rows: (table.rows ?? []) as Cell[][], text, metrics };
}

/** Column order is whatever the API returns; read by header name. */
export function parsePlaybackDays(
  table: ResultTable,
  videoId: string,
): PlaybackDayRow[] {
  const { rows, text, metrics } = reader(table);
  return rows.flatMap((row) => {
    const day = text(row, "day");
    const locationType = text(row, "insightPlaybackLocationType");
    if (!day || !locationType) return [];
    return [{ videoId, day, locationType, ...metrics(row) }];
  });
}

export function parseEmbedPages(
  table: ResultTable,
  videoId: string,
  month: string,
): EmbedPageRow[] {
  const { rows, text, metrics } = reader(table);
  return rows.flatMap((row) => {
    const page = text(row, "insightPlaybackLocationDetail");
    if (!page) return [];
    return [{ videoId, month, page, ...metrics(row) }];
  });
}
