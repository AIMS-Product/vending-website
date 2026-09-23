import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import {
  resolveAdminAnalyticsRange,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  buildConfidence,
  type ConfidenceReport,
  type SourceCounts,
} from "@/lib/services/channel-confidence";
import { MANYCHAT_INGEST_CONNECTOR } from "@/lib/services/manychat-ingest";
import {
  buildChannelReport,
  buildGoingOut,
  normaliseFacts,
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
import {
  CHANNEL_CONNECTORS,
  leadSpineRows,
  type LeadRow,
} from "@/lib/services/channel-sync";
import { channelDailyKey } from "@/lib/services/channel-daily";
import {
  collapseToLeads,
  lookbackStart,
} from "@/lib/analytics/lead-definition";
import { CLOSE_LEAD_FUNNEL_CONNECTOR } from "@/lib/services/close-lead-funnel-sync";
import { getCloseWins, type CloseWinsReport } from "@/lib/services/close-wins";
import { GHL_CONNECTORS } from "@/lib/services/ghl-sync";
import {
  METRICOOL_ADS_CONNECTOR,
  METRICOOL_CONNECTOR,
} from "@/lib/services/metricool-sync";
import { SEARCH_CONSOLE_CONNECTOR } from "@/lib/services/search-console-sync";
import { YOUTUBE_ANALYTICS_CONNECTOR } from "@/lib/services/youtube-analytics-sync";

export type ReportClient = Pick<SupabaseClient<Database>, "from">;

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
  MANYCHAT_INGEST_CONNECTOR,
  GHL_CONNECTORS.email,
  GHL_CONNECTORS.forms,
  METRICOOL_CONNECTOR,
  METRICOOL_ADS_CONNECTOR,
  YOUTUBE_ANALYTICS_CONNECTOR,
  SEARCH_CONSOLE_CONNECTOR,
  CLOSE_LEAD_FUNNEL_CONNECTOR,
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
  /** Coverage per channel and the spine reconciled against its sources. */
  confidence: ConfidenceReport;
  /** Every link in the registry with its clicks in range, zero-click links included. */
  goingOut: GoingOutRow[];
  /** Posts published in range whose outbound link fails the standard. */
  fixLinks: FixLinkRow[];
  /** False when the spine tables do not exist yet (migration not applied). */
  connected: boolean;
  /** Won deals in range as Close records them, one period keyed "range". */
  closeWins: CloseWinsReport;
};

export async function getChannelsTab(
  input: {
    range?: AdminAnalyticsRangeKey;
    includeInternal?: boolean;
    channel?: string | null;
    client?: ReportClient;
    now?: Date;
  } = {},
): Promise<ChannelsTabData> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const rangeKey = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const { label, days, endsAt } = resolveAdminAnalyticsRange(rangeKey, now);
  const channel = input.channel?.trim() || null;

  const endDay = dayKey(endsAt);
  const startDay = dayKey(new Date(endsAt.getTime() - (days - 1) * DAY_MS));
  const priorStartDay = dayKey(
    new Date(endsAt.getTime() - (2 * days - 1) * DAY_MS),
  );

  const [facts, runs, goingOut, fixLinks, sources, closeWins] =
    await Promise.all([
      fetchFacts(client, priorStartDay, endDay, {
        includeInternal: input.includeInternal,
      }),
      fetchRuns(client),
      fetchGoingOut(client, priorStartDay, endDay, startDay),
      fetchFixLinks(client, startDay),
      fetchSourceCounts(
        client,
        startDay,
        endDay,
        input.includeInternal ?? false,
      ),
      getCloseWins({
        from: startDay,
        to: endDay,
        periodOf: () => "range",
        mirror: client,
      }),
    ]);

  const connected = facts !== null;
  const all = normaliseFacts(facts ?? []);
  const current = all.filter((fact) => fact.day >= startDay);
  const prior = all.filter((fact) => fact.day < startDay);

  const scopedCurrent = channel
    ? current.filter((fact) => fact.channel === channel)
    : current;
  const scopedPrior = channel
    ? prior.filter((fact) => fact.channel === channel)
    : prior;

  const groupBy: ChannelGroupBy = channel ? "campaign" : "channel";
  const syncHealth = summariseSyncRuns(runs, EXPECTED_CONNECTORS, now);

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
    syncHealth,
    confidence: buildConfidence(current, syncHealth, sources),
    goingOut,
    fixLinks,
    connected,
    closeWins,
  };
}

