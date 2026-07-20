import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

type LeadRow = Tables<"lead_submissions">;
type BookingRow = Tables<"calendly_bookings">;
type LeadAnalyticsRow = Pick<
  LeadRow,
  "id" | "created_at" | "source_path" | "utm_source"
>;
type BookingAnalyticsRow = Pick<
  BookingRow,
  "id" | "created_at" | "status" | "scheduled_event_name"
>;
type AdminAnalyticsClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: AdminAnalyticsClient;
  now?: Date;
};

export type AdminAnalyticsBreakdownRow = {
  label: string;
  count: number;
};

export type AdminAnalyticsDailyTrendRow = {
  date: string;
  leads: number;
  bookings: number;
};

export type AdminAnalyticsTotals = {
  leads90d: number;
  leadsAllTime: number;
  bookings90d: number;
  bookingRatePct: number;
};

export type AdminAnalytics = {
  totals: AdminAnalyticsTotals;
  leadsBySourcePath: AdminAnalyticsBreakdownRow[];
  leadsByUtmSource: AdminAnalyticsBreakdownRow[];
  bookingsByCalendar: AdminAnalyticsBreakdownRow[];
  dailyTrend: AdminAnalyticsDailyTrendRow[];
  bookingsConnected: boolean;
};

export class AdminAnalyticsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAnalyticsServiceError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * DAY_MS;
const TREND_DAYS = 14;
const TOP_N = 12;

const LEAD_ANALYTICS_FIELDS = "id,created_at,source_path,utm_source" as const;
const BOOKING_ANALYTICS_FIELDS =
  "id,created_at,status,scheduled_event_name" as const;

/**
 * Read-only rollups powering the /admin/analytics dashboard: leads and
 * bookings for the last 90 days, grouped by source/UTM/calendar, plus a
 * 14-day trend. Mirrors the fetch-then-group-in-JS pattern used by
 * admin-overview.ts and lead-admin.ts — this repo has no read-side SQL RPC.
 *
 * The calendly_bookings table may not be migrated into the live database
 * yet, so the bookings query is resilient: any error there (missing
 * relation, code 42P01, or otherwise) degrades to empty booking data with
 * `bookingsConnected: false` instead of throwing. Leads are expected to
 * always work; a leads query error throws AdminAnalyticsServiceError.
 */
export async function getAdminAnalytics(
  deps: ServiceDeps = {},
): Promise<AdminAnalytics> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();
  const since90dIso = new Date(now.getTime() - NINETY_DAYS_MS).toISOString();

  const [leads, leadsAllTime, bookings] = await Promise.all([
    fetchLeads(client, since90dIso),
    countLeadsAllTime(client),
    fetchBookings(client, since90dIso),
  ]);

  // Only "booked" bookings count toward the conversion rate, the calendar
  // breakdown, and the daily trend — a cancellation isn't a completed
  // booking, so it shouldn't inflate any of those numbers.
  const bookedRows = bookings.rows.filter((row) => row.status === "booked");

  return {
    totals: buildTotals(leads.length, leadsAllTime, bookedRows.length),
    leadsBySourcePath: topN(
      leads.map((lead) => lead.source_path),
      TOP_N,
      "(direct / unknown)",
    ),
    leadsByUtmSource: topN(
      leads.map((lead) => lead.utm_source),
      TOP_N,
      "(none)",
    ),
    bookingsByCalendar: topN(
      bookedRows.map((row) => row.scheduled_event_name),
      TOP_N,
      "(unnamed)",
    ),
    dailyTrend: buildDailyTrend(leads, bookedRows, now, TREND_DAYS),
    bookingsConnected: bookings.connected,
  };
}

async function fetchLeads(
  client: AdminAnalyticsClient,
  sinceIso: string,
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_ANALYTICS_FIELDS)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminAnalyticsServiceError("Could not load leads for analytics.");
  }
  return (data ?? []) as LeadAnalyticsRow[];
}

async function countLeadsAllTime(
  client: AdminAnalyticsClient,
): Promise<number> {
  const { count, error } = await client
    .from("lead_submissions")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new AdminAnalyticsServiceError(
      "Could not count all-time leads for analytics.",
    );
  }
  return count ?? 0;
}

type BookingsFetchResult = {
  rows: BookingAnalyticsRow[];
  connected: boolean;
};

async function fetchBookings(
  client: AdminAnalyticsClient,
  sinceIso: string,
): Promise<BookingsFetchResult> {
  try {
    const { data, error } = await client
      .from("calendly_bookings")
      .select(BOOKING_ANALYTICS_FIELDS)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true });

    if (error) {
      // Most commonly Postgres 42P01 (relation does not exist) before the
      // calendly_bookings migration + webhook are wired into an
      // environment — but any error here degrades gracefully rather than
      // breaking the whole dashboard.
      return { rows: [], connected: false };
    }
    return { rows: (data ?? []) as BookingAnalyticsRow[], connected: true };
  } catch {
    return { rows: [], connected: false };
  }
}

function buildTotals(
  leads90dCount: number,
  leadsAllTime: number,
  bookings90dCount: number,
): AdminAnalyticsTotals {
  const bookingRatePct =
    leads90dCount > 0 ? (bookings90dCount / leads90dCount) * 100 : 0;

  return {
    leads90d: leads90dCount,
    leadsAllTime,
    bookings90d: bookings90dCount,
    bookingRatePct,
  };
}

function topN(
  values: Array<string | null>,
  limit: number,
  fallbackLabel: string,
): AdminAnalyticsBreakdownRow[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const label = normalizeLabel(value, fallbackLabel);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function normalizeLabel(
  value: string | null | undefined,
  fallbackLabel: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallbackLabel;
}

function buildDailyTrend(
  leads: LeadAnalyticsRow[],
  bookedRows: BookingAnalyticsRow[],
  now: Date,
  days: number,
): AdminAnalyticsDailyTrendRow[] {
  const orderedDayKeys: string[] = [];
  const buckets = new Map<string, { leads: number; bookings: number }>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = dayKey(new Date(now.getTime() - offset * DAY_MS));
    orderedDayKeys.push(key);
    buckets.set(key, { leads: 0, bookings: 0 });
  }

  for (const lead of leads) {
    const bucket = buckets.get(dayKey(new Date(lead.created_at)));
    if (bucket) bucket.leads += 1;
  }

  for (const row of bookedRows) {
    const bucket = buckets.get(dayKey(new Date(row.created_at)));
    if (bucket) bucket.bookings += 1;
  }

  return orderedDayKeys.map((date) => {
    const bucket = buckets.get(date);
    return {
      date,
      leads: bucket?.leads ?? 0,
      bookings: bucket?.bookings ?? 0,
    };
  });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
