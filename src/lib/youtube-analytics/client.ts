import "server-only";

/**
 * Minimal YouTube Analytics API v2 client, read-only, as the channel owner.
 *
 * Verified against developers.google.com/youtube/analytics (2026-09-11):
 * GET https://youtubeanalytics.googleapis.com/v2/reports with ids=channel==MINE,
 * startDate, endDate, metrics, dimensions, sort, maxResults, startIndex;
 * response is { columnHeaders: [{name}], rows: [[...]] }. The access token
 * comes from exchanging a long-lived refresh token at oauth2.googleapis.com,
 * obtained once with scripts/youtube-oauth-token.mjs.
 *
 * `video` and `day` cannot both be dimensions on a channel report, so a
 * per-video-per-day series is one request per day with dimensions=video.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REPORTS_URL = "https://youtubeanalytics.googleapis.com/v2/reports";
const PAGE_SIZE = 200;
const TOKEN_SKEW_SECONDS = 60;

/** Thumbnail impressions are the "Seen" stage; card clicks are the on-video links. */
const FULL_METRICS = [
  "views",
  "videoThumbnailImpressions",
  "cardImpressions",
  "cardClicks",
] as const;
/** Fallback when the channel's report does not support thumbnail impressions. */
const CORE_METRICS = ["views", "cardImpressions", "cardClicks"] as const;

export type YouTubeVideoDayRow = {
  videoId: string;
  day: string;
  views: number | null;
  impressions: number | null;
  cardImpressions: number | null;
  cardClicks: number | null;
};

export type YouTubeAnalyticsClient = {
  /** Every video with activity on `day`, most viewed first. */
  fetchVideoDay(day: string): Promise<YouTubeVideoDayRow[]>;
};

export class YouTubeAnalyticsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "YouTubeAnalyticsError";
  }
}

type ResultTable = {
  columnHeaders?: Array<{ name: string }>;
  rows?: Array<Array<string | number | null>>;
};

export function createYouTubeAnalyticsClient(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): YouTubeAnalyticsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  let cached: { value: string; expiresAt: number } | null = null;
  let metrics: readonly string[] = FULL_METRICS;

  async function accessToken(): Promise<string> {
    if (cached && cached.expiresAt > now()) return cached.value;
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        refresh_token: options.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new YouTubeAnalyticsError(
        `YouTube token refresh failed (${response.status}): ${text.slice(0, 200)}`,
        response.status,
      );
    }
    const body = JSON.parse(text) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) {
      throw new YouTubeAnalyticsError(
        "YouTube token refresh returned no access_token.",
        500,
      );
    }
    cached = {
      value: body.access_token,
      expiresAt:
        now() + ((body.expires_in ?? 3600) - TOKEN_SKEW_SECONDS) * 1000,
    };
    return cached.value;
  }

  async function query(day: string, startIndex: number): Promise<ResultTable> {
    const token = await accessToken();
    const params = new URLSearchParams({
      ids: "channel==MINE",
      startDate: day,
      endDate: day,
      metrics: metrics.join(","),
      dimensions: "video",
      sort: "-views",
      maxResults: String(PAGE_SIZE),
      startIndex: String(startIndex),
    });
    const response = await fetchImpl(`${REPORTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const text = await response.text();
    if (response.status === 400 && metrics === FULL_METRICS) {
      // ponytail: one retry without thumbnail impressions; impressions stays
      // null for the run rather than failing the whole connector.
      metrics = CORE_METRICS;
      return query(day, startIndex);
    }
    if (!response.ok) {
      throw new YouTubeAnalyticsError(
        `YouTube Analytics ${response.status} for ${day}: ${text.slice(0, 200)}`,
        response.status,
      );
    }
    return JSON.parse(text) as ResultTable;
  }

  return {
    async fetchVideoDay(day) {
      const out: YouTubeVideoDayRow[] = [];
      for (let startIndex = 1; ; startIndex += PAGE_SIZE) {
        const table = await query(day, startIndex);
        const rows = parseRows(table, day);
        out.push(...rows);
        if (rows.length < PAGE_SIZE) return out;
      }
    },
  };
}

/** Column order is whatever the API returns; read by header name. */
export function parseRows(
  table: ResultTable,
  day: string,
): YouTubeVideoDayRow[] {
  const headers = (table.columnHeaders ?? []).map((header) => header.name);
  const index = (name: string) => headers.indexOf(name);
  const read = (
    row: Array<string | number | null>,
    name: string,
  ): number | null => {
    const at = index(name);
    if (at < 0) return null;
    const value = row[at];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : null;
  };
  const videoAt = index("video");
  if (videoAt < 0) return [];
  return (table.rows ?? []).flatMap((row) => {
    const videoId = row[videoAt];
    if (typeof videoId !== "string" || !videoId) return [];
    return [
      {
        videoId,
        day,
        views: read(row, "views"),
        impressions: read(row, "videoThumbnailImpressions"),
        cardImpressions: read(row, "cardImpressions"),
        cardClicks: read(row, "cardClicks"),
      },
    ];
  });
}
