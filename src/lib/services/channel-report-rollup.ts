import { resolveChannel } from "@/lib/analytics/channel";
import type { Tables } from "@/types/database";

/**
 * The Channels tab's arithmetic, pure and client-safe. Reads `channel_daily`
 * rows for a range and the same-length range before it and produces the
 * funnel, the per-dimension table and the sync health rows. Every rate is
 * derived here, never stored, and every sum of nothing-observed is null.
 */

export type ChannelFact = Pick<
  Tables<"channel_daily">,
  | "day"
  | "channel"
  | "source"
  | "medium"
  | "campaign"
  | "content"
  | "destination"
  | "spend"
  | "impressions"
  | "reach"
  | "clicks"
  | "visits"
  | "thankyou_visits"
  | "leads"
  | "booked"
  | "showed"
  | "won"
  | "revenue"
>;

export const METRIC_KEYS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "visits",
  "thankyou_visits",
  "leads",
  "booked",
  "showed",
  "won",
  "revenue",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type Metrics = Record<MetricKey, number | null>;

/**
 * Channels whose stored label is a program, not the traffic source: a webinar
 * row carries source meta_ads but belongs to Webinar. Every other row's
 * channel is re-derived from its source when read, so a change to
 * `resolveChannel` (a new referrer host, a renamed channel) applies to rows
 * written before the change without rewriting the spine.
 */
const PROGRAM_CHANNELS = new Set(["Webinar"]);

export function normaliseFacts(facts: ChannelFact[]): ChannelFact[] {
  return facts.map((fact) => {
    if (PROGRAM_CHANNELS.has(fact.channel)) return fact;
    const channel = resolveChannel(fact.source, {
      medium: fact.medium,
    }).channel;
    return channel === fact.channel ? fact : { ...fact, channel };
  });
}

/**
 * Upstream of the site: what a platform reports about its own surface. Seen
 * is Metricool impressions, YouTube views and GHL sends; Clicked is Bitly and
 * the platforms' own click counts. Each covers a different set of channels,
 * so neither is a stage of the site funnel below.
 */
export const REACH_STAGES: ReadonlyArray<{ key: MetricKey; label: string }> = [
  { key: "impressions", label: "Seen" },
  { key: "clicks", label: "Clicked" },
];

/** The site funnel, top to bottom. Spend and revenue are context, not stages. */
export const FUNNEL_STAGES: ReadonlyArray<{ key: MetricKey; label: string }> = [
  { key: "visits", label: "Visited" },
  { key: "leads", label: "Lead" },
  { key: "booked", label: "Booked a call" },
  { key: "showed", label: "Showed" },
  { key: "won", label: "Won" },
];

export type FunnelStage = {
  key: MetricKey;
  label: string;
  /** Null when no connector observed this stage in the range. */
  value: number | null;
  prior: number | null;
  /**
   * This stage over the nearest observed stage above it, as a percentage,
   * computed only on rows where both were observed so the two sides are one
   * population. Null when no row carries both.
   */
  ofPreviousPct: number | null;
  /** The label of the stage `ofPreviousPct` is measured against. */
  ofPreviousLabel: string | null;
  deltaPct: number | null;
  /** Channels that reported this stage, out of channels with any data. */
  channels: number;
  totalChannels: number;
};

export type ChannelGroupBy = "channel" | "campaign" | "content" | "destination";

export type ChannelReportRow = {
  key: string;
  label: string;
  metrics: Metrics;
  prior: Metrics;
  /**
   * leads ÷ visits, booked ÷ leads, won ÷ booked, each over the rows where
   * both sides were observed. A webinar's 3,000 GHL registrations are not
   * divided by the 400 GA4 visits to our own site; the Instagram bookings that
   * came straight from a Calendly link, with no lead form, are not divided by
   * the leads that did. Null where no row carries both.
   */
  rates: {
    leadPct: number | null;
    bookPct: number | null;
    winPct: number | null;
  };
  /** Bookings with no lead form behind them (direct Calendly links). */
  directBooked: number | null;
  /** spend ÷ leads and spend ÷ booked; null where spend is unobserved or zero. */
  costPerLead: number | null;
  costPerBooked: number | null;
};

