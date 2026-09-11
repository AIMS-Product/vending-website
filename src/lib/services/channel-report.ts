import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  buildChannelReport,
  buildGoingOut,
  summariseSyncRuns,
  type BitlyClickFact,
  type ChannelFact,
  type ChannelGroupBy,
  type ChannelReport,
  type GoingOutLink,
  type GoingOutRow,
  type SyncHealthRow,
  type SyncRun,
} from "@/lib/services/channel-report-rollup";
import { CHANNEL_CONNECTORS } from "@/lib/services/channel-sync";
import { GHL_CONNECTORS } from "@/lib/services/ghl-sync";
import { METRICOOL_CONNECTOR } from "@/lib/services/metricool-sync";

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
  GHL_CONNECTORS.email,
  GHL_CONNECTORS.forms,
  METRICOOL_CONNECTOR,
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
  /** Every link in the registry with its clicks in range, zero-click links included. */
  goingOut: GoingOutRow[];
  /** Posts published in range whose outbound link fails the standard. */
  fixLinks: FixLinkRow[];
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

  const [facts, runs, goingOut, fixLinks] = await Promise.all([
    fetchFacts(client, priorStartDay, endDay),
    fetchRuns(client),
    fetchGoingOut(client, priorStartDay, endDay, startDay),
    fetchFixLinks(client, startDay),
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
    goingOut,
    fixLinks,
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

export type FixLinkRow = Pick<
  Tables<"metricool_posts">,
  | "post_id"
  | "network"
  | "published_at"
  | "permalink"
  | "link"
  | "text_excerpt"
  | "link_problems"
>;

/** Enough for a month of daily posting across five networks. */
const FIX_LINKS_LIMIT = 200;

/**
 * Bitly clicks are deliberately absent here: bitly_link_clicks only holds
 * registry links, and the YouTube registry predates the standard by design, so
 * checking those would list 600 links nobody is going to edit.
 */
async function fetchFixLinks(
  client: ReportClient,
  startDay: string,
): Promise<FixLinkRow[]> {
  try {
    const { data, error } = await client
      .from("metricool_posts")
      .select(
        "post_id,network,published_at,permalink,link,text_excerpt,link_problems",
      )
      .eq("link_compliant", false)
      .gte("published_at", `${startDay}T00:00:00.000Z`)
      .order("published_at", { ascending: false })
      .limit(FIX_LINKS_LIMIT);
    if (error) return [];
    return (data ?? []) as FixLinkRow[];
  } catch {
    return [];
  }
}

/** Newest links first; the registry is a log, so the cap matches /admin/links. */
const GOING_OUT_LIMIT = 200;

async function fetchGoingOut(
  client: ReportClient,
  priorStartDay: string,
  endDay: string,
  startDay: string,
): Promise<GoingOutRow[]> {
  try {
    const { data: links, error } = await client
      .from("marketing_links")
      .select(
        "id,url,label,utm_source,utm_medium,utm_campaign,utm_content,utm_term,bitly_id,bitly_url,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(GOING_OUT_LIMIT);
    if (error || !links?.length) return [];
    const ids = links
      .map((link) => link.bitly_id)
      .filter((id): id is string => Boolean(id));
    let clicks: BitlyClickFact[] = [];
    if (ids.length > 0) {
      const { data } = await client
        .from("bitly_link_clicks")
        .select("bitly_id,day,clicks")
        .in("bitly_id", ids)
        .gte("day", priorStartDay)
        .lte("day", endDay);
      clicks = (data ?? []) as BitlyClickFact[];
    }
    return buildGoingOut(links as GoingOutLink[], clicks, startDay);
  } catch {
    return [];
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
