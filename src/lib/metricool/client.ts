import "server-only";

/**
 * Minimal read-only Metricool client.
 *
 * Checked against Metricool's published OpenAPI file
 * (https://app.metricool.com/api/swagger.json, 2026-09-11): base URL
 * https://app.metricool.com/api, the user token in the `X-Mc-Auth` header,
 * `userId` and `blogId` on every request. The brand summary endpoint returns
 * every post across every connected network for a date range; its `metrics`
 * is an untyped map in the spec, so the reader below is tolerant and the raw
 * map is stored alongside. The typed per-network endpoints add reach and
 * clicks, which the summary never reports.
 */

const BASE_URL = "https://app.metricool.com/api";
const USER_AGENT =
  "vendingpreneurs-admin/1.0 (+https://www.vendingpreneurs.com)";
const RETRIES = 3;
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Follow `page.next` at most this many times; 400 days of posts is one page. */
const MAX_PAGES = 20;

/**
 * Typed per-network endpoints, probed 2026-09-11. The brand summary reports
 * only IMPRESSIONS / INTERACTIONS / ENGAGEMENT; reach and clicks live here.
 * Instagram ids differ between the two shapes (graph id vs media id), so the
 * post URL is the fallback join key. No endpoint exists for YouTube. Stories
 * are skipped: the Instagram one 500s and none carries a link.
 */
const TYPED_ENDPOINTS: Record<string, Array<{ path: string; id: string }>> = {
  instagram: [
    { path: "posts/instagram", id: "postId" },
    { path: "reels/instagram", id: "reelId" },
  ],
  facebook: [
    { path: "posts/facebook", id: "postId" },
    { path: "reels/facebook", id: "reelId" },
  ],
  linkedin: [{ path: "posts/linkedin", id: "postId" }],
  twitter: [{ path: "posts/twitter", id: "tweetId" }],
  tiktok: [{ path: "posts/tiktok", id: "videoId" }],
};

export type MetricoolPost = {
  id: string;
  network: string;
  text: string;
  /** The post on the network. */
  permalink: string | null;
  /** ISO timestamp with offset, from publicationDate.dateTime + timezone. */
  publishedAt: string;
  /** Brand-summary metrics with the typed per-network numbers merged over. */
  metrics: Record<string, unknown>;
};

/** One ad campaign's totals for a date range, either network. */
export type MetricoolCampaign = {
  /** The platform's own campaign id: what a tagged link carries as utm_campaign. */
  id: string;
  name: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
};

export type AdNetwork = "googleads" | "facebookads";

export type MetricoolClient = {
  /**
   * Posts a brand published in [from, to], dates as YYYY-MM-DD, interpreted in
   * UTC, with typed per-network metrics merged in where the network has them.
   */
  fetchPosts(range: {
    blogId: string;
    from: string;
    to: string;
  }): Promise<MetricoolPost[]>;
  /**
   * Campaign totals for [from, to] on one ad network. Metricool aggregates
   * over the range, so a single day is asked for as from = to = that day.
   * A network the brand has not connected answers 403 and yields no rows.
   */
  fetchCampaigns(range: {
    blogId: string;
    network: AdNetwork;
    from: string;
    to: string;
  }): Promise<MetricoolCampaign[]>;
};

export class MetricoolApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MetricoolApiError";
  }
}

type RawPost = {
  id?: string;
  network?: string;
  text?: string;
  link?: string;
  publicationDate?: { dateTime?: string; timezone?: string };
  metrics?: Record<string, unknown>;
};

type TypedRow = Record<string, unknown>;

