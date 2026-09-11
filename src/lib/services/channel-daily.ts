import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveChannel, resolveDestination } from "@/lib/analytics/channel";
import type { Database, TablesInsert } from "@/types/database";

/**
 * Writers for the channel spine (`channel_daily`, `channel_sync_runs`).
 *
 * Every connector goes through here so the dimension normalisation happens in
 * exactly one place: source and medium are lowercased, blanks become
 * "(not set)", channel comes from resolveChannel and destination from
 * resolveDestination. A connector that keyed a row itself would eventually
 * disagree with the dashboard about what "youtube" is.
 */

export type ChannelDailyClient = Pick<SupabaseClient<Database>, "from">;

/** Value stored when a dimension was not on the link. GA4's own convention. */
export const NOT_SET = "(not set)";

export type ChannelDailyDimensions = {
  day: string;
  source: string | null | undefined;
  medium: string | null | undefined;
  campaign: string | null | undefined;
  content: string | null | undefined;
  /** Raw `utm_term`; resolved to a destination here. */
  term: string | null | undefined;
  /**
   * Explicit channel, for rows whose channel is a program rather than the
   * traffic source (webinar rows carry source meta_ads but channel Webinar).
   * Defaults to the channel resolveChannel assigns the source.
   */
  channel?: string | null;
};

export type ChannelDailyMetrics = Partial<
  Pick<
    TablesInsert<"channel_daily">,
    | "spend"
    | "impressions"
    | "reach"
    | "clicks"
    | "visits"
    | "leads"
    | "booked"
    | "showed"
    | "won"
    | "revenue"
  >
>;

export type ChannelDailyRow = ChannelDailyDimensions & ChannelDailyMetrics;

export const CHANNEL_METRIC_KEYS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "visits",
  "leads",
  "booked",
  "showed",
  "won",
  "revenue",
] as const;

export type ChannelMetricKey = (typeof CHANNEL_METRIC_KEYS)[number];

/** Rows per upsert statement. */
const CHUNK_SIZE = 500;

/**
 * `channel` is derived from source, so it is not part of the key: with it in
 * the key a renamed channel forked every old row (see migration
 * 20260912000000). Each upsert rewrites channel, so a rename reaches old days
 * on the next backfill.
 */
const ON_CONFLICT = "day,source,medium,campaign,content,destination";

function dimension(value: string | null | undefined, lower: boolean): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return NOT_SET;
  return lower ? trimmed.toLowerCase() : trimmed;
}

/** The stored dimension key for one row. Exported so tests and readers agree. */
export function channelDailyKey(dimensions: ChannelDailyDimensions) {
  const source = dimension(dimensions.source, true);
  return {
    day: dimensions.day,
    channel: resolveChannel(dimensions.channel ?? dimensions.source, {
      medium: dimensions.channel ? null : dimensions.medium,
    }).channel,
    source,
    medium: dimension(dimensions.medium, true),
    campaign: dimension(dimensions.campaign, false),
    content: dimension(dimensions.content, false),
    destination: resolveDestination(dimensions.term),
  };
}

export type UpsertResult = { written: number; failed: number };

/**
 * Upserts rows onto the spine, writing only the metric columns the rows carry.
 * PostgREST updates exactly the payload columns on conflict, which is what
 * lets each connector own its metrics. Every row in a batch must carry the
 * same keys, so callers pass one connector's rows at a time.
 *
 * Rows sharing a dimension key are summed before writing: two leads on the same
 * link on the same day are one row with leads = 2, and the last write must not
 * silently win over the first.
 */
export async function upsertChannelDaily(
  client: ChannelDailyClient,
  rows: ChannelDailyRow[],
  { now = new Date(), chunkSize = CHUNK_SIZE } = {},
): Promise<UpsertResult> {
  const merged = mergeByKey(rows);
  if (merged.length === 0) return { written: 0, failed: 0 };

  const syncedAt = now.toISOString();
  const result: UpsertResult = { written: 0, failed: 0 };

  for (let index = 0; index < merged.length; index += chunkSize) {
    const chunk = merged
      .slice(index, index + chunkSize)
      .map((row) => ({ ...row, synced_at: syncedAt }));
    const { error } = await client
      .from("channel_daily")
      .upsert(chunk, { onConflict: ON_CONFLICT });
    if (error) {
      console.error("channel_daily upsert failed", {
        chunkRows: chunk.length,
        firstDay: chunk[0]?.day,
        code: error.code,
        message: error.message,
      });
      result.failed += chunk.length;
      continue;
    }
    result.written += chunk.length;
  }
  return result;
}

type StoredRow = ReturnType<typeof channelDailyKey> & ChannelDailyMetrics;

function mergeByKey(rows: ChannelDailyRow[]): StoredRow[] {
  const byKey = new Map<string, StoredRow>();
  for (const row of rows) {
    const key = channelDailyKey(row);
    const id = Object.values(key).join("|");
    const existing = byKey.get(id);
    const metrics = pickMetrics(row);
    if (!existing) {
      byKey.set(id, { ...key, ...metrics });
      continue;
    }
    byKey.set(id, { ...existing, ...sumMetrics(existing, metrics) });
  }
  return [...byKey.values()];
}

function pickMetrics(row: ChannelDailyRow): ChannelDailyMetrics {
  const out: Record<string, number | null> = {};
  for (const key of CHANNEL_METRIC_KEYS) {
    if (row[key] !== undefined) out[key] = row[key] ?? null;
  }
  return out as ChannelDailyMetrics;
}

/** Null + number = number: an unobserved cell does not poison an observed one. */
function sumMetrics(
  a: ChannelDailyMetrics,
  b: ChannelDailyMetrics,
): ChannelDailyMetrics {
  const out: Record<string, number | null> = {};
  for (const key of CHANNEL_METRIC_KEYS) {
    const left = a[key];
    const right = b[key];
    if (left === undefined && right === undefined) continue;
    if (left == null && right == null) out[key] = null;
    else out[key] = (left ?? 0) + (right ?? 0);
  }
  return out as ChannelDailyMetrics;
}

export type SyncRunOutcome = {
  connector: string;
  rowsWritten: number;
  error: string | null;
};

/**
 * Runs one connector and records the run, success or failure, so the
 * dashboard can show a red row for a connector that has stopped working.
 * A thrown error is recorded and swallowed here: one broken connector must not
 * stop the others in the same cron.
 */
export async function recordSyncRun(
  client: ChannelDailyClient,
  connector: string,
  run: () => Promise<{ rowsWritten: number; error?: string | null }>,
  { now = () => new Date() } = {},
): Promise<SyncRunOutcome> {
  const startedAt = now().toISOString();
  let outcome: SyncRunOutcome;
  try {
    const result = await run();
    outcome = {
      connector,
      rowsWritten: result.rowsWritten,
      error: result.error ?? null,
    };
  } catch (error) {
    console.error(`channel sync connector failed: ${connector}`, {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    outcome = { connector, rowsWritten: 0, error: shortError(error) };
  }

  const { error: insertError } = await client.from("channel_sync_runs").insert({
    connector,
    started_at: startedAt,
    finished_at: now().toISOString(),
    rows_written: outcome.rowsWritten,
    error: outcome.error,
  });
  if (insertError) {
    console.error("channel_sync_runs insert failed", {
      connector,
      code: insertError.code,
      message: insertError.message,
    });
  }
  return outcome;
}

/** Error text for the health table: short, and never a token or a body. */
function shortError(error: unknown): string {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.slice(0, 300);
}
