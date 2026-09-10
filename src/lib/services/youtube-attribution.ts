import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import {
  buildYouTubeAttribution,
  type BitlyClickRow,
  type PageViewRow,
  type YouTubeAttributionRollup,
  type YouTubeLeadRow,
  type YouTubeVideoRow,
  type YouTubeVisitsSource,
} from "@/lib/services/youtube-attribution-rollup";

type YouTubeAttributionClient = Pick<SupabaseClient<Database>, "from">;

export type YouTubeAttribution = YouTubeAttributionRollup & {
  range: {
    key: AdminAnalyticsRangeKey;
    label: string;
    days: number;
    startIso: string;
    endIso: string;
  };
  includeInternal: boolean;
  /** Internal/test leads filtered out, so the page's toggle can name the count. */
  internalExcluded: number;
};

export class YouTubeAttributionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeAttributionServiceError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

const LEAD_BASE_FIELDS =
  "id,created_at,email,full_name,utm_source,utm_campaign,utm_content,lifecycle_status,call_booked_at,metadata" as const;

/**
 * The outcome columns this slice's migration adds. Selected separately so a
 * deploy that lands before the migration is run degrades to "outcomes not
 * connected" instead of failing the whole lead read — the repo already carries
 * one migration (`public_request_hits`) that shipped un-applied on purpose.
 */
const LEAD_OUTCOME_FIELDS =
  "call_outcome,closed_won_at,closed_won_source" as const;

/** Same ceiling and reasoning as the admin analytics lead read. */
const MAX_LEAD_ROWS = 50_000;

/**
 * Ceilings on the two reads that have no other bound.
 *
 * Both tables grow per link per day (646 links x 365 days is ~235k click rows
 * on a 1-year range) and both are read on every admin page load. Hitting the
 * cap reports the stage as unmeasured rather than returning a truncated total
 * that silently reads low -- see `capped` below.
 */
export const MAX_CLICK_ROWS = 100_000;
export const MAX_PAGE_VIEW_ROWS = 100_000;

/**
 * The YouTube tab's data.
 *
 * Three of the six funnel stages come from tables that may not exist yet
 * (`bitly_link_clicks` and `lead_page_views` land with their own migration, and
 * the Bitly sync needs a token). Each degrades to "not connected" rather than
 * throwing or reporting zero, so the tab is useful from the first deploy and
 * gets deeper as each integration is switched on.
 *
 * Leads are the exception: a lead read failure throws, because without leads
 * there is nothing on the page.
 */
export async function getYouTubeAttribution(
  input: {
    range?: AdminAnalyticsRangeKey;
    includeInternal?: boolean;
    client?: YouTubeAttributionClient;
    now?: Date;
  } = {},
): Promise<YouTubeAttribution> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const rangeKey = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const includeInternal = input.includeInternal ?? false;

  const { label, days } = ADMIN_ANALYTICS_RANGES[rangeKey];
  const end = now;
  const start = new Date(end.getTime() - days * DAY_MS);
  const startIso = start.toISOString();

  const [leadRead, videos, clicks, pageViews] = await Promise.all([
    fetchLeads(client, startIso),
    fetchVideos(client),
    fetchClicks(client, startIso),
    fetchVisits(client, startIso),
  ]);

  const leadRows = leadRead.rows;
  const internalExcluded = leadRows.filter((lead) =>
    isInternalLead(
      lead.email,
      (lead as { full_name?: string | null }).full_name ?? null,
    ),
  ).length;
  const leads = includeInternal
    ? leadRows
    : leadRows.filter(
        (lead) =>
          !isInternalLead(
            lead.email,
            (lead as { full_name?: string | null }).full_name ?? null,
          ),
      );

  return {
    ...buildYouTubeAttribution({
      leads,
      videos: videos.rows,
      clicks: clicks.rows,
      pageViews: pageViews.rows,
      clicksConnected: clicks.connected,
      visitsConnected: pageViews.connected,
      visitsSource: pageViews.source,
      outcomesConnected: leadRead.outcomesConnected,
    }),
    range: {
      key: rangeKey,
      label,
      days,
      startIso,
      endIso: end.toISOString(),
    },
    includeInternal,
    internalExcluded,
  };
}

