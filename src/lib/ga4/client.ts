import "server-only";

import { createSign } from "node:crypto";

/**
 * Minimal GA4 Data API client.
 *
 * Signs a service-account JWT with `node:crypto` and exchanges it for an
 * access token, rather than pulling in `googleapis` — the whole auth dance is
 * the thirty lines below and that package is very large for one report call.
 *
 * Read-only by construction: the only scope requested is
 * `analytics.readonly` and the only endpoint called is `runReport`.
 */

const TOKEN_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

/** GA4 caps a single runReport response; page until a short page comes back. */
const DEFAULT_PAGE_SIZE = 10_000;

/** Re-sign a little before the hour is up rather than racing the expiry. */
const TOKEN_SKEW_SECONDS = 60;

export type Ga4ServiceAccount = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

/**
 * One row of the daily aggregate this project stores.
 *
 * Only additive metrics. `bounceRate` is deliberately not fetched: it is a
 * ratio, summing it across rows is meaningless, and `engagedSessions` over
 * `sessions` derives it correctly at read time.
 */
export type Ga4PageViewRow = {
  /** `YYYY-MM-DD`, a day in the property's timezone (America/Los_Angeles). */
  day: string;
  landingPage: string;
  utmCampaign: string;
  utmSource: string;
  screenPageViews: number;
  sessions: number;
  engagedSessions: number;
  newUsers: number;
  keyEvents: number;
  userEngagementSeconds: number;
};

type ReportSpec = {
  dimensions: readonly string[];
  metrics: readonly string[];
};

const PAGE_VIEW_REPORT: ReportSpec = {
  dimensions: ["date", "landingPage", "sessionCampaignName", "sessionSource"],
  metrics: [
    "screenPageViews",
    "sessions",
    "engagedSessions",
    "newUsers",
    "keyEvents",
    "userEngagementDuration",
  ],
};

/**
 * Sessions keyed on the five UTMs of the link standard, for `channel_daily`.
 *
 * `sessionManualAdContent` and `sessionManualTerm` are GA4's names for
 * utm_content and utm_term. Landing page is deliberately absent: the spine is
 * keyed on the link, not the page it landed on.
 */
const CHANNEL_SESSION_REPORT: ReportSpec = {
  dimensions: [
    "date",
    "sessionSource",
    "sessionMedium",
    "sessionCampaignName",
    "sessionManualAdContent",
    "sessionManualTerm",
  ],
  metrics: ["sessions"],
};

/** One day of sessions for one link key. Blank dimensions arrive as "(not set)". */
export type Ga4ChannelSessionRow = {
  day: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  sessions: number;
};

/**
 * Reads a service-account key, returning null for anything unusable rather
 * than throwing — an absent or malformed key means "GA4 not connected", which
 * every caller already degrades on.
 */
