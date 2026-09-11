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
      clicksWindowStart: clicks.windowStart,
      clicksFailed: clicks.failed,
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
    if (error) {
      noteReadError("lead_submissions", error);
      return null;
    }
    return (data ?? []) as unknown as YouTubeLeadRow[];
  } catch (error) {
    noteReadError("lead_submissions", error);
    return null;
  }
}

/**
 * The only codes that mean "this table or column is not there yet".
 *
 * 42P01 undefined_table, 42703 undefined_column, and PostgREST's two
 * schema-cache misses. Anything else is a fault, not a switch left off.
 */
const NOT_CONNECTED_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

function isNotConnected(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && NOT_CONNECTED_CODES.has(code);
}

/**
 * Records a read that failed for a reason other than a missing table.
 *
 * The stage still reports as unmeasured — null, never zero — but a statement
 * timeout is not "the migration has not been applied", and swallowing it is how
 * a real outage comes to read on the page as an integration nobody switched on.
 * Code and message only: these rows carry lead PII.
 */
function noteReadError(context: string, error: unknown): boolean {
  if (isNotConnected(error)) return false;
  const { code, message } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  console.error(
    `[youtube-attribution] ${context} read failed (${String(code ?? "no code")}): ${String(message ?? error)}`,
  );
  return true;
}

type Fetched<T> = { rows: T[]; connected: boolean };

async function fetchVideos(
  client: YouTubeAttributionClient,
): Promise<Fetched<YouTubeVideoRow>> {
  return degradable("youtube_videos", async () => {
    const { data, error } = await client
      .from("youtube_videos")
      .select(
        "utm_campaign,title,video_url,published_at,bitly_id,in_description",
      );
    if (error) {
      noteReadError("youtube_videos", error);
      return null;
    }
    return (data ?? []) as unknown as YouTubeVideoRow[];
  });
}

/**
 * Clicks for the range, or nothing at all when the range outruns the sync.
 *
 * `bitly-click-sync` only ever walks back `DEFAULT_DAYS` (30), so on a 90-day
 * or 1-year range a summed click total would be one month of clicks sitting
 * above twelve months of visits — and the stage below it would read well over
 * 100%. Outside the synced window the stage is unmeasured, which is the honest
 * reading. One extra bounded query finds the boundary.
 *
 * `failed` separates "we could not read this" from "there is nothing to read".
 * Both leave the stage unmeasured, but only the second means somebody has to go
 * and configure a Bitly token, and the note on the page says so.
 */
