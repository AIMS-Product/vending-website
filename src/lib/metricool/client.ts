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
 * map is stored alongside.
 */

const BASE_URL = "https://app.metricool.com/api";
const USER_AGENT =
  "vendingpreneurs-admin/1.0 (+https://www.vendingpreneurs.com)";
const RETRIES = 3;
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Follow `page.next` at most this many times; a month of posts is one page. */
const MAX_PAGES = 20;

export type MetricoolPost = {
  id: string;
  network: string;
  text: string;
  /** The post on the network. */
  permalink: string | null;
  /** ISO timestamp with offset, from publicationDate.dateTime + timezone. */
  publishedAt: string;
  metrics: Record<string, unknown>;
};

export type MetricoolClient = {
  /** Posts published in [from, to], dates as YYYY-MM-DD, interpreted in UTC. */
  fetchPosts(range: { from: string; to: string }): Promise<MetricoolPost[]>;
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

export function createMetricoolClient(options: {
  apiKey: string;
  userId: string;
  blogId: string;
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

  return {
    async fetchPosts({ from, to }) {
      const params = new URLSearchParams({
        userId: options.userId,
        blogId: options.blogId,
        from: `${from}T00:00:00`,
        to: `${to}T23:59:59`,
        timezone: "UTC",
      });
      let url = `${BASE_URL}/v2/analytics/brand-summary/posts?${params.toString()}`;
      const posts: MetricoolPost[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const body = await get<{
          data?: RawPost[];
          page?: { next?: string | null };
        }>(url);
        for (const raw of body.data ?? []) {
          if (!raw.id || !raw.network || !raw.publicationDate?.dateTime)
            continue;
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
    },
  };
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