export type ChannelReport = {
  totals: Metrics;
  priorTotals: Metrics;
  reach: FunnelStage[];
  funnel: FunnelStage[];
  /** Rows with an outcome or spend, or something a platform reported. */
  rows: ChannelReportRow[];
  /** Rows that only ever had visits (referrers, search engines): collapsed. */
  tail: ChannelReportRow[];
};

/** Sum where at least one value was observed; null when none were. */
export function sumObserved(
  values: Array<number | null | undefined>,
): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (value == null) continue;
    total = (total ?? 0) + value;
  }
  return total;
}

export function sumMetrics(facts: ChannelFact[]): Metrics {
  const out = {} as Metrics;
  for (const key of METRIC_KEYS) {
    out[key] = sumObserved(facts.map((fact) => fact[key]));
  }
  return out;
}

export function pct(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0)
    return null;
  return round1((numerator / denominator) * 100);
}

export function deltaPct(current: number | null, prior: number | null) {
  if (current == null || prior == null || prior === 0) return null;
  return round1(((current - prior) / prior) * 100);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Sums of `a` and `b` over the facts that observed both. */
export function pairedPct(
  facts: ChannelFact[],
  numerator: MetricKey,
  denominator: MetricKey,
): number | null {
  const both = facts.filter(
    (fact) => fact[numerator] != null && fact[denominator] != null,
  );
  if (both.length === 0) return null;
  return pct(
    sumObserved(both.map((fact) => fact[numerator])),
    sumObserved(both.map((fact) => fact[denominator])),
  );
}

/**
 * A rate whose denominator is visits: opt-in, and thank-you conversion.
 *
 * `pairedPct` cannot be used here, and using it was wrong. A spine row only
 * carries `leads` if a lead was actually submitted on that link that day, so
 * "both observed" silently drops every visit-day that converted nobody and
 * averages only over the days that did. Measured on 30 days of production
 * (2026-09-11) it inflated opt-in on every channel: YouTube 35.3% against a
 * true 11.7%, LinkedIn 77.8% against 17.5%, Trustpilot 100% against 14.3%.
 *
 * So the denominator is every visit the group observed, and a visit-day with
 * no lead row counts as the zero leads it was. GA4 reports every session, and
 * the leads connector writes a row per lead, so absence on a visits row is an
 * observation of zero rather than a gap.
 *
 * Null, not zero, when the two sides never meet: a channel with visits and
 * leads that share no row (the chatbot, whose leads arrive mid-conversation
 * with no landing session) has no rate to state. A channel that observed
 * visits and no leads anywhere did convert nobody, and says 0.
 */
export function ofVisitsPct(
  facts: ChannelFact[],
  numerator: MetricKey,
): number | null {
  const visited = facts.filter((fact) => fact.visits != null);
  if (visited.length === 0) return null;
  const observedAnywhere = facts.some((fact) => fact[numerator] != null);
  const overlaps = visited.some((fact) => fact[numerator] != null);
  if (observedAnywhere && !overlaps) return null;
  return pct(
    visited.reduce((sum, fact) => sum + (fact[numerator] ?? 0), 0),
    sumObserved(visited.map((fact) => fact.visits)),
  );
}

function channelsObserving(facts: ChannelFact[], key: MetricKey): number {
  return new Set(
    facts.filter((fact) => fact[key] != null).map((fact) => fact.channel),
  ).size;
}

export function buildStages(
  stages: ReadonlyArray<{ key: MetricKey; label: string }>,
  current: ChannelFact[],
  prior: ChannelFact[],
  options: { shares: boolean },
): FunnelStage[] {
  const totals = sumMetrics(current);
  const priorTotals = sumMetrics(prior);
  const totalChannels = new Set(current.map((fact) => fact.channel)).size;
  let previous: { key: MetricKey; label: string } | null = null;
  return stages.map(({ key, label }) => {
    const value = totals[key];
    const stage: FunnelStage = {
      key,
      label,
      value,
      prior: priorTotals[key],
      ofPreviousPct:
        options.shares && previous
          ? // Same reason as ofVisitsPct's doc comment: a visit-day that
            // converted nobody carries no lead row, and dropping it averaged
            // the funnel's first step over converting days only.
            previous.key === "visits"
            ? ofVisitsPct(current, key)
            : pairedPct(current, key, previous.key)
          : null,
      ofPreviousLabel: options.shares && previous ? previous.label : null,
      deltaPct: deltaPct(value, priorTotals[key]),
      channels: channelsObserving(current, key),
      totalChannels,
    };
    if (value != null) previous = { key, label };
    return stage;
  });
}

/** @deprecated kept for the funnel test; prefer buildStages. */
export function buildFunnel(
  current: ChannelFact[],
  prior: ChannelFact[],
): FunnelStage[] {
  return buildStages(FUNNEL_STAGES, current, prior, { shares: true });
}

function rowFor(
  key: string,
  label: string,
  current: ChannelFact[],
  prior: ChannelFact[],
): ChannelReportRow {
  const metrics = sumMetrics(current);
  const priorMetrics = sumMetrics(prior);
  const spend =
    metrics.spend != null && metrics.spend > 0 ? metrics.spend : null;
  return {
    key,
    label,
    metrics,
    prior: priorMetrics,
    rates: {
      leadPct: ofVisitsPct(current, "leads"),
      bookPct: pairedPct(current, "booked", "leads"),
      winPct: pairedPct(current, "won", "booked"),
    },
    directBooked: sumObserved(
      current.filter((fact) => fact.leads == null).map((fact) => fact.booked),
    ),
    costPerLead:
      spend != null && metrics.leads ? round1(spend / metrics.leads) : null,
    costPerBooked:
      spend != null && metrics.booked ? round1(spend / metrics.booked) : null,
  };
}

/** Only visits (and reach) observed: a referrer nobody tagged. */
const TAIL_ONLY: ReadonlySet<MetricKey> = new Set(["visits", "reach"]);

function isTail(row: ChannelReportRow): boolean {
  return METRIC_KEYS.every(
    (key) => row.metrics[key] == null || TAIL_ONLY.has(key),
  );
}

/**
 * Groups facts by one dimension and orders rows by leads, booked, visits,
 * impressions, then label, so the channel doing the most work is at the top
 * and a channel with nothing but impressions still appears rather than
 * vanishing. Rows that only ever had visits go to `tail`.
 */
export function buildChannelReport(
  current: ChannelFact[],
  prior: ChannelFact[],
  groupBy: ChannelGroupBy = "channel",
): ChannelReport {
  const groups = new Map<
    string,
    { current: ChannelFact[]; prior: ChannelFact[] }
  >();
  const bucket = (key: string) => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created = { current: [], prior: [] };
    groups.set(key, created);
    return created;
  };
  for (const fact of current) bucket(fact[groupBy]).current.push(fact);
  for (const fact of prior) bucket(fact[groupBy]).prior.push(fact);

  const all = [...groups.entries()]
    .map(([key, facts]) => rowFor(key, key, facts.current, facts.prior))
    .filter((row) => METRIC_KEYS.some((key) => row.metrics[key] != null))
    .sort(
      (a, b) =>
        (b.metrics.leads ?? -1) - (a.metrics.leads ?? -1) ||
        (b.metrics.booked ?? -1) - (a.metrics.booked ?? -1) ||
        (b.metrics.visits ?? -1) - (a.metrics.visits ?? -1) ||
        (b.metrics.impressions ?? -1) - (a.metrics.impressions ?? -1) ||
        a.label.localeCompare(b.label),
    );

  return {
    totals: sumMetrics(current),
    priorTotals: sumMetrics(prior),
    reach: buildStages(REACH_STAGES, current, prior, { shares: false }),
    funnel: buildStages(FUNNEL_STAGES, current, prior, { shares: true }),
    rows: all.filter((row) => !isTail(row)),
    tail: all.filter(isTail),
  };
}

