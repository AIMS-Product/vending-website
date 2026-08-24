import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveChannel } from "@/lib/analytics/channel";
import { CHATBOT_LEAD_SOURCE } from "@/lib/chatbot/lead-capture";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";
import { isInternalLead } from "@/lib/services/admin-analytics-internal";
import {
  buildAcquisitionRollup,
  buildPagesRollup,
  buildQualityRollup,
  type AcquisitionRollup,
  type AnalyticsLeadRow,
  type PagesRollup,
  type QualityRollup,
} from "@/lib/services/admin-analytics-detail";
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
  | "landing_path"
  | "referrer"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "timeline"
  | "budget"
  | "business_stage"
  | "state_region"
  | "lifecycle_status"
  | "close_sync_status"
  | "qualification_summary"
  | "latest_qualification_form_id"
  | "latest_qualification_started_at"
  | "latest_qualification_completed_at"
  | "call_booked_at"
  | "metadata"
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
  /** Leads in this row that went on to book a call, when known. */
  booked?: number;
  /**
   * Sub-rows that roll up into this one — used to keep per-person credit for
   * tagged links (mike-ig) visible under their platform total (Instagram).
   */
  children?: AdminAnalyticsBreakdownRow[];
};

export type AdminAnalyticsDailyTrendRow = {
  date: string;
  leads: number;
  bookings: number;
};

/**
 * A headline number with the context needed to read it: the same measure over
 * the immediately preceding window of equal length. `deltaPct` is null when the
 * prior window is zero — a percentage against zero is not meaningful, so the UI
 * names the state instead.
 *
 * There is no per-metric series here. The KPI cards used to carry a 72px
 * sparkline of one, but `dailyTrend` already plots the same data full width on
 * the same page, and a rate metric has no series to plot at all.
 */
export type AdminAnalyticsMetric = {
  value: number;
  prior: number;
  deltaPct: number | null;
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
  leadsByChannel: AdminAnalyticsBreakdownRow[];
  bookingsByCalendar: AdminAnalyticsBreakdownRow[];
  dailyTrend: AdminAnalyticsDailyTrendRow[];
  bookingsConnected: boolean;
  acquisition: AcquisitionRollup;
  pages: PagesRollup;
  quality: QualityRollup;
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
  "id,created_at,email,full_name,source_path,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_term,utm_content,timeline,budget,business_stage,state_region,lifecycle_status,close_sync_status,qualification_summary,latest_qualification_form_id,latest_qualification_started_at,latest_qualification_completed_at,call_booked_at,metadata" as const;
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

  // Whether a lead booked a call is read from Close (mirrored onto
  // call_booked_at by the booking reconciler), NOT from the Calendly table.
  // Close covers every calendar -- including phone, Saleskick and direct links
  // this site never renders -- and joins on close_lead_id rather than guessing
  // by invitee email, so it is both complete and exact. The Calendly rows below
  // survive only to describe WHICH calendar a booking landed on.
  const currentBooked = current.filter(hasBookedCall);
  const priorBooked = prior.filter(hasBookedCall);
  const bookedInRange = booked.filter((row) =>
    inWindow(row.created_at, start, end),
  );
  const attributedInRange = attributed.filter((row) =>
    inWindow(row.created_at, start, end),
  );

  const qualifiedCurrent = current.filter(isQualified);
  const qualifiedPrior = prior.filter(isQualified);

  // Detail tabs describe the SELECTED window only — the prior window is fetched
  // for comparison arithmetic, not for the breakdowns.
  const detailRows = current as unknown as AnalyticsLeadRow[];

  // The pure rollups (acquisition, pages) match on lead email, so reduce the
  // booked leads to that key.
  const bookedEmails = new Set(
    currentBooked
      .map((lead) => lead.email?.trim().toLowerCase() ?? "")
      .filter((email): email is string => Boolean(email)),
  );

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
      leads: buildMetric(current, prior),
      qualified: buildMetric(qualifiedCurrent, qualifiedPrior),
      bookedFromLeads: buildMetric(currentBooked, priorBooked),
      bookingRatePct: buildRateMetric(
        currentBooked.length,
        current.length,
        priorBooked.length,
        prior.length,
      ),
    },
    bookingsTotal: bookedInRange.length,
    bookingsUnattributed: bookedInRange.length - attributedInRange.length,
    leadsAllTime,
    leadsBySourcePath: topNWithBookings(
      current,
      (lead) => lead.source_path,
      TOP_N,
      "(direct / unknown)",
    ),
    leadsByChannel: buildChannelRollup(current, TOP_N),
    bookingsByCalendar: topN(
      bookedInRange.map((row) => row.scheduled_event_name),
      TOP_N,
      "(unnamed)",
    ),
    dailyTrend: buildDailyTrend(current, currentBooked, end, days),
    bookingsConnected: bookings.connected,
    acquisition: buildAcquisitionRollup(detailRows, bookedEmails),
    pages: buildPagesRollup(detailRows, bookedEmails),
    quality: buildQualityRollup(detailRows),
  };
}

/**
 * A lead booked a sales call at some point. Mirrored from Close's "First Call
 * Booked Date", so it stays true for a lead that later no-showed or cancelled —
 * the booking still happened, and that is what a funnel measures.
 */
