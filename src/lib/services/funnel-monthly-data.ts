import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFunnelMonthly,
  type FunnelLeadRow,
  type FunnelGrouping,
  type FunnelMonthlyReport,
  type FunnelSessionRow,
  type FunnelShowRow,
  type FunnelVisitRow,
} from "@/lib/services/funnel-monthly";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
/** Stops a runaway page loop if a filter is ever dropped. */
const MAX_ROWS = 200_000;

/**
 * The monthly per-funnel report.
 *
 * The window starts at the first lead we ever captured rather than a fixed
 * lookback: GA4 holds months of traffic from before the site had a form on it,
 * and pulling those days would cost tens of thousands of rows to render months
 * whose lead column is empty by construction.
 */
export async function getFunnelMonthly(
  input: {
    client?: Client;
    now?: Date;
    includeInternal?: boolean;
    grouping?: FunnelGrouping;
  } = {},
): Promise<FunnelMonthlyReport> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();

  return buildFunnelMonthly({
    ...(await fetchFunnelInputs(client, now)),
    now,
    includeInternal: input.includeInternal,
    grouping: input.grouping,
  });
}

export type FunnelInputs = {
  leads: FunnelLeadRow[];
  visits: FunnelVisitRow[];
  shows: FunnelShowRow[];
  sessions: FunnelSessionRow[];
};

/**
 * The four reads every monthly rollup needs.
 *
 * Exported so a view wanting the same months grouped two ways pays for one
 * read rather than two: the grouping is applied in memory by
 * `buildFunnelMonthly`, and these tables run to tens of thousands of rows.
 */
export async function fetchFunnelInputs(
  client: Client,
  now: Date,
): Promise<FunnelInputs> {
  const startDay = await firstLeadMonthStart(client, now);
  const [leads, visits, shows, sessions] = await Promise.all([
    fetchLeads(client, startDay),
    fetchVisits(client, startDay),
    fetchShows(client),
    fetchSessions(client, startDay),
  ]);
  return { leads, visits, shows, sessions };
}

/** First day of the month the earliest lead landed in. */
async function firstLeadMonthStart(client: Client, now: Date): Promise<string> {
  const { data, error } = await client
    .from("lead_submissions")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1);
  const earliest = error ? null : (data?.[0]?.created_at ?? null);
  // No leads at all: ask for this month and get an empty report rather than
  // falling back to a window that scans every GA4 row we hold.
  return `${(earliest ?? now.toISOString()).slice(0, 7)}-01`;
}

async function fetchLeads(
  client: Client,
  startDay: string,
): Promise<FunnelLeadRow[]> {
  return page(
    (from, to) =>
      client
        .from("lead_submissions")
        .select(
          "id,email,full_name,created_at,lifecycle_status,source_path,utm_source,utm_medium,metadata,call_booked_at,closed_won_at,closed_won_value",
        )
        .gte("created_at", `${startDay}T00:00:00.000Z`)
        .order("created_at")
        .range(from, to),
    "lead_submissions",
  );
}

async function fetchVisits(
  client: Client,
  startDay: string,
): Promise<FunnelVisitRow[]> {
  return page(
    (from, to) =>
      client
        .from("ga4_page_views")
        .select("day,landing_page,sessions,utm_source,utm_campaign")
        .gte("day", startDay)
        .order("day")
        .range(from, to),
    "ga4_page_views",
  );
}

/**
 * The Close mirror, unfiltered by date: a lead captured in July can have its
 * first call scheduled in September, and filtering the mirror by either date
 * would drop exactly the rows the show rate needs.
 */
async function fetchShows(client: Client): Promise<FunnelShowRow[]> {
  return page(
    (from, to) =>
      client
        .from("close_lead_funnel")
        .select("email,first_sales_call_booked_date,first_call_show_up")
        .order("lead_id")
        .range(from, to),
    "close_lead_funnel",
  );
}

/**
 * Qualification sessions, dated by the lead they belong to rather than their
 * own start: a session opened just after midnight belongs to the lead captured
 * the evening before, and bucketing it on its own day would move one person's
 * form completion into a month their lead is not in.
 */
async function fetchSessions(
  client: Client,
  startDay: string,
): Promise<FunnelSessionRow[]> {
  return page(
    (from, to) =>
      client
        .from("qualification_sessions")
        .select("lead_submission_id,completed_at,answer_count")
        .gte("created_at", `${startDay}T00:00:00.000Z`)
        .order("created_at")
        .range(from, to),
    "qualification_sessions",
  );
}

async function page<Row>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  table: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) {
      // A partial read would print rates over a denominator missing its tail,
      // which reads as a conversion collapse. Fail the tab instead.
      throw new Error(`${table} read failed: ${error.message}`);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
