/**
 * Per-video YouTube rollups.
 *
 * Pure and free of `server-only` on purpose, same split as
 * `admin-analytics-detail.ts`: the arithmetic that decides what Kody reads is
 * the part worth testing, and it should not need a database to run.
 *
 * The one rule running through all of it: a stage we cannot measure reports
 * `null`, never `0`. A video with no Bitly sync has unknown clicks, and showing
 * "0 clicks → 4 leads" as a conversion rate of infinity, or of zero, invents a
 * number nobody can act on.
 */

import { resolveChannel } from "@/lib/analytics/channel";

/** Channel label `resolveChannel` maps every YouTube tag onto. */
export const YOUTUBE_CHANNEL = "YouTube";

/** Close labels are the only source for a call outcome; see the migration. */
export type CallOutcome =
  "no_show" | "canceled" | "rescheduled" | "contract_sent" | "won";

export type YouTubeLeadRow = {
  id: string;
  created_at: string;
  email: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  lifecycle_status: string | null;
  call_booked_at: string | null;
  call_outcome: string | null;
  closed_won_at: string | null;
  closed_won_source: string | null;
  metadata: unknown;
};

export type YouTubeVideoRow = {
  utm_campaign: string;
  title: string;
  video_url: string | null;
  published_at: string | null;
  bitly_id: string | null;
  in_description: boolean | null;
};

export type BitlyClickRow = {
  utm_campaign: string | null;
  day: string;
  clicks: number;
};

export type PageViewRow = {
  /**
   * Needed because both visit sources store every tagged channel, not just
   * YouTube. Without it a Meta campaign's traffic lands in this funnel.
   */
  utm_source: string | null;
  utm_campaign: string | null;
  occurred_at: string;
  /**
   * Visits this row represents.
   *
   * `lead_page_views` is one row per visit and leaves this undefined, which
   * counts as 1. `ga4_page_views` is a daily aggregate and carries the real
   * count — treating one of its rows as a single visit would report 2 visits
   * where GA4 measured 569.
   */
  views?: number;
};

/**
 * One video's funnel. Every `null` is "not measured yet" rather than zero, and
 * every percentage is null when its denominator is unmeasured.
 */
export type YouTubeVideoFunnelRow = {
  utmCampaign: string;
  title: string;
  videoUrl: string | null;
  publishedAt: string | null;
  inRegistry: boolean;
  clicks: number | null;
  visits: number | null;
  leads: number;
  qualified: number;
  booked: number;
  /** Null until the Close outcome columns exist; see `outcomesConnected`. */
  attended: number | null;
  closed: number | null;
  clickToLeadPct: number | null;
  visitToLeadPct: number | null;
  leadToBookedPct: number | null;
  bookedToClosedPct: number | null;
  avgDaysToClose: number | null;
};

export type YouTubeStage = {
  label: string;
  count: number | null;
  ofPreviousPct: number | null;
  note?: string;
};

export type YouTubeTimeToCloseBucket = {
  label: string;
  count: number;
};

export type YouTubeTimeToClose = {
  buckets: YouTubeTimeToCloseBucket[];
  measured: number;
  /** Won leads with no trustworthy close date, so excluded from the durations. */
  undated: number;
  medianDays: number | null;
  avgDays: number | null;
  /** Kody's threshold: cycles that run past a fortnight. */
  longCycleCount: number;
};

export type YouTubeCohortRow = {
  /** First-touch month, `YYYY-MM`. */
  month: string;
  leads: number;
  booked: number;
  closed: number;
  closedSameMonth: number;
  closedLaterMonth: number;
};

/**
 * `ga4`: `ga4_page_views`, GA4 sessions by Pacific day, history from 2026-02-26.
 * `site`: `lead_page_views`, the site's own visit event, history from 2026-09-10.
 */
export type YouTubeVisitsSource = "ga4" | "site";

export type YouTubeCoverage = {
  registryVideos: number;
  videosWithLeads: number;
  campaignsMissingFromRegistry: string[];
  clicksConnected: boolean;
  visitsConnected: boolean;
  /** Which table the visits stage read. Null when it is not connected. */
  visitsSource: YouTubeVisitsSource | null;
  /** False until the migration adding closed_won_at / call_outcome is applied. */
  outcomesConnected: boolean;
  /** Leads whose booking predates the form fill — a returning lead, not a cycle. */
  bookedBeforeLead: number;
};

