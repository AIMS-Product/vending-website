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
    Promise.all(tableFeeds.map((feed) => observeTable(client, feed))),
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
  const connectors = feeds.map(connectorOf);
  const { data, error } = await client
    .from("channel_sync_runs")
    .select("connector,started_at,finished_at,rows_written,error")
    .in("connector", connectors)
    .order("started_at", { ascending: false })
    // Two hourly feeds for a week is ~340 runs; this holds the latest of each.
    .limit(1000);
  if (error) {
    return feeds.map((feed) => ({
      feed,
      lastSuccessAt: null,
      error: error.message,
    }));
  }
  const runs = (data ?? []) as SyncRun[];
  const health = summariseSyncRuns(runs, connectors, now);
  return feeds.map((feed) => {
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
  return { feed, lastSuccessAt: row?.[source.column] ?? null };
}
