import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildChannelJourneys,
  type ChannelJourneysReport,
  type JourneyLeadRow,
  type JourneyReachRow,
  type JourneyVisitRow,
  type JourneyWebinarRow,
} from "@/lib/services/channel-journeys-report";
import type {
  FunnelSessionRow,
  FunnelShowRow,
} from "@/lib/services/funnel-monthly";
import {
  resolveAdminAnalyticsRange,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import { lookbackStart } from "@/lib/analytics/lead-definition";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

export async function getChannelJourneys(input: {
  range: AdminAnalyticsRangeKey;
  client?: Client;
  now?: Date;
  includeInternal?: boolean;
}): Promise<ChannelJourneysReport> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const resolved = resolveAdminAnalyticsRange(input.range, now);
  const end = resolved.endDay ?? dayKey(resolved.endsAt);
  const start = resolved.startDay ?? shiftDays(end, -(resolved.days - 1));

  const [leads, visits, reach, webinars, shows, sessions] = await Promise.all([
    // Widened a year on the lead side: the window filters on lead creation in
    // the pure builder, and a lead created inside it can carry a call booked
    // later. Reading only the window would drop nothing here, but the same
    // query feeds the show join, which needs the whole person.
    page(
      (from, to) =>
        client
          .from("lead_submissions")
          .select(
            "id,email,full_name,created_at,lifecycle_status,source_path,utm_source,utm_medium,metadata,call_booked_at,closed_won_at,closed_won_value",
          )
          // 30 days early so repeats are recognised (lead-definition).
          .gte(
            "created_at",
            lookbackStart(`${start}T00:00:00.000Z`).toISOString(),
          )
          .lte("created_at", `${end}T23:59:59.999Z`)
          .order("created_at")
          .range(from, to),
      "lead_submissions",
    ) as Promise<JourneyLeadRow[]>,
    page(
      (from, to) =>
        client
          .from("ga4_page_views")
          // utm_campaign is not optional here: ga4_page_views has no medium, so
          // resolveGa4Channel needs the campaign to tell a paid google session
          // from an organic one. Without it every Google Ads session resolved
          // to Organic search and the lane read 0 visits against 96 leads.
          .select("day,landing_page,utm_source,utm_campaign,sessions")
          .gte("day", start)
          .lte("day", end)
          .order("day")
          .range(from, to),
      "ga4_page_views",
    ) as Promise<JourneyVisitRow[]>,
    page(
      (from, to) =>
        client
          .from("channel_daily")
          .select("day,channel,source,medium,impressions,clicks")
          .gte("day", start)
          .lte("day", end)
          .order("day")
          .range(from, to),
      "channel_daily",
    ) as Promise<JourneyReachRow[]>,
    page(
      (from, to) =>
        client
          .from("webinar_events")
          .select("date,registrations")
          .gte("date", start)
          .lte("date", end)
          .order("date")
          .range(from, to),
      "webinar_events",
    ) as Promise<JourneyWebinarRow[]>,
    // Unfiltered by date on purpose: a lead captured inside the window can
    // have its call scheduled outside it, and filtering here would drop
    // exactly the rows the show step needs.
    page(
      (from, to) =>
        client
          .from("close_lead_funnel")
          .select("email,first_sales_call_booked_date,first_call_show_up")
          .order("lead_id")
          .range(from, to),
      "close_lead_funnel",
    ) as Promise<FunnelShowRow[]>,
    page(
      (from, to) =>
        client
          .from("qualification_sessions")
          .select("lead_submission_id,completed_at,answer_count")
          .gte("created_at", `${start}T00:00:00.000Z`)
          .order("created_at")
          .range(from, to),
      "qualification_sessions",
    ) as Promise<FunnelSessionRow[]>,
  ]);

  return buildChannelJourneys({
    leads,
    visits,
    reach,
    webinars,
    shows,
    sessions,
    window: { start, end },
    now,
    includeInternal: input.includeInternal,
  });
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
      // A partial read shortens a denominator and reads as a conversion
      // collapse. Fail the tab rather than draw a wrong shape.
      throw new Error(`${table} read failed: ${error.message}`);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