export type YouTubeAttributionRollup = {
  totals: {
    clicks: number | null;
    visits: number | null;
    leads: number;
    qualified: number;
    booked: number;
    attended: number | null;
    closed: number | null;
  };
  stages: YouTubeStage[];
  videos: YouTubeVideoFunnelRow[];
  timeToClose: YouTubeTimeToClose;
  cohorts: YouTubeCohortRow[];
  coverage: YouTubeCoverage;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME_TO_CLOSE_BUCKETS: Array<{ label: string; max: number }> = [
  { label: "0-7 days", max: 7 },
  { label: "8-14 days", max: 14 },
  { label: "15-21 days", max: 21 },
  { label: "22-30 days", max: 30 },
  { label: "30+ days", max: Number.POSITIVE_INFINITY },
];

/** Every YouTube tag, including `yt` and person-tagged variants like `mike-yt`. */
export function isYouTubeLead(lead: YouTubeLeadRow): boolean {
  return isYouTubeSource(lead.utm_source);
}

/** The one channel rule, shared by leads and by landing-page visits. */
export function isYouTubeSource(utmSource: string | null): boolean {
  return resolveChannel(utmSource).channel === YOUTUBE_CHANNEL;
}

export function buildYouTubeAttribution({
  leads,
  videos,
  clicks,
  pageViews,
  clicksConnected,
  visitsConnected,
  visitsSource = null,
  outcomesConnected,
}: {
  leads: YouTubeLeadRow[];
  videos: YouTubeVideoRow[];
  clicks: BitlyClickRow[];
  pageViews: PageViewRow[];
  clicksConnected: boolean;
  visitsConnected: boolean;
  visitsSource?: YouTubeVisitsSource | null;
  outcomesConnected: boolean;
}): YouTubeAttributionRollup {
  const youtubeLeads = leads.filter(isYouTubeLead);
  const byCampaign = groupByCampaign(youtubeLeads);
  const videoByCampaign = new Map(
    videos.map((video) => [video.utm_campaign, video]),
  );
  const clicksByCampaign = sumByCampaign(clicks, (row) => row.clicks);
  const viewsByCampaign = sumByCampaign(
    pageViews.filter((view) => isYouTubeSource(view.utm_source)),
    (view) => view.views ?? 1,
  );

  const rows = [...byCampaign.entries()]
    .map(([campaign, campaignLeads]) =>
      buildVideoRow({
        campaign,
        leads: campaignLeads,
        video: videoByCampaign.get(campaign),
        clicks: clicksConnected ? (clicksByCampaign.get(campaign) ?? 0) : null,
        visits: visitsConnected ? (viewsByCampaign.get(campaign) ?? 0) : null,
        outcomesConnected,
      }),
    )
    .sort((a, b) => b.leads - a.leads || a.title.localeCompare(b.title));

  const totals = {
    clicks: clicksConnected ? sumValues(clicksByCampaign) : null,
    visits: visitsConnected ? sumValues(viewsByCampaign) : null,
    leads: youtubeLeads.length,
    qualified: youtubeLeads.filter(isQualified).length,
    booked: youtubeLeads.filter(hasBooked).length,
    attended: outcomesConnected ? countAttended(youtubeLeads) : null,
    closed: outcomesConnected ? youtubeLeads.filter(isClosedWon).length : null,
  };

  return {
    totals,
    stages: buildStages(totals),
    videos: rows,
    timeToClose: buildTimeToClose(outcomesConnected ? youtubeLeads : []),
    cohorts: buildCohorts(youtubeLeads),
    coverage: {
      registryVideos: videos.length,
      videosWithLeads: rows.length,
      campaignsMissingFromRegistry: rows
        .filter((row) => !row.inRegistry)
        .map((row) => row.utmCampaign),
      clicksConnected,
      visitsConnected,
      visitsSource: visitsConnected ? visitsSource : null,
      outcomesConnected,
      bookedBeforeLead: youtubeLeads.filter(bookedBeforeLead).length,
    },
  };
}

function buildVideoRow({
  campaign,
  leads,
  video,
  clicks,
  visits,
  outcomesConnected,
}: {
  campaign: string;
  leads: YouTubeLeadRow[];
  video: YouTubeVideoRow | undefined;
  clicks: number | null;
  visits: number | null;
  outcomesConnected: boolean;
}): YouTubeVideoFunnelRow {
  const booked = leads.filter(hasBooked).length;
  const closed = outcomesConnected ? leads.filter(isClosedWon).length : null;
  const durations = outcomesConnected ? closeDurations(leads) : [];

  return {
    utmCampaign: campaign,
    // An unmatched slug shows as itself. Substituting a similar registry title
    // would put the wrong video's name on someone's report.
    title: video?.title ?? campaign,
    videoUrl: video?.video_url ?? null,
    publishedAt: video?.published_at ?? null,
    inRegistry: Boolean(video),
    clicks,
    visits,
    leads: leads.length,
    qualified: leads.filter(isQualified).length,
    booked,
    attended: outcomesConnected ? countAttended(leads) : null,
    closed,
    clickToLeadPct: ratePct(leads.length, clicks),
    visitToLeadPct: ratePct(leads.length, visits),
    leadToBookedPct: ratePct(booked, leads.length),
    bookedToClosedPct: ratePct(closed, booked),
    avgDaysToClose: durations.length ? round1(mean(durations)) : null,
  };
}

/**
 * The six stages, top to bottom.
 *
 * `ofPreviousPct` is null whenever either side is unmeasured, so an
 * unconnected Bitly sync leaves a gap in the chart instead of a 0% that reads
 * as "nobody clicked".
 */
function buildStages(totals: {
  clicks: number | null;
  visits: number | null;
  leads: number;
  booked: number;
  attended: number | null;
  closed: number | null;
}): YouTubeStage[] {
  const steps: Array<{ label: string; count: number | null; note?: string }> = [
    { label: "Link clicks", count: totals.clicks, note: "Bitly" },
    { label: "Landing page visits", count: totals.visits },
    { label: "Leads captured", count: totals.leads },
    { label: "Booked a call", count: totals.booked },
    {
      label: "Attended the call",
      count: totals.attended,
      note: "booked minus no-show and cancelled",
    },
    { label: "Closed / won", count: totals.closed },
  ];

  return steps.map((step, index) => {
    const previous = index > 0 ? (steps[index - 1]?.count ?? null) : null;
    return {
      label: step.label,
      count: step.count,
      ofPreviousPct: index === 0 ? null : ratePct(step.count, previous),
      ...(step.note ? { note: step.note } : {}),
    };
  });
}

/**
 * Days from first touch to the won date, bucketed.
 *
 * Only `close_opportunity` dates are counted. A `status_observed` date is the
 * day we noticed the label, which for a deal won before this shipped would
 * report a cycle of zero days and drag the median down — so those rows are
 * reported as `undated` instead of being quietly averaged in.
 */
function buildTimeToClose(leads: YouTubeLeadRow[]): YouTubeTimeToClose {
  const durations = closeDurations(leads);
  const won = leads.filter(isClosedWon);
  const counts = new Map(TIME_TO_CLOSE_BUCKETS.map((b) => [b.label, 0]));

  for (const days of durations) {
    const bucket = TIME_TO_CLOSE_BUCKETS.find((b) => days <= b.max);
    if (bucket) counts.set(bucket.label, (counts.get(bucket.label) ?? 0) + 1);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  return {
    buckets: TIME_TO_CLOSE_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: counts.get(bucket.label) ?? 0,
    })),
    measured: durations.length,
    undated: won.length - durations.length,
    medianDays: sorted.length ? median(sorted) : null,
    avgDays: durations.length ? round1(mean(durations)) : null,
    longCycleCount: durations.filter((days) => days >= 14).length,
  };
}

