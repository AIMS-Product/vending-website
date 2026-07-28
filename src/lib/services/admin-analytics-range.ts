/**
 * Date-range vocabulary shared by the analytics page, its URL, and the server
 * rollups. Client-safe (no server-only imports) so the range switcher can use
 * the same definitions the queries do.
 */

export const ADMIN_ANALYTICS_RANGE_KEYS = ["7d", "30d", "90d", "1y"] as const;

export type AdminAnalyticsRangeKey =
  (typeof ADMIN_ANALYTICS_RANGE_KEYS)[number];

export const ADMIN_ANALYTICS_RANGES: Record<
  AdminAnalyticsRangeKey,
  { label: string; days: number }
> = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "1y": { label: "Last year", days: 365 },
};

export const DEFAULT_ADMIN_ANALYTICS_RANGE: AdminAnalyticsRangeKey = "30d";

export function parseAdminAnalyticsRange(
  value: string | null | undefined,
): AdminAnalyticsRangeKey {
  const trimmed = value?.trim();
  return isAdminAnalyticsRangeKey(trimmed)
    ? trimmed
    : DEFAULT_ADMIN_ANALYTICS_RANGE;
}

function isAdminAnalyticsRangeKey(
  value: string | undefined,
): value is AdminAnalyticsRangeKey {
  return (
    value !== undefined &&
    (ADMIN_ANALYTICS_RANGE_KEYS as readonly string[]).includes(value)
  );
}