export type SyncRun = Pick<
  Tables<"channel_sync_runs">,
  "connector" | "started_at" | "finished_at" | "rows_written" | "error"
>;

export type SyncHealthStatus = "ok" | "skipped" | "failed" | "stale" | "never";

export type SyncHealthRow = {
  connector: string;
  status: SyncHealthStatus;
  finishedAt: string | null;
  rowsWritten: number;
  /** The recorded error or skip reason, for the row's caption. */
  note: string | null;
};

/** A connector is stale when its last run is older than this. Daily crons. */
export const STALE_AFTER_HOURS = 36;

/**
 * The latest run per connector, judged. `expected` lists connectors that
 * should have run, so one that has never written a row shows up as "never"
 * instead of being absent from the table.
 */
export function summariseSyncRuns(
  runs: SyncRun[],
  expected: readonly string[],
  now: Date,
): SyncHealthRow[] {
  const latest = new Map<string, SyncRun>();
  for (const run of runs) {
    const seen = latest.get(run.connector);
    if (!seen || run.started_at > seen.started_at)
      latest.set(run.connector, run);
  }
  const connectors = [
    ...expected,
    ...[...latest.keys()].filter((key) => !expected.includes(key)),
  ];
  return connectors.map((connector) => {
    const run = latest.get(connector);
    if (!run) {
      return {
        connector,
        status: "never",
        finishedAt: null,
        rowsWritten: 0,
        note: "Has not run yet.",
      };
    }
    const finishedAt = run.finished_at ?? run.started_at;
    const ageHours =
      (now.getTime() - new Date(finishedAt).getTime()) / (60 * 60 * 1000);
    const skipped = run.error?.startsWith("skipped:") ?? false;
    const status: SyncHealthStatus = skipped
      ? "skipped"
      : run.error && run.rows_written === 0
        ? "failed"
        : ageHours > STALE_AFTER_HOURS
          ? "stale"
          : "ok";
    return {
      connector,
      status,
      finishedAt,
      rowsWritten: run.rows_written,
      note: skipped ? run.error!.replace(/^skipped:\s*/, "") : run.error,
    };
  });
}