export function parseServiceAccount(
  json: string | null | undefined,
): Ga4ServiceAccount | null {
  if (!json?.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const clientEmail = record.client_email;
  const privateKey = record.private_key;
  if (typeof clientEmail !== "string" || typeof privateKey !== "string") {
    return null;
  }
  if (!clientEmail.trim() || !privateKey.trim()) return null;

  return {
    clientEmail: clientEmail.trim(),
    // A key that has been through an env var or a dashboard field arrives with
    // its newlines escaped, and `createSign` rejects it as a malformed PEM.
    privateKey: privateKey.replace(/\\n/g, "\n"),
    tokenUri:
      typeof record.token_uri === "string" && record.token_uri.trim()
        ? record.token_uri.trim()
        : "https://oauth2.googleapis.com/token",
  };
}

function base64Url(value: Buffer | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export type Ga4Client = {
  fetchPageViews(range: {
    startDate: string;
    endDate: string;
  }): Promise<Ga4PageViewRow[]>;
  fetchChannelSessions(range: {
    startDate: string;
    endDate: string;
  }): Promise<Ga4ChannelSessionRow[]>;
};

export function createGa4Client({
  serviceAccountJson,
  propertyId,
  fetchImpl = fetch,
  pageSize = DEFAULT_PAGE_SIZE,
  now = () => Date.now(),
}: {
  serviceAccountJson: string;
  propertyId: string;
  fetchImpl?: typeof fetch;
  pageSize?: number;
  now?: () => number;
}): Ga4Client {
  const account = parseServiceAccount(serviceAccountJson);
  if (!account) {
    throw new Error("GA4 service account key is missing or unreadable.");
  }

  let cachedToken: { value: string; expiresAtMs: number } | null = null;

  const accessToken = async (): Promise<string> => {
    if (cachedToken && cachedToken.expiresAtMs > now())
      return cachedToken.value;

    const issuedAt = Math.floor(now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64Url(
      JSON.stringify({
        iss: account.clientEmail,
        scope: TOKEN_SCOPE,
        aud: account.tokenUri,
        exp: issuedAt + 3600,
        iat: issuedAt,
      }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${base64Url(signer.sign(account.privateKey))}`;

    const response = await fetchImpl(account.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });

    // Deliberately does not include the response body: a failed token
    // exchange echoes back parts of the assertion, and the assertion is signed
    // with the private key.
    if (!response.ok) {
      throw new Error(
        `GA4 token exchange failed with HTTP ${response.status}.`,
      );
    }

    const body = JSON.parse(await response.text()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof body.access_token !== "string" || !body.access_token) {
      throw new Error("GA4 token exchange returned no access token.");
    }

    const lifetime =
      typeof body.expires_in === "number" ? body.expires_in : 3600;
    cachedToken = {
      value: body.access_token,
      expiresAtMs: now() + Math.max(lifetime - TOKEN_SKEW_SECONDS, 0) * 1000,
    };
    return cachedToken.value;
  };

  const runReport = async (
    report: ReportSpec,
    startDate: string,
    endDate: string,
    offset: number,
  ): Promise<unknown> => {
    const token = await accessToken();
    const response = await fetchImpl(
      `${DATA_API_BASE}/properties/${encodeURIComponent(propertyId)}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: report.dimensions.map((name) => ({ name })),
          metrics: report.metrics.map((name) => ({ name })),
          // GA4 promises no row order, and offset paging over an unordered
          // result can repeat one page's rows and skip another's.
          orderBys: report.dimensions.map((dimensionName) => ({
            dimension: { dimensionName },
          })),
          metricAggregations: ["TOTAL"],
          limit: pageSize,
          offset,
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `GA4 runReport failed with HTTP ${response.status}: ${apiMessage(text)}`,
      );
    }
    return JSON.parse(text);
  };

  /**
   * Every page of a report. A read that dropped or repeated rows would be
   * stored as history and read low forever, so the first metric's sum is
   * checked against GA4's own TOTAL and a mismatch is refused.
   */
  const fetchAll = async <T>(
    report: ReportSpec,
    { startDate, endDate }: { startDate: string; endDate: string },
    toRow: (raw: unknown) => T | null,
    firstMetric: (row: T) => number,
    { verifyTotals = true } = {},
  ): Promise<T[]> => {
    const rows: T[] = [];
    let offset = 0;
    let reportedTotal: number | null = null;

    for (;;) {
      const payload = (await runReport(report, startDate, endDate, offset)) as {
        rows?: unknown;
        totals?: unknown;
      };
      reportedTotal ??= totalOfFirstMetric(payload.totals);
      const page = Array.isArray(payload.rows) ? payload.rows : [];
      for (const raw of page) {
        const row = toRow(raw);
        if (row) rows.push(row);
      }
      // A short page is the last page. GA4 returns no cursor, so the row
      // count against the requested limit is the only end signal.
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    if (verifyTotals && reportedTotal !== null) {
      const summed = rows.reduce((sum, row) => sum + firstMetric(row), 0);
      if (summed !== reportedTotal) {
        throw new Error(
          `GA4 rows sum to ${summed} but the report totals ${reportedTotal}; refusing a partial read.`,
        );
      }
    }
    return rows;
  };

  return {
    fetchPageViews: (range) =>
      fetchAll(PAGE_VIEW_REPORT, range, toRow, (row) => row.screenPageViews),
    // Five dimensions put this report over GA4's cardinality threshold, so
    // GA4 folds rows into "(other)" and its TOTAL no longer equals the sum of
    // the rows it returns, in either direction (seen live 2026-09-11: 99843 vs
    // 103432 over 400 days, 18621 vs 18208 over 45). The check would refuse
    // every read, so this report keeps the rows and accepts the fold.
    fetchChannelSessions: (range) =>
      fetchAll(
        CHANNEL_SESSION_REPORT,
        range,
        toChannelSessionRow,
        (row) => row.sessions,
        { verifyTotals: false },
      ),
  };
}

/** The report's own total for its first metric, or null when it sent none. */
function totalOfFirstMetric(totals: unknown): number | null {
  if (!Array.isArray(totals)) return null;
  const value = (totals[0] as { metricValues?: Array<{ value?: unknown }> })
    ?.metricValues?.[0]?.value;
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The API's own error text, without echoing an unbounded response body. */
function apiMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    if (typeof message === "string") return message.slice(0, 300);
  } catch {
    // Fall through to the truncated raw body.
  }
  return text.slice(0, 300);
}

/** Dimension and metric readers shared by every row mapper. */
function cells(raw: unknown): {
  dimension: (index: number) => string;
  metric: (index: number) => number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const { dimensionValues, metricValues } = raw as {
    dimensionValues?: unknown;
    metricValues?: unknown;
  };
  if (!Array.isArray(dimensionValues) || !Array.isArray(metricValues)) {
    return null;
  }
  return {
    dimension: (index: number) => {
      const value = (dimensionValues[index] as { value?: unknown })?.value;
      return typeof value === "string" ? value : "";
    },
    metric: (index: number) => {
      const value = (metricValues[index] as { value?: unknown })?.value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    },
  };
}

function toChannelSessionRow(raw: unknown): Ga4ChannelSessionRow | null {
  const row = cells(raw);
  if (!row) return null;
  const day = isoDay(row.dimension(0));
  if (!day) return null;
  return {
    day,
    source: row.dimension(1),
    medium: row.dimension(2),
    campaign: row.dimension(3),
    content: row.dimension(4),
    term: row.dimension(5),
    sessions: row.metric(0),
  };
}

function toRow(raw: unknown): Ga4PageViewRow | null {
  if (!raw || typeof raw !== "object") return null;
  const { dimensionValues, metricValues } = raw as {
    dimensionValues?: unknown;
    metricValues?: unknown;
  };
  if (!Array.isArray(dimensionValues) || !Array.isArray(metricValues)) {
    return null;
  }

  const dimension = (index: number) => {
    const value = (dimensionValues[index] as { value?: unknown })?.value;
    return typeof value === "string" ? value : "";
  };
  const metric = (index: number) => {
    const value = (metricValues[index] as { value?: unknown })?.value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const day = isoDay(dimension(0));
  if (!day) return null;

  return {
    day,
    landingPage: dimension(1),
    // GA4 writes the literal "(not set)" and "(direct)" rather than null.
    // Kept verbatim so a row is never silently credited to a real campaign.
    utmCampaign: dimension(2),
    utmSource: dimension(3),
    screenPageViews: metric(0),
    sessions: metric(1),
    engagedSessions: metric(2),
    newUsers: metric(3),
    keyEvents: metric(4),
    userEngagementSeconds: metric(5),
  };
}

/** GA4's `date` dimension is `YYYYMMDD` with no separators. */
function isoDay(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