/**
 * Leads grouped by the month they FIRST touched the site, not the month the row
 * was created.
 *
 * Verified on production: 49 of 244 YouTube leads first landed on a different
 * day than they submitted, some 42 days earlier. Grouping on `created_at` would
 * credit those to the wrong month, which is the reporting distortion this view
 * exists to fix.
 */
function buildCohorts(leads: YouTubeLeadRow[]): YouTubeCohortRow[] {
  const groups = new Map<string, YouTubeLeadRow[]>();

  for (const lead of leads) {
    const month = monthKey(firstTouchAt(lead));
    groups.set(month, [...(groups.get(month) ?? []), lead]);
  }

  return [...groups.entries()]
    .map(([month, rows]) => {
      const won = rows.filter(isClosedWon);
      const dated = won.filter((lead) => lead.closed_won_at);
      return {
        month,
        leads: rows.length,
        booked: rows.filter(hasBooked).length,
        closed: won.length,
        closedSameMonth: dated.filter(
          (lead) => monthKey(lead.closed_won_at!) === month,
        ).length,
        closedLaterMonth: dated.filter(
          (lead) => monthKey(lead.closed_won_at!) > month,
        ).length,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Trustworthy close durations in days.
 *
 * Negative durations are dropped, not clamped: 3 of 155 booked YouTube leads
 * have a Close booking date that predates their first touch, because Close
 * already held them before they came through this site. That is a returning
 * lead, not a same-day close, and averaging it in as zero would understate the
 * real cycle.
 *
 * Re-derived against production on 2026-09-10 after the day-key fix. The
 * earlier figure of 20 counted 14 same-day bookings that the instant
 * comparison made negative, plus 3 leads whose first touch predated the form.
 */
function closeDurations(leads: YouTubeLeadRow[]): number[] {
  return leads
    .filter(
      (lead) =>
        lead.closed_won_at && lead.closed_won_source === "close_opportunity",
    )
    .map((lead) => daysBetween(firstTouchAt(lead), lead.closed_won_at!))
    .filter((days): days is number => days !== null && days >= 0);
}

/** `metadata.attribution_session.first_touch_at`, falling back to row creation. */
export function firstTouchAt(lead: YouTubeLeadRow): string {
  const metadata = lead.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const session = (metadata as Record<string, unknown>).attribution_session;
    if (session && typeof session === "object" && !Array.isArray(session)) {
      const value = (session as Record<string, unknown>).first_touch_at;
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return lead.created_at;
}

function hasBooked(lead: YouTubeLeadRow): boolean {
  return Boolean(lead.call_booked_at);
}

function isQualified(lead: YouTubeLeadRow): boolean {
  return lead.lifecycle_status === "qualified";
}

function isClosedWon(lead: YouTubeLeadRow): boolean {
  return Boolean(lead.closed_won_at) || lead.call_outcome === "won";
}

function bookedBeforeLead(lead: YouTubeLeadRow): boolean {
  if (!lead.call_booked_at) return false;
  // First touch, matching the rest of the module: a lead who landed in July and
  // submitted in August did not book "before" they arrived.
  const days = daysBetween(firstTouchAt(lead), lead.call_booked_at);
  return days !== null && days < 0;
}

/**
 * Booked calls the Close label does not disown.
 *
 * Close has no "attended" field, so this is a subtraction, not an observation:
 * the labels that positively assert the call did not happen are removed and the
 * rest are treated as held. Named as a derivation everywhere it surfaces.
 */
function countAttended(leads: YouTubeLeadRow[]): number {
  return leads.filter(
    (lead) =>
      hasBooked(lead) &&
      lead.call_outcome !== "no_show" &&
      lead.call_outcome !== "canceled",
  ).length;
}

function groupByCampaign(
  leads: YouTubeLeadRow[],
): Map<string, YouTubeLeadRow[]> {
  const groups = new Map<string, YouTubeLeadRow[]>();
  for (const lead of leads) {
    const campaign = lead.utm_campaign?.trim() || "(untagged)";
    groups.set(campaign, [...(groups.get(campaign) ?? []), lead]);
  }
  return groups;
}

function sumByCampaign<T extends { utm_campaign: string | null }>(
  rows: T[],
  valueOf: (row: T) => number,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const campaign = row.utm_campaign?.trim();
    if (!campaign) continue;
    totals.set(campaign, (totals.get(campaign) ?? 0) + valueOf(row));
  }
  return totals;
}

function sumValues(totals: Map<string, number>): number {
  let sum = 0;
  for (const value of totals.values()) sum += value;
  return sum;
}

/** Null denominator or a zero one yields null — never a fabricated 0%. */
function ratePct(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator <= 0) return null;
  return round1((numerator / denominator) * 100);
}

/**
 * Whole days between two dates, compared as day keys.
 *
 * `closed_won_at` and `call_booked_at` are Postgres `date` columns, so they
 * parse as UTC midnight, while `firstTouchAt` is a real instant. Comparing the
 * two as instants made every same-day event negative (a first touch at 18:00Z
 * against its own day gives -0.75, which rounds to -1) and knocked a full day
 * off every real duration. Both sides are therefore truncated to their day.
 *
 * Returns null for an unparseable date, so a caller cannot mistake a parse
 * failure for a negative duration.
 *
 * ponytail: day keys are UTC. If Close turns out to date wins in Pacific, a
 * win logged before 5pm PT on the last day of a month is credited to the next
 * UTC day; switch both sides to a business-timezone day key if that matters.
 */
function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / DAY_MS);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return round1(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