async function fetchLeads(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<{ rows: YouTubeLeadRow[]; outcomesConnected: boolean }> {
  const withOutcomes = await selectLeads(
    client,
    sinceIso,
    `${LEAD_BASE_FIELDS},${LEAD_OUTCOME_FIELDS}`,
  );
  if (withOutcomes) return { rows: withOutcomes, outcomesConnected: true };

  const baseOnly = await selectLeads(client, sinceIso, LEAD_BASE_FIELDS);
  if (baseOnly) return { rows: baseOnly, outcomesConnected: false };

  throw new YouTubeAttributionServiceError(
    "Could not load leads for YouTube attribution.",
  );
}

async function selectLeads(
  client: YouTubeAttributionClient,
  sinceIso: string,
  fields: string,
): Promise<YouTubeLeadRow[] | null> {
  try {
    const { data, error } = await client
      .from("lead_submissions")
      .select(fields)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(MAX_LEAD_ROWS);
    if (error) return null;
    return (data ?? []) as unknown as YouTubeLeadRow[];
  } catch {
    return null;
  }
}

type Fetched<T> = { rows: T[]; connected: boolean };

async function fetchVideos(
  client: YouTubeAttributionClient,
): Promise<Fetched<YouTubeVideoRow>> {
  return degradable(async () => {
    const { data, error } = await client
      .from("youtube_videos")
      .select(
        "utm_campaign,title,video_url,published_at,bitly_id,in_description",
      );
    if (error) return null;
    return (data ?? []) as unknown as YouTubeVideoRow[];
  });
}

async function fetchClicks(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<BitlyClickRow>> {
  return degradable(async () => {
    const { data, error } = await client
      .from("bitly_link_clicks")
      .select("utm_campaign,day,clicks")
      .gte("day", sinceIso.slice(0, 10))
      // Uses the partial (utm_campaign, day) index instead of scanning, and
      // drops rows the rollup discards anyway -- it sums by campaign.
      .not("utm_campaign", "is", null)
      .limit(MAX_CLICK_ROWS);
    if (error) return null;
    return capped(
      (data ?? []) as unknown as BitlyClickRow[],
      MAX_CLICK_ROWS,
      "bitly_link_clicks",
    );
  });
}

/**
 * GA4 when it has rows for the range, the site's own visit events otherwise.
 *
 * GA4 carries history back to 2026-02-26; `lead_page_views` starts on
 * 2026-09-10. The fallback covers the window before the GA4 migration and its
 * first sync land, and `source` tells the coverage note which one it got.
 */
async function fetchVisits(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<PageViewRow> & { source: YouTubeVisitsSource | null }> {
  const [ga4, site] = await Promise.all([
    fetchGa4PageViews(client, sinceIso),
    fetchPageViews(client, sinceIso),
  ]);
  if (ga4.connected && ga4.rows.length > 0) return { ...ga4, source: "ga4" };
  return { ...site, source: site.connected ? "site" : null };
}

type Ga4VisitRow = {
  utm_source: string;
  utm_campaign: string;
  day: string;
  sessions: number;
};

async function fetchGa4PageViews(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<PageViewRow>> {
  return degradable(async () => {
    const { data, error } = await client
      .from("ga4_page_views")
      // Sessions, not screen_page_views: one click through to the site is one
      // session however many pages it goes on to view.
      .select("utm_source,utm_campaign,day,sessions")
      .gte("day", sinceIso.slice(0, 10))
      // GA4 writes the literal "(not set)" where lead_page_views has null.
      .neq("utm_campaign", "(not set)")
      .limit(MAX_PAGE_VIEW_ROWS);
    if (error) return null;
    const rows = capped(
      (data ?? []) as unknown as Ga4VisitRow[],
      MAX_PAGE_VIEW_ROWS,
      "ga4_page_views",
    );
    // ponytail: a capped GA4 read falls back to lead_page_views, which reads
    // low. Unreachable today (a year of every channel is ~30k rows); split the
    // read by campaign if the table ever nears the cap.
    return (
      rows?.map((row) => ({
        utm_source: row.utm_source,
        utm_campaign: row.utm_campaign,
        occurred_at: row.day,
        views: row.sessions,
      })) ?? null
    );
  });
}

async function fetchPageViews(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<PageViewRow>> {
  return degradable(async () => {
    const { data, error } = await client
      .from("lead_page_views")
      // utm_source: the table holds every tagged channel's visits, and the
      // rollup keeps only the YouTube ones.
      .select("utm_source,utm_campaign,occurred_at")
      .gte("occurred_at", sinceIso)
      .not("utm_campaign", "is", null)
      .limit(MAX_PAGE_VIEW_ROWS);
    if (error) return null;
    return capped(
      (data ?? []) as unknown as PageViewRow[],
      MAX_PAGE_VIEW_ROWS,
      "lead_page_views",
    );
  });
}

/**
 * A read that came back exactly at its cap was almost certainly truncated, and
 * a truncated total reads low with no signal. Report it as unmeasured.
 */
function capped<T>(rows: T[], limit: number, table: string): T[] | null {
  if (rows.length < limit) return rows;
  console.error(
    `[youtube-attribution] ${table} read hit its ${limit}-row cap; reporting the stage as unmeasured rather than understated.`,
  );
  return null;
}

/**
 * Runs a read that is allowed to be missing.
 *
 * `connected: false` means the table or its data is not there yet — most often
 * Postgres 42P01 before this slice's migration is applied. The rollup turns
 * that into "not measured", which is the honest reading; an empty array with
 * `connected: true` would mean "measured, and it was zero".
 */
async function degradable<T>(
  read: () => Promise<T[] | null>,
): Promise<Fetched<T>> {
  try {
    const rows = await read();
    if (rows === null) return { rows: [], connected: false };
    return { rows, connected: true };
  } catch {
    return { rows: [], connected: false };
  }
}