export function createMetricoolClient(options: {
  apiKey: string;
  userId: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): MetricoolClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function get<T>(url: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          "X-Mc-Auth": options.apiKey,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
      const text = await response.text();
      if (response.ok) return (text ? JSON.parse(text) : {}) as T;
      lastError = new MetricoolApiError(
        `Metricool ${response.status} on ${new URL(url).pathname}: ${text.slice(0, 200)}`,
        response.status,
      );
      if (!TRANSIENT_STATUS.has(response.status)) throw lastError;
      await sleep(500 * 2 ** attempt);
    }
    throw lastError;
  }

  function analyticsUrl(
    path: string,
    range: { blogId: string; from: string; to: string },
  ): string {
    const params = new URLSearchParams({
      userId: options.userId,
      blogId: range.blogId,
      from: `${range.from}T00:00:00`,
      to: `${range.to}T23:59:59`,
      timezone: "UTC",
    });
    return `${BASE_URL}/v2/analytics/${path}?${params.toString()}`;
  }

  async function fetchBrandSummary(range: {
    blogId: string;
    from: string;
    to: string;
  }): Promise<MetricoolPost[]> {
    let url = analyticsUrl("brand-summary/posts", range);
    const posts: MetricoolPost[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await get<{
        data?: RawPost[];
        page?: { next?: string | null };
      }>(url);
      for (const raw of body.data ?? []) {
        if (!raw.id || !raw.network || !raw.publicationDate?.dateTime) continue;
        posts.push({
          id: raw.id,
          network: raw.network.toLowerCase(),
          text: raw.text ?? "",
          permalink: raw.link ?? null,
          publishedAt: toIso(
            raw.publicationDate.dateTime,
            raw.publicationDate.timezone,
          ),
          metrics: raw.metrics ?? {},
        });
      }
      const next = body.page?.next;
      // The spec types `next` as a string and says nothing more. A full URL
      // is followed; anything else ends the walk rather than guessing.
      if (!next || !/^https?:\/\//.test(next)) break;
      url = next;
    }
    return posts;
  }

  /**
   * Typed rows for one network keyed by id and by normalised URL. A network
   * the brand has not connected answers 403; that is not an error here.
   */
  async function fetchTypedMetrics(
    network: string,
    range: { blogId: string; from: string; to: string },
  ): Promise<Map<string, TypedRow>> {
    const byKey = new Map<string, TypedRow>();
    for (const endpoint of TYPED_ENDPOINTS[network] ?? []) {
      let rows: TypedRow[] = [];
      try {
        const body = await get<{ data?: TypedRow[] }>(
          analyticsUrl(endpoint.path, range),
        );
        rows = body.data ?? [];
      } catch (error) {
        if (error instanceof MetricoolApiError && error.status === 403)
          continue;
        console.error("metricool typed endpoint failed", {
          path: endpoint.path,
          status: error instanceof MetricoolApiError ? error.status : null,
        });
        continue;
      }
      for (const row of rows) {
        const id = row[endpoint.id];
        if (id != null) byKey.set(String(id), row);
        const url = urlKey(row.url ?? row.shareUrl ?? row.link);
        if (url) byKey.set(url, row);
      }
    }
    return byKey;
  }

  type RawCampaign = {
    id?: string | number;
    providerId?: string | number;
    name?: string;
    spent?: number | null;
    impressions?: number | null;
    reach?: number | null;
    clicks?: number | null;
  };

  return {
    async fetchCampaigns(range) {
      let body: { data?: RawCampaign[] };
      try {
        body = await get<{ data?: RawCampaign[] }>(
          analyticsUrl(`campaigns/${range.network}`, range),
        );
      } catch (error) {
        if (error instanceof MetricoolApiError && error.status === 403)
          return [];
        throw error;
      }
      return (body.data ?? []).flatMap((raw) => {
        const id = raw.providerId ?? raw.id;
        if (id == null || !raw.name) return [];
        return [
          {
            id: String(id),
            name: raw.name,
            spend: number(raw.spent),
            impressions: number(raw.impressions),
            reach: number(raw.reach),
            clicks: number(raw.clicks),
          },
        ];
      });
    },
    async fetchPosts(range) {
      const posts = await fetchBrandSummary(range);
      const networks = new Set(posts.map((post) => post.network));
      const typed = new Map<string, Map<string, TypedRow>>();
      for (const network of networks) {
        if (TYPED_ENDPOINTS[network])
          typed.set(network, await fetchTypedMetrics(network, range));
      }
      return posts.map((post) => {
        const rows = typed.get(post.network);
        const row =
          rows?.get(post.id) ?? rows?.get(urlKey(post.permalink) ?? "");
        return row
          ? { ...post, metrics: mergeMetrics(post.metrics, row) }
          : post;
      });
    },
  };
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Typed numbers win over the brand summary, whose Facebook values are null. */
function mergeMetrics(
  summary: Record<string, unknown>,
  typed: TypedRow,
): Record<string, unknown> {
  const numbers = Object.fromEntries(
    Object.entries(typed).filter(
      ([key, value]) => typeof value === "number" && key !== "blogId",
    ),
  );
  return { ...summary, ...numbers };
}

/** Scheme, www and trailing slash removed, so both shapes of a post URL meet. */
function urlKey(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  return url
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\?.*$/, "")
    .replace(/\/$/, "");
}

/**
 * Metricool gives a local wall-clock time plus a zone name. Node's Intl can
 * resolve the offset, so the stored timestamp is unambiguous.
 */
export function toIso(dateTime: string, timezone: string | undefined): string {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(dateTime))
    return new Date(dateTime).toISOString();
  const guess = new Date(`${dateTime}Z`);
  if (!timezone || Number.isNaN(guess.getTime())) return guess.toISOString();
  try {
    const offsetMinutes = zoneOffsetMinutes(guess, timezone);
    return new Date(guess.getTime() - offsetMinutes * 60_000).toISOString();
  } catch {
    return guess.toISOString();
  }
}

function zoneOffsetMinutes(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - at.getTime()) / 60_000;
}

/**
 * Reads one metric off Metricool's untyped map: a bare number, or an object
 * with a numeric `value`, under any of the given names. Null when absent.
 */
export function readMetric(
  metrics: Record<string, unknown>,
  names: string[],
): number | null {
  const lower = new Map(
    Object.entries(metrics).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const name of names) {
    const raw = lower.get(name.toLowerCase());
    const value =
      typeof raw === "number"
        ? raw
        : raw &&
            typeof raw === "object" &&
            typeof (raw as { value?: unknown }).value === "number"
          ? (raw as { value: number }).value
          : null;
    if (value != null && Number.isFinite(value))
      return Math.max(0, Math.round(value));
  }
  return null;
}
