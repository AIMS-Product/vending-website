import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  ADMIN_ANALYTICS_RANGES,
  DEFAULT_ADMIN_ANALYTICS_RANGE,
  type AdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";

type LeadRow = Tables<"lead_submissions">;
type BookingRow = Tables<"calendly_bookings">;

type LeadAnalyticsRow = Pick<
  LeadRow,
  | "id"
  | "created_at"
  | "email"
  | "full_name"
  | "source_path"
  | "utm_source"
  | "lifecycle_status"
>;

type BookingAnalyticsRow = Pick<
  BookingRow,
  | "id"
  | "created_at"
  | "status"
  | "scheduled_event_name"
  | "invitee_email"
  | "lead_submission_id"
>;

type AdminAnalyticsClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: AdminAnalyticsClient;
  now?: Date;
};

export type GetAdminAnalyticsInput = {
  range?: AdminAnalyticsRangeKey;
  includeInternal?: boolean;
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

/**
 * A headline number with the context needed to read it: the same measure over
 * the immediately preceding window of equal length, and a per-day series for a
 * sparkline. `deltaPct` is null when the prior window is zero — a percentage
 * against zero is not meaningful, so the UI shows the absolute change instead.
 */
export type AdminAnalyticsMetric = {
  value: number;
  prior: number;
  deltaPct: number | null;
  spark: number[];
};

export type AdminAnalytics = {
  range: {
    key: AdminAnalyticsRangeKey;
    label: string;
    days: number;
    startIso: string;
    endIso: string;
  };
  includeInternal: boolean;
  internalExcluded: number;
  metrics: {
    leads: AdminAnalyticsMetric;
    qualified: AdminAnalyticsMetric;
    bookedFromLeads: AdminAnalyticsMetric;
    bookingRatePct: AdminAnalyticsMetric;
  };
  bookingsTotal: number;
  bookingsUnattributed: number;
  leadsAllTime: number;
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
const TOP_N = 12;

const LEAD_ANALYTICS_FIELDS =
  "id,created_at,email,full_name,source_path,utm_source,lifecycle_status" as const;
const BOOKING_ANALYTICS_FIELDS =
  "id,created_at,status,scheduled_event_name,invitee_email,lead_submission_id" as const;

/**
 * Read-only rollups powering /admin/analytics.
 *
 * Two windows are fetched in one query — the selected range and the equal-length
 * window immediately before it — so every headline number carries a comparison
 * instead of standing alone.
 *
 * A booking counts toward the conversion rate only when it can be tied back to a
 * lead this site captured (FK, or invitee email matching a lead). Calendly also
 * receives bookings from Saleskick, phone, and direct links; dividing ALL of them
 * by website leads produced the "1343% booking rate" this replaced. The
 * unattributed remainder stays visible as its own number rather than disappearing.
 *
 * The calendly_bookings table may not exist in every environment, so a bookings
 * error degrades to empty data with `bookingsConnected: false`. A leads error
 * throws — leads are the point of the page.
 */
export async function getAdminAnalytics(
  input: GetAdminAnalyticsInput & ServiceDeps = {},
): Promise<AdminAnalytics> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const rangeKey = input.range ?? DEFAULT_ADMIN_ANALYTICS_RANGE;
  const includeInternal = input.includeInternal ?? false;

  const { label, days } = ADMIN_ANALYTICS_RANGES[rangeKey];
  const end = now;
  const start = new Date(end.getTime() - days * DAY_MS);
  const priorStart = new Date(start.getTime() - days * DAY_MS);

  const [leadRows, leadsAllTime, bookings] = await Promise.all([
    fetchLeads(client, priorStart.toISOString()),
    countLeadsAllTime(client),
    fetchBookings(client, priorStart.toISOString()),
  ]);

  const internalExcluded = leadRows.filter((lead) =>
    isInternalLead(lead.email, lead.full_name),
  ).length;

  const leads = includeInternal
    ? leadRows
    : leadRows.filter((lead) => !isInternalLead(lead.email, lead.full_name));

  const current = leads.filter((lead) => inWindow(lead.created_at, start, end));
  const prior = leads.filter((lead) =>
    inWindow(lead.created_at, priorStart, start),
  );

  // Cancellations are not completed bookings, so they never count anywhere.
  const booked = bookings.rows.filter((row) => row.status === "booked");
  const leadEmails = new Set(
    leads.map((lead) => lead.email?.trim().toLowerCase()).filter(Boolean),
  );
  const attributed = booked.filter((row) =>
    isAttributedBooking(row, leadEmails),
  );

  const currentBooked = attributed.filter((row) =>
    inWindow(row.created_at, start, end),
  );
  const priorBooked = attributed.filter((row) =>
    inWindow(row.created_at, priorStart, start),
  );
  const bookedInRange = booked.filter((row) =>
    inWindow(row.created_at, start, end),
  );

  const qualifiedCurrent = current.filter(isQualified);
  const qualifiedPrior = prior.filter(isQualified);

  return {
    range: {
      key: rangeKey,
      label,
      days,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    },
    includeInternal,
    internalExcluded,
    metrics: {
      leads: buildMetric(current, prior, start, end, days),
      qualified: buildMetric(
        qualifiedCurrent,
        qualifiedPrior,
        start,
        end,
        days,
      ),
      bookedFromLeads: buildMetric(
        currentBooked,
        priorBooked,
        start,
        end,
        days,
      ),
      bookingRatePct: buildRateMetric(
        currentBooked.length,
        current.length,
        priorBooked.length,
        prior.length,
      ),
    },
    bookingsTotal: bookedInRange.length,
    bookingsUnattributed: bookedInRange.length - currentBooked.length,
    leadsAllTime,
    leadsBySourcePath: topN(
      current.map((lead) => lead.source_path),
      TOP_N,
      "(direct / unknown)",
    ),
    leadsByUtmSource: topN(
      current.map((lead) => lead.utm_source),
      TOP_N,
      "(none)",
    ),
    bookingsByCalendar: topN(
      bookedInRange.map((row) => row.scheduled_event_name),
      TOP_N,
      "(unnamed)",
    ),
    dailyTrend: buildDailyTrend(current, currentBooked, end, days),
    bookingsConnected: bookings.connected,
  };
}

/** Half-open [start, end) so a row is never counted in two adjacent windows. */
function inWindow(createdAt: string, start: Date, end: Date): boolean {
  const time = new Date(createdAt).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function isQualified(lead: LeadAnalyticsRow): boolean {
  return lead.lifecycle_status === "qualified";
}

function isAttributedBooking(
  row: BookingAnalyticsRow,
  leadEmails: ReadonlySet<string | undefined>,
): boolean {
  if (row.lead_submission_id) return true;
  const email = row.invitee_email?.trim().toLowerCase();
  return Boolean(email && leadEmails.has(email));
}

type DatedRow = { created_at: string };

function buildMetric(
  current: DatedRow[],
  prior: DatedRow[],
  start: Date,
  end: Date,
  days: number,
): AdminAnalyticsMetric {
  return {
    value: current.length,
    prior: prior.length,
    deltaPct: percentChange(current.length, prior.length),
    spark: buildSpark(current, start, end, days),
  };
}

function buildRateMetric(
  currentBooked: number,
  currentLeads: number,
  priorBooked: number,
  priorLeads: number,
): AdminAnalyticsMetric {
  const value = ratePct(currentBooked, currentLeads);
  const prior = ratePct(priorBooked, priorLeads);
  return {
    value,
    prior,
    deltaPct: percentChange(value, prior),
    spark: [],
  };
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function percentChange(value: number, prior: number): number | null {
  if (prior <= 0) return null;
  return Math.round(((value - prior) / prior) * 1000) / 10;
}

/**
 * Per-bucket counts across the range. Long ranges are compressed into wider
 * buckets so a year does not render 365 one-pixel bars.
 */
function buildSpark(
  rows: DatedRow[],
  start: Date,
  end: Date,
  days: number,
): number[] {
  const buckets = Math.min(days, 30);
  const span = Math.max(1, end.getTime() - start.getTime());
  const counts = new Array<number>(buckets).fill(0);

  for (const row of rows) {
    const offset = new Date(row.created_at).getTime() - start.getTime();
    const index = Math.min(
      buckets - 1,
      Math.max(0, Math.floor((offset / span) * buckets)),
    );
    counts[index] += 1;
  }
  return counts;
}

function buildDailyTrend(
  leads: DatedRow[],
  bookings: DatedRow[],
  end: Date,
  days: number,
): AdminAnalyticsDailyTrendRow[] {
  // Cap the plotted series so a year-long range stays readable; each bucket is
  // still one calendar day for every range up to 60 days.
  //
  // Buckets are the last N CALENDAR days ending today (inclusive) rather than
  // slices of the rolling window, so the newest bar is always today. The
  // rolling window starts mid-day, so the oldest bar can hold slightly fewer
  // rows than the headline count — the chart shows shape, the KPI shows totals.
  const plottedDays = Math.min(days, 60);
  const today = new Date(`${dayKey(end)}T00:00:00.000Z`);
  const firstDay = new Date(today.getTime() - (plottedDays - 1) * DAY_MS);

  const orderedDayKeys: string[] = [];
  const buckets = new Map<string, { leads: number; bookings: number }>();

  for (let offset = 0; offset < plottedDays; offset += 1) {
    const key = dayKey(new Date(firstDay.getTime() + offset * DAY_MS));
    orderedDayKeys.push(key);
    buckets.set(key, { leads: 0, bookings: 0 });
  }

  for (const lead of leads) {
    const bucket = buckets.get(dayKey(new Date(lead.created_at)));
    if (bucket) bucket.leads += 1;
  }
  for (const row of bookings) {
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
      // calendly_bookings migration + webhook are wired into an environment.
      return { rows: [], connected: false };
    }
    return { rows: (data ?? []) as BookingAnalyticsRow[], connected: true };
  } catch {
    return { rows: [], connected: false };
  }
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

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