/**
 * Spine facts with the Leads column held to the one lead definition.
 *
 * The stored `leads` column is written by four connectors: the site's own
 * leads, plus webinar registrations, GHL form fills and ManyChat contacts.
 * Summed, August read 4,246 "leads" here against 597 on every other tab. So
 * `leads` is recomputed from lead_submissions through `collapseToLeads` and
 * the same row mapping the leads connector writes (`leadSpineRows`), and a
 * stored count on a key no site lead ever used moves to `contacts`.
 *
 * Null (not empty) when the table is missing, so the tab can say so.
 */
export async function fetchFacts(
  client: ReportClient,
  startDay: string,
  endDay: string,
  options: { includeInternal?: boolean } = {},
): Promise<ChannelFact[] | null> {
  const [stored, leadRows] = await Promise.all([
    fetchStoredFacts(client, startDay, endDay),
    fetchSiteLeadRows(client, startDay, endDay),
  ]);
  if (stored === null || leadRows === null) return stored;
  return applyLeadDefinition(stored, leadRows, {
    startDay,
    endDay,
    includeInternal: options.includeInternal ?? false,
  });
}

/** The spine's primary key: the six link dimensions, never the channel. */
function factId(fact: {
  day: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
}): string {
  return [
    fact.day,
    fact.source,
    fact.medium,
    fact.campaign,
    fact.content,
    fact.destination,
  ].join("\u0000");
}

export function applyLeadDefinition(
  stored: ChannelFact[],
  leadRows: SpineLeadRow[],
  window: { startDay: string; endDay: string; includeInternal: boolean },
): ChannelFact[] {
  const keyed = (rows: SpineLeadRow[]) =>
    leadSpineRows(rows).map((row) => channelDailyKey(row));

  // Every key a site submission was ever written under, counted or not: a
  // stored count there is the site's (a repeat, a newsletter signup, a test),
  // never a registration.
  const siteKeys = new Set(keyed(leadRows).map(factId));
  const counted = new Map<
    string,
    { key: ReturnType<typeof channelDailyKey>; leads: number }
  >();
  for (const key of keyed(
    collapseToLeads(leadRows, {
      includeInternal: window.includeInternal,
    }),
  )) {
    if (key.day < window.startDay || key.day > window.endDay) continue;
    const id = factId(key);
    const entry = counted.get(id);
    counted.set(id, { key, leads: (entry?.leads ?? 0) + 1 });
  }

  const facts = stored.map((fact): ChannelFact => {
    const id = factId(fact);
    const site = counted.get(id);
    if (site || siteKeys.has(id)) {
      return { ...fact, leads: site?.leads ?? 0, contacts: null };
    }
    return { ...fact, leads: null, contacts: fact.leads };
  });

  // Leads the connector has not written yet (it runs nightly) still count.
  const storedIds = new Set(stored.map(factId));
  const missing = [...counted.entries()]
    .filter(([id]) => !storedIds.has(id))
    .map(([, { key, leads }]): ChannelFact => ({
      ...key,
      spend: null,
      impressions: null,
      reach: null,
      clicks: null,
      visits: null,
      thankyou_visits: null,
      leads,
      contacts: null,
      booked: null,
      showed: null,
      won: null,
      revenue: null,
    }));
  return [...facts, ...missing];
}

type SpineLeadRow = LeadRow & { closed_won_value?: number | null };

/**
 * Site lead rows from 30 days before the window (so repeats are recognised)
 * to its end, with every field `leadSpineRows` keys on. Null on a read error:
 * the tab then shows the stored spine rather than a half-read recount.
 */