async function fetchClicks(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<
  Fetched<BitlyClickRow> & { windowStart: string | null; failed: boolean }
> {
  const probe = await earliestClickDay(client);
  if (probe.failed) {
    return { rows: [], connected: false, windowStart: null, failed: true };
  }
  // No rows at all: nothing has ever synced, so "0 clicks" would be a number
  // nobody measured.
  if (probe.day === null) {
    return { rows: [], connected: false, windowStart: null, failed: false };
  }
  if (sinceIso.slice(0, 10) < probe.day) {
    return {
      rows: [],
      connected: false,
      windowStart: probe.day,
      failed: false,
    };
  }
  const read = await fetchClicksInWindow(client, sinceIso);
  // The probe found rows, so a windowed read that still comes back unmeasured
  // either errored or hit its row cap. Neither is a missing token.
  return { ...read, windowStart: probe.day, failed: !read.connected };
}

/**
 * The first day the Bitly sync ever wrote. One row.
 *
 * Not the primary key: that is (bitly_id, day), so ordering on `day` alone
 * cannot use it, and the campaign index is partial on a non-null utm_campaign
 * so it cannot answer for the whole table either. Until
 * `20260911120000_bitly_link_clicks_day_idx` is applied this is a sequential
 * scan and a sort on every render -- correct, just slower.
 */
async function earliestClickDay(
  client: YouTubeAttributionClient,
): Promise<{ day: string | null; failed: boolean }> {
  try {
    const { data, error } = await client
      .from("bitly_link_clicks")
      .select("day")
      .order("day", { ascending: true })
      .limit(1);
    if (error) {
      return { day: null, failed: noteReadError("bitly_link_clicks", error) };
    }
    const day = (data as { day?: unknown }[] | null)?.[0]?.day;
    return {
      day: typeof day === "string" ? day.slice(0, 10) : null,
      failed: false,
    };
  } catch (error) {
    return { day: null, failed: noteReadError("bitly_link_clicks", error) };
  }
}

async function fetchClicksInWindow(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<BitlyClickRow>> {
  return degradable("bitly_link_clicks", () =>
    readAllRows<BitlyClickRow>(
      "bitly_link_clicks",
      MAX_CLICK_ROWS,
      (from, to) =>
        client
          .from("bitly_link_clicks")
          .select("utm_campaign,day,clicks")
          .gte("day", sinceIso.slice(0, 10))
          // Uses the partial (utm_campaign, day) index instead of scanning, and
          // drops rows the rollup discards anyway -- it sums by campaign.
          .not("utm_campaign", "is", null)
          // The primary key, so pages neither overlap nor skip.
          .order("bitly_id")
          .order("day")
          .range(from, to),
    ),
  );
}

/**
 * GA4 when it has rows for the range, the site's own visit events otherwise.
 *
 * GA4 carries history back to 2026-02-26; `lead_page_views` starts on
 * 2026-09-10. The fallback covers only a GA4 table that is present but empty
 * for the range. A GA4 read that fails reports visits as unmeasured instead:
 * on any range longer than a day the site's events would read far low, and a
 * visit-to-lead rate built on them would read far high.
 */
async function fetchVisits(
  client: YouTubeAttributionClient,
  sinceIso: string,
): Promise<Fetched<PageViewRow> & { source: YouTubeVisitsSource | null }> {
  const [ga4, site] = await Promise.all([
    fetchGa4PageViews(client, sinceIso),
    fetchPageViews(client, sinceIso),
  ]);
  if (!ga4.connected) return { rows: [], connected: false, source: null };
  if (ga4.rows.length > 0) return { ...ga4, source: "ga4" };
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
  return degradable("ga4_page_views", async () => {
    const rows = await readAllRows<Ga4VisitRow>(
      "ga4_page_views",
      MAX_PAGE_VIEW_ROWS,
      (from, to) =>
        client
          .from("ga4_page_views")
          // Sessions, not screen_page_views: one click through to the site is
          // one session however many pages it goes on to view.
          .select("utm_source,utm_campaign,day,sessions")
          .gte("day", sinceIso.slice(0, 10))
          // GA4 writes the literal "(not set)" where lead_page_views has null.
          .neq("utm_campaign", "(not set)")
          // The primary key, so pages neither overlap nor skip.
          .order("day")
          .order("landing_page")
          .order("utm_campaign")
          .order("utm_source")
          .range(from, to),
    );
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
  return degradable("lead_page_views", () =>
    readAllRows<PageViewRow>(
      "lead_page_views",
      MAX_PAGE_VIEW_ROWS,
      (from, to) =>
        client
          .from("lead_page_views")
          // utm_source: the table holds every tagged channel's visits, and the
          // rollup keeps only the YouTube ones.
          .select("utm_source,utm_campaign,occurred_at")
          .gte("occurred_at", sinceIso)
          .not("utm_campaign", "is", null)
          .order("id")
          .range(from, to),
    ),
  );
}

/**
 * PostgREST caps every response at the project's `max_rows` — 1,000, both in
 * `supabase/config.toml` and on the hosted project — and silently ignores a
 * larger `.limit()`. One select therefore returns the first 1,000 rows as if
 * they were all of them. Pages until a short page comes back.
 *
 * Pages go out `PAGE_CONCURRENCY` at a time. Sequentially, the 1-year GA4 read
 * was 16 round trips at ~1.4s (measured against production 2026-09-10) and
 * growing by a page every couple of weeks; six at a time makes it three.
 *
 * ponytail: still reads every row. Replace with a grouped-sum RPC if the
 * analytics page ever feels slow again.
 */
const PAGE_ROWS = 1000;

/**
 * Pages in flight at once.
 *
 * The cost of guessing is bounded: only the final batch over-reads, by at most
 * five empty pages, which is cheaper than the extra `count: "exact"` round trip
 * it would take to know the total up front.
 */
const PAGE_CONCURRENCY = 6;

async function readAllRows<T>(
  table: string,
  limit: number,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  let reachedEnd = false;

  while (!reachedEnd && rows.length < limit) {
    const starts = Array.from(
      { length: PAGE_CONCURRENCY },
      (_, index) => rows.length + index * PAGE_ROWS,
    ).filter((from) => from < limit);

    const pages = await Promise.all(
      starts.map((from) => page(from, from + PAGE_ROWS - 1)),
    );

    // In page order, so the rows land in the order the query asked for.
    for (const { data, error } of pages) {
      if (error) {
        noteReadError(table, error);
        return null;
      }
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      // A short page is the end of the table. Anything this batch read past it
      // is empty by definition, so it is dropped rather than appended.
      if (batch.length < PAGE_ROWS) {
        reachedEnd = true;
        break;
      }
    }
  }

  return reachedEnd ? rows : capped(rows, limit, table);
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
 * `connected: false` means the stage could not be measured — most often
 * Postgres 42P01 before this slice's migration is applied, but a timeout or a
 * transient 5xx lands here too (logged by `noteReadError`, never silent). The
 * rollup turns that into "not measured", which is the honest reading; an empty
 * array with `connected: true` would mean "measured, and it was zero".
 */
async function degradable<T>(
  context: string,
  read: () => Promise<T[] | null>,
): Promise<Fetched<T>> {
  try {
    const rows = await read();
    if (rows === null) return { rows: [], connected: false };
    return { rows, connected: true };
  } catch (error) {
    noteReadError(context, error);
    return { rows: [], connected: false };
  }
}