// ---------------------------------------------------------------------------
// Going out: the link registry joined to Bitly clicks, so a link with zero
// clicks still appears. A link without a short link has no click observer at
// all, so its clicks are null ("not observed"), never zero.
// ---------------------------------------------------------------------------

export type GoingOutLink = Pick<
  Tables<"marketing_links">,
  | "id"
  | "url"
  | "label"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "bitly_id"
  | "bitly_url"
  | "created_at"
>;

export type BitlyClickFact = Pick<
  Tables<"bitly_link_clicks">,
  "bitly_id" | "day" | "clicks"
>;

export type GoingOutRow = GoingOutLink & {
  /** Clicks in the range. Null when the link has no short link to observe. */
  clicks: number | null;
  priorClicks: number | null;
};

export function buildGoingOut(
  links: GoingOutLink[],
  clicks: BitlyClickFact[],
  startDay: string,
): GoingOutRow[] {
  const current = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const fact of clicks) {
    const bucket = fact.day >= startDay ? current : prior;
    bucket.set(fact.bitly_id, (bucket.get(fact.bitly_id) ?? 0) + fact.clicks);
  }
  return links
    .map((link) => ({
      ...link,
      clicks: link.bitly_id ? (current.get(link.bitly_id) ?? 0) : null,
      priorClicks: link.bitly_id ? (prior.get(link.bitly_id) ?? 0) : null,
    }))
    .sort(
      (a, b) =>
        (b.clicks ?? -1) - (a.clicks ?? -1) ||
        b.created_at.localeCompare(a.created_at),
    );
}
