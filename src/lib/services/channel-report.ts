import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  buildChannelReport,
  summariseSyncRuns,
  type ChannelFact,
  type ChannelGroupBy,
  type ChannelReport,
  type SyncHealthRow,
  type SyncRun,
} from "@/lib/services/channel-report-rollup";
import { CHANNEL_CONNECTORS } from "@/lib/services/channel-sync";

type ReportClient = Pick<SupabaseClient<Database>, "from">;

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
/** A year of every key is well under this; the cap keeps a runaway read bounded. */
const MAX_FACT_ROWS = 200_000;

/** Every connector the health table should list, even before its first run. */
export const EXPECTED_CONNECTORS: readonly string[] = [
  CHANNEL_CONNECTORS.ga4,
  CHANNEL_CONNECTORS.bitly,
  CHANNEL_CONNECTORS.leads,
  "webinar-ingest",
];

export type ChannelsTabData = {
  range: {
    key: AdminAnalyticsRangeKey;
    label: string;
    days: number;
    startDay: string;
    endDay: string;
  };
  /** Set when the page is drilled into one channel. */
  channel: string | null;
  report: ChannelReport;
  /** Drill-in tables, only when `channel` is set. */
  drill: {
    byCampaign: ChannelReport;
    byContent: ChannelReport;
    byDestination: ChannelReport;
  } | null;
  syncHealth: SyncHealthRow[];
  /** False when the spine tables do not exist yet (migration not applied). */
  connected: boolean;
};

export async function getChannelsTab(
  input: {
    range?: AdminAnalyticsRangeKey;
    channel?: string | null;
    client?: ReportClient;
    now?: Date;
  } = {},
): Promise<ChannelsTabData> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const rangeKey = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const { label, days } = ADMIN_ANALYTICS_RANGES[rangeKey];
  const channel = input.channel?.trim() || null;

  const endDay = dayKey(now);
  const startDay = dayKey(new Date(now.getTime() - (days - 1) * DAY_MS));
  const priorStartDay = dayKey(
    new Date(now.getTime() - (2 * days - 1) * DAY_MS),
  );

  const [facts, runs] = await Promise.all([
    fetchFacts(client, priorStartDay, endDay),
    fetchRuns(client),
  ]);

  const connected = facts !== null;
  const all = facts ?? [];
  const current = all.filter((fact) => fact.day >= startDay);
  const prior = all.filter((fact) => fact.day < startDay);

  const scopedCurrent = channel
    ? current.filter((fact) => fact.channel === channel)
    : current;
  const scopedPrior = channel
    ? prior.filter((fact) => fact.channel === channel)
    : prior;

  const groupBy: ChannelGroupBy = channel ? "campaign" : "channel";

  return {
    range: { key: rangeKey, label, days, startDay, endDay },
    channel,
    report: buildChannelReport(scopedCurrent, scopedPrior, groupBy),
    drill: channel
      ? {
          byCampaign: buildChannelReport(
            scopedCurrent,
            scopedPrior,
            "campaign",
          ),
          byContent: buildChannelReport(scopedCurrent, scopedPrior, "content"),
          byDestination: buildChannelReport(
            scopedCurrent,
            scopedPrior,
            "destination",
          ),
        }
      : null,
    syncHealth: summariseSyncRuns(runs, EXPECTED_CONNECTORS, now),
    connected,
  };
}

/** Null (not empty) when the table is missing, so the tab can say so. */
async function fetchFacts(
  client: ReportClient,
  startDay: string,
  endDay: string,
): Promise<ChannelFact[] | null> {
  const rows: ChannelFact[] = [];
  try {
    for (let from = 0; from < MAX_FACT_ROWS; from += PAGE_SIZE) {
      const { data, error } = await client
        .from("channel_daily")
        .select(
          "day,channel,source,medium,campaign,content,destination,spend,impressions,reach,clicks,visits,leads,booked,showed,won,revenue",
        )
        .gte("day", startDay)
        .lte("day", endDay)
        .order("day")
        .order("channel")
        .order("source")
        .order("medium")
        .order("campaign")
        .order("content")
        .order("destination")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("channel_daily read failed", {
          code: error.code,
          message: error.message,
        });
        return null;
      }
      const batch = (data ?? []) as ChannelFact[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch {
    return null;
  }
  return rows;
}

async function fetchRuns(client: ReportClient): Promise<SyncRun[]> {
  try {
    const { data, error } = await client
      .from("channel_sync_runs")
      .select("connector,started_at,finished_at,rows_written,error")
      .order("started_at", { ascending: false })
      // Enough to hold the latest run of every connector even after a week of
      // hourly runs from one of them.
      .limit(500);
    if (error) return [];
    return (data ?? []) as SyncRun[];
  } catch {
    return [];
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
