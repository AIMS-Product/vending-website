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
  "leads",
  "booked",
  "showed",
  "won",
  "revenue",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type Metrics = Record<MetricKey, number | null>;

/** The funnel, top to bottom. Spend and revenue are context, not stages. */
export const FUNNEL_STAGES: ReadonlyArray<{ key: MetricKey; label: string }> = [
  { key: "impressions", label: "Seen" },
  { key: "clicks", label: "Clicked" },
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
  /** This stage over the nearest observed stage above it, as a percentage. */
  ofPreviousPct: number | null;
  deltaPct: number | null;
};

export type ChannelGroupBy = "channel" | "campaign" | "content" | "destination";

export type ChannelReportRow = {
  key: string;
  label: string;
  metrics: Metrics;
  prior: Metrics;
  /** leads ÷ visits, booked ÷ leads, won ÷ booked; null where unobserved. */
  rates: {
    leadPct: number | null;
    bookPct: number | null;
    winPct: number | null;
  };
  /** spend ÷ leads and spend ÷ booked; null where spend is unobserved or zero. */
  costPerLead: number | null;
  costPerBooked: number | null;
};

export type ChannelReport = {
  totals: Metrics;
  priorTotals: Metrics;
  funnel: FunnelStage[];
  rows: ChannelReportRow[];
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

export function buildFunnel(totals: Metrics, prior: Metrics): FunnelStage[] {
  let previousObserved: number | null = null;
  return FUNNEL_STAGES.map(({ key, label }) => {
    const value = totals[key];
    const stage: FunnelStage = {
      key,
      label,
      value,
      prior: prior[key],
      ofPreviousPct: pct(value, previousObserved),
      deltaPct: deltaPct(value, prior[key]),
    };
    if (value != null) previousObserved = value;
    return stage;
  });
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
      leadPct: pct(metrics.leads, metrics.visits),
      bookPct: pct(metrics.booked, metrics.leads),
      winPct: pct(metrics.won, metrics.booked),
    },
    costPerLead:
      spend != null && metrics.leads ? round1(spend / metrics.leads) : null,
    costPerBooked:
      spend != null && metrics.booked ? round1(spend / metrics.booked) : null,
  };
}

/**
 * Groups facts by one dimension and orders rows by leads, then clicks, then
 * label, so the channel doing the most work is at the top and a channel with
 * nothing but impressions still appears rather than vanishing.
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

  const rows = [...groups.entries()]
    .map(([key, facts]) => rowFor(key, key, facts.current, facts.prior))
    .filter((row) => METRIC_KEYS.some((key) => row.metrics[key] != null))
    .sort(
      (a, b) =>
        (b.metrics.leads ?? -1) - (a.metrics.leads ?? -1) ||
        (b.metrics.clicks ?? -1) - (a.metrics.clicks ?? -1) ||
        a.label.localeCompare(b.label),
    );

  const totals = sumMetrics(current);
  const priorTotals = sumMetrics(prior);
  return {
    totals,
    priorTotals,
    funnel: buildFunnel(totals, priorTotals),
    rows,
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