function hasBookedCall(lead: LeadAnalyticsRow): boolean {
  return Boolean(lead.call_booked_at);
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
): AdminAnalyticsMetric {
  return {
    value: current.length,
    prior: prior.length,
    deltaPct: percentChange(current.length, prior.length),
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
  };
}

function ratePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * The smallest prior-window count a percentage may be computed against.
 *
 * Below this the ratio is noise: the site cut over on 2026-07-27 and lead
 * capture only starts 2026-07-06, so a 30-day comparison reaches back into a
 * window with almost no data and reports things like "+17,533%" off a base of
 * three. A missing comparison is honest; a spectacular meaningless one is not.
 */
const MIN_COMPARABLE_PRIOR = 10;

function percentChange(value: number, prior: number): number | null {
  if (prior < MIN_COMPARABLE_PRIOR) return null;
  return Math.round(((value - prior) / prior) * 1000) / 10;
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

/**
 * Safety valve, not a display cap. Every rollup on this page groups rows in
 * Node, so the `1y` range pulls two years of leads — 23 columns each, including
 * a JSON summary — into the function's memory. That is survivable at today's
 * volume and is not survivable forever, and the failure mode without a ceiling
 * is the function dying rather than the page being wrong.
 *
 * Set far above real volume: hitting it means the numbers below it are
 * understated, which is why it logs. The real fix is grouping in Postgres,
 * which needs an RPC and therefore a migration.
 */
const MAX_ANALYTICS_LEAD_ROWS = 50_000;

async function fetchLeads(
  client: AdminAnalyticsClient,
  sinceIso: string,
): Promise<LeadAnalyticsRow[]> {
  const { data, error } = await client
    .from("lead_submissions")
    .select(LEAD_ANALYTICS_FIELDS)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(MAX_ANALYTICS_LEAD_ROWS);

  if (error) {
    throw new AdminAnalyticsServiceError("Could not load leads for analytics.");
  }
  const rows = (data ?? []) as LeadAnalyticsRow[];
  if (rows.length >= MAX_ANALYTICS_LEAD_ROWS) {
    console.warn("admin analytics lead read hit its row ceiling", {
      limit: MAX_ANALYTICS_LEAD_ROWS,
      since: sinceIso,
    });
  }
  return rows;
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

/**
 * Same shape as topN, but each row also carries how many of its leads booked a
 * call — the number the team actually manages to, rather than raw volume.
 */
function topNWithBookings(
  leads: LeadAnalyticsRow[],
  keyOf: (lead: LeadAnalyticsRow) => string | null,
  limit: number,
  fallbackLabel: string,
): AdminAnalyticsBreakdownRow[] {
  const groups = new Map<string, { count: number; booked: number }>();

  for (const lead of leads) {
    const label = normalizeLabel(keyOf(lead), fallbackLabel);
    const group = groups.get(label) ?? { count: 0, booked: 0 };
    group.count += 1;
    if (hasBookedCall(lead)) group.booked += 1;
    groups.set(label, group);
  }

  return [...groups.entries()]
    .map(([label, group]) => ({ label, ...group }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Leads grouped by canonical channel, with per-person tagged links kept as
 * sub-rows of the platform they belong to.
 *
 * Raw utm_source values fragment badly — "Instagram" and "instagram" were two
 * rows, and "mike-ig" hid another third of Instagram's volume — so grouping on
 * the raw value understated every channel that more than one person tags links
 * for. Untagged leads resolve to Website; see resolveChannel.
 */
/**
 * Chatbot-captured leads are tagged on `metadata.source`, not on entry_source
 * (a strict-choices field in Close the chatbot path deliberately leaves alone)
 * and not on utm_source (which stays the visitor's real campaign).
 */
function isChatbotLead(lead: LeadAnalyticsRow): boolean {
  const metadata = lead.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).source === CHATBOT_LEAD_SOURCE;
}

function buildChannelRollup(
  leads: LeadAnalyticsRow[],
  limit: number,
): AdminAnalyticsBreakdownRow[] {
  type Group = {
    count: number;
    booked: number;
    people: Map<string, { count: number; booked: number }>;
  };
  const groups = new Map<string, Group>();

  for (const lead of leads) {
    const { channel, person } = resolveChannel(lead.utm_source, {
      capturedByChatbot: isChatbotLead(lead),
    });
    const group = groups.get(channel) ?? {
      count: 0,
      booked: 0,
      people: new Map(),
    };
    const booked = hasBookedCall(lead);
    group.count += 1;
    if (booked) group.booked += 1;

    if (person) {
      const owned = group.people.get(person) ?? { count: 0, booked: 0 };
      owned.count += 1;
      if (booked) owned.booked += 1;
      group.people.set(person, owned);
    }
    groups.set(channel, group);
  }

  return [...groups.entries()]
    .map(([label, group]) => ({
      label,
      count: group.count,
      booked: group.booked,
      children: [...group.people.entries()]
        .map(([person, owned]) => ({ label: person, ...owned }))
        .sort((a, b) => b.count - a.count),
    }))
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
