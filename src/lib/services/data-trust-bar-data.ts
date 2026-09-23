import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTrustBar,
  FEEDS,
  TAB_FEEDS,
  type FeedKey,
  type FeedObservation,
  type TrustBarModel,
  type TrustScope,
} from "@/lib/analytics/data-trust-bar";
import {
  summariseSyncRuns,
  type SyncRun,
} from "@/lib/services/channel-report-rollup";
import { readLatestRun } from "@/lib/services/data-trust";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

/**
 * Two days of an hourly connector plus slack: enough for the latest run, the
 * last clean one, and `summariseSyncRuns`' 48-hour "adds nothing" rule. A feed
 * whose last clean run is older than this reads as having none, which is red
 * either way.
 */
const RUNS_PER_CONNECTOR = 60;

/**
 * Everything one tab's trust bar needs, read in parallel. Every read reports
 * its own failure; a failed read renders red with its reason, never green.
 */
export async function getTrustBar(
  scope: TrustScope,
  deps: { client?: Client; now?: Date } = {},
): Promise<TrustBarModel> {
  const now = deps.now ?? new Date();
  const feeds = TAB_FEEDS[scope];
  try {
    const client = deps.client ?? createAdminClient();
    const [feedObs, audit] = await Promise.all([
      observeFeeds(client, feeds, now),
      readLatestRun(client),
    ]);
    return buildTrustBar({
      scope,
      feeds: feedObs,
      run: audit.run,
      auditError: audit.checksError,
      now,
    });
  } catch (error) {
    // The bar must still render, and render red: an unreadable trust state
    // is not a trustworthy one.
    const message =
      error instanceof Error ? error.message : "The trust read failed.";
    console.error("trust bar read failed", { scope, message });
    return buildTrustBar({
      scope,
      feeds: feeds.map((feed) => ({
        feed,
        lastSuccessAt: null,
        error: message,
      })),
      run: null,
      auditError: message,
      now,
    });
  }
}

async function observeFeeds(
  client: Client,
  feeds: readonly FeedKey[],
  now: Date,
): Promise<FeedObservation[]> {
  const runFeeds = feeds.filter((feed) => FEEDS[feed].source.kind === "run");
  const tableFeeds = feeds.filter(
    (feed) => FEEDS[feed].source.kind === "table",
  );
  const [runObs, tableObs] = await Promise.all([
    runFeeds.length > 0 ? observeRuns(client, runFeeds, now) : [],
    Promise.all(tableFeeds.map((feed) => observeTable(client, feed, now))),
  ]);
  return [...runObs, ...tableObs];
}

async function observeRuns(
  client: Client,
  feeds: readonly FeedKey[],
  now: Date,
): Promise<FeedObservation[]> {
  const connectorOf = (feed: FeedKey) => {
    const source = FEEDS[feed].source;
    return source.kind === "run" ? source.connector : "";
  };
  // One small read per connector on (connector, started_at desc), rather than
  // one wide read that a single chatty connector can crowd the others out of.
  const reads = await Promise.all(
    feeds.map(async (feed) => {
      const { data, error } = await client
        .from("channel_sync_runs")
        .select("connector,started_at,finished_at,rows_written,error")
        .eq("connector", connectorOf(feed))
        .order("started_at", { ascending: false })
        .limit(RUNS_PER_CONNECTOR);
      return { feed, runs: (data ?? []) as SyncRun[], error };
    }),
  );
  const runs = reads.flatMap((read) => read.runs);
  const health = summariseSyncRuns(runs, feeds.map(connectorOf), now);
  return reads.map(({ feed, error }) => {
    if (error) return { feed, lastSuccessAt: null, error: error.message };
    const connector = connectorOf(feed);
    const row = health.find((entry) => entry.connector === connector);
    const lastSuccessAt =
      runs
        .filter((run) => run.connector === connector && !run.error)
        .map((run) => run.finished_at ?? run.started_at)
        .sort()
        .at(-1) ?? null;
    return {
      feed,
      lastSuccessAt,
      status: row?.status,
      note: row?.note ?? null,
    };
  });
}

async function observeTable(
  client: Client,
  feed: FeedKey,
  now: Date,
): Promise<FeedObservation> {
  const source = FEEDS[feed].source;
  if (source.kind !== "table") return { feed, lastSuccessAt: null };
  const { data, error } = await client
    .from(source.table)
    .select(source.column)
    .order(source.column, { ascending: false })
    .limit(1);
  if (error) return { feed, lastSuccessAt: null, error: error.message };
  const row = (data?.[0] ?? null) as unknown as Record<
    string,
    string | null
  > | null;
  const value = row?.[source.column] ?? null;
  if (!value || source.column !== "day") return { feed, lastSuccessAt: value };
  // A date column holds the newest day of data, complete at its end, but never
  // later than now: a part day of today must not read as data from the future.
  const endOfDay = new Date(`${value}T23:59:59.999Z`);
  return {
    feed,
    lastSuccessAt: new Date(
      Math.min(endOfDay.getTime(), now.getTime()),
    ).toISOString(),
  };
}
