import type { SyncHealthStatus } from "@/lib/services/channel-report-rollup";

/** A connector in one of these states is not reporting; the page says so. */
export const BROKEN_FEED_STATUSES: ReadonlySet<SyncHealthStatus> = new Set([
  "failed",
  "stale",
  "never",
  "empty",
]);

type FeedRow = { status: string; finishedAt: string | null };

const SYNC_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * When the stalest healthy feed last finished, in Pacific time: every number
 * from a healthy feed is at least this fresh. The newest would almost always
 * be the hourly Close sync and say nothing about GA4 or Metricool.
 */
export function oldestSync(rows: readonly FeedRow[]): string | null {
  const oldest = rows
    .filter((row) => row.status === "ok" && row.finishedAt)
    .map((row) => row.finishedAt!)
    .sort()
    .at(0);
  return oldest ? `${SYNC_TIME.format(new Date(oldest))} PT` : null;
}

export type FeedFreshness = {
  /** How many feeds are failing, stale, empty or never connected. */
  behind: number;
  total: number;
  /** The stalest healthy feed's finish time, or null when none is healthy. */
  since: string | null;
};

/**
 * What the Overview headline may claim about freshness. Presentation only:
 * the statuses come from syncHealth untouched. The old line said "Every data
 * feed updated since X" even with a feed down, because it only looked at the
 * healthy rows.
 */
export function feedFreshness(rows: readonly FeedRow[]): FeedFreshness {
  return {
    behind: rows.filter((row) =>
      BROKEN_FEED_STATUSES.has(row.status as SyncHealthStatus),
    ).length,
    total: rows.length,
    since: oldestSync(rows),
  };
}