async function fetchSiteLeadRows(
  client: ReportClient,
  startDay: string,
  endDay: string,
): Promise<SpineLeadRow[] | null> {
  const endExclusive = `${dayKey(new Date(new Date(`${endDay}T00:00:00.000Z`).getTime() + DAY_MS))}T00:00:00.000Z`;
  const rows: SpineLeadRow[] = [];
  for (let from = 0; from < MAX_FACT_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("lead_submissions")
      .select(
        "created_at,email,full_name,lifecycle_status,utm_source,utm_medium,utm_campaign,utm_content,utm_term,call_booked_at,call_outcome,closed_won_at,closed_won_value,metadata",
      )
      .gte(
        "created_at",
        lookbackStart(`${startDay}T00:00:00.000Z`).toISOString(),
      )
      .lt("created_at", endExclusive)
      .order("created_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("lead_submissions read for channel facts failed", {
        code: error.code,
        message: error.message,
      });
      return null;
    }
    const batch = (data ?? []) as unknown as SpineLeadRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchStoredFacts(
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

/**
 * The tables the spine was built from, counted the way the connectors count
 * them, so the confidence panel can say "spine 682 vs source 682". Each is
 * null (not zero) when it cannot be read.
 */
async function fetchSourceCounts(
  client: ReportClient,
  startDay: string,
  endDay: string,
  includeInternal = false,
): Promise<SourceCounts> {
  const startIso = `${startDay}T00:00:00.000Z`;
  const endExclusive = `${dayKey(new Date(new Date(`${endDay}T00:00:00.000Z`).getTime() + DAY_MS))}T00:00:00.000Z`;
  const [leadSubmissions, webinarRegistrations, ga4Sessions, calendlyBookings] =
    await Promise.all([
      // Counted by the one lead definition, like the Leads column.
      fetchSiteLeadRows(client, startDay, endDay).then((rows) =>
        rows === null
          ? null
          : collapseToLeads(rows, { includeInternal }).filter(
              (lead) => lead.created_at.slice(0, 10) >= startDay,
            ).length,
      ),
      pageSum(
        (from, to) =>
          client
            .from("webinar_events")
            .select("registrations")
            .gte("date", startDay)
            .lte("date", endDay)
            .order("date")
            .range(from, to),
        (row: { registrations: number | null }) => row.registrations ?? 0,
      ),
      pageSum(
        (from, to) =>
          client
            .from("ga4_page_views")
            .select("sessions")
            .gte("day", startDay)
            .lte("day", endDay)
            .order("day")
            .range(from, to),
        (row: { sessions: number }) => row.sessions,
      ),
      pageSum(
        (from, to) =>
          client
            .from("calendly_bookings")
            .select("created_at,invitee_email,invitee_name")
            .eq("status", "booked")
            // Only bookings the leads connector can see: linked to a lead, or
            // on a tagged link. Untagged bookings with no lead (next-steps,
            // onboarding, rescheduled calls) are not funnel bookings.
            .or("lead_submission_id.not.is.null,utm_source.not.is.null")
            .gte("created_at", startIso)
            .lt("created_at", endExclusive)
            .order("created_at")
            .range(from, to),
        // Same population as the spine side: test and internal bookings are
        // out unless the toggle is on, or they read as drift.
        (row: { invitee_email: string | null; invitee_name: string | null }) =>
          includeInternal ||
          !isInternalLead(row.invitee_email, row.invitee_name)
            ? 1
            : 0,
      ),
    ]);
  return {
    leadSubmissions,
    webinarRegistrations,
    ga4Sessions,
    calendlyBookings,
  };
}

async function pageSum<Row>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  value: (row: Row) => number,
): Promise<number | null> {
  let total = 0;
  try {
    for (let from = 0; from < MAX_FACT_ROWS; from += PAGE_SIZE) {
      const { data, error } = await query(from, from + PAGE_SIZE - 1);
      if (error) return null;
      const rows = (data ?? []) as Row[];
      for (const row of rows) total += value(row);
      if (rows.length < PAGE_SIZE) break;
    }
  } catch {
    return null;
  }
  return total;
}

export async function fetchRuns(client: ReportClient): Promise<SyncRun[]> {
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

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
