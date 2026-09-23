import "server-only";

import {
  apiMessage,
  parseServiceAccount,
  serviceAccountToken,
} from "@/lib/ga4/client";

/**
 * Minimal Google Search Console client on the GA4 service account.
 *
 * Read-only by construction: the only scope requested is
 * `webmasters.readonly`, and the only calls are the sites list and a Search
 * Analytics query. The service account sees a property only after its
 * client_email is added in Search Console (docs/marketing/search-console.md).
 */

const TOKEN_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

/**
 * The API's largest page. One row per day, and the longest window anyone asks
 * for is Search Console's 16 months (~490 rows), so one page always holds it.
 */
const ROW_LIMIT = 25_000;

export type SearchConsoleDayRow = {
  /** `YYYY-MM-DD`, a Pacific-time day (Search Console's own timezone). */
  day: string;
  clicks: number;
  impressions: number;
};

export type SearchConsoleSite = { siteUrl: string; permissionLevel: string };

export type SearchConsoleClient = {
  /** Web-search clicks and impressions per day, final data only. */
  fetchDailyTotals(range: {
    startDate: string;
    endDate: string;
  }): Promise<SearchConsoleDayRow[]>;
  /** Every property this service account has been added to. */
  listSites(): Promise<SearchConsoleSite[]>;
};

export function createSearchConsoleClient({
  serviceAccountJson,
  siteUrl,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  serviceAccountJson: string;
  siteUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): SearchConsoleClient {
  const account = parseServiceAccount(serviceAccountJson);
  if (!account) {
    throw new Error("Service account key is missing or unreadable.");
  }
  const accessToken = serviceAccountToken(account, TOKEN_SCOPE, {
    fetchImpl,
    now,
  });

  const call = async (path: string, body?: unknown): Promise<unknown> => {
    const token = await accessToken();
    const response = await fetchImpl(`${API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? null : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? null : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Search Console request failed with HTTP ${response.status}: ${apiMessage(text)}`,
      );
    }
    return JSON.parse(text);
  };

  return {
    async fetchDailyTotals({ startDate, endDate }) {
      const payload = (await call(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions: ["date"],
          type: "web",
          // Only days Google has finished counting. Fresh ("all") data is
          // restated for days afterwards, and the spine keeps what it stored.
          dataState: "final",
          rowLimit: ROW_LIMIT,
          startRow: 0,
        },
      )) as { rows?: unknown };
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      return rows.flatMap((raw) => {
        const row = raw as {
          keys?: unknown;
          clicks?: unknown;
          impressions?: unknown;
        };
        const day = Array.isArray(row.keys) ? row.keys[0] : null;
        if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day))
          return [];
        return [
          {
            day,
            // Doubles in the API; whole counts in practice and on the spine.
            clicks: Math.round(Number(row.clicks) || 0),
            impressions: Math.round(Number(row.impressions) || 0),
          },
        ];
      });
    },
    async listSites() {
      const payload = (await call("/sites")) as { siteEntry?: unknown };
      const entries = Array.isArray(payload.siteEntry) ? payload.siteEntry : [];
      return entries.map((raw) => {
        const entry = raw as { siteUrl?: unknown; permissionLevel?: unknown };
        return {
          siteUrl: String(entry.siteUrl ?? ""),
          permissionLevel: String(entry.permissionLevel ?? ""),
        };
      });
    },
  };
}
