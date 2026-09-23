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
> & {
  /**
   * Webinar registrations, off-site GHL form fills and ManyChat contacts:
   * people we hold a contact for who are not leads by the site definition
   * (lead-definition.ts). Set by `fetchFacts`, never stored.
   */
  contacts?: number | null;
};

export const METRIC_KEYS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "visits",
  "thankyou_visits",
  "leads",
  "contacts",
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
  /**
   * spend ÷ (leads + registrations/contacts), only where registrations
   * outnumber site leads. Webinar ads buy registrations, so spend ÷ site leads
   * alone reads thousands of dollars a lead. Null otherwise.
   */
  costPerSignup: number | null;
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
 * Null, not zero, unless the numerator was observed on at least one row that
 * also carried visits. So the rate is a dash wherever its own column is a
 * dash -- the chatbot, whose leads arrive mid-conversation with no landing
 * session; organic search, which no lead was ever tagged with; thank-you
 * visits before that connector has ever run -- and never states a 0% that
 * only means nobody has measured yet.
 *
 * Null too when the visit rows cover less than half of what the channel
 * actually counted. That is the signature of a key mismatch rather than a
 * measurement: the two connectors are writing the same traffic under
 * different keys, so dividing one by the other understates by however much
 * they disagree. Google Ads on 2026-09-11 is the worked example -- GA4 keyed
 * visits on the campaign NAME while the links carried the numeric id, so only
 * 12 of its 128 leads (9%) shared a row with any visit and the rate came out
 * 0.2% against a true 2.3%. A tenfold error that reads like a real number is
 * worse than a dash, and it stays wrong until the backfill re-keys the rows.
 * Healthy channels sit far above the bar (Website 99%, YouTube 91%,
 * LinkedIn 88%, Instagram 81%), so this only ever fires on breakage.
 */
const MIN_COVERAGE = 0.5;

/**
 * The same correction for any denominator, not just visits.
 *
 * `pairedPct` was wrong everywhere, not only on opt-in. A spine row carries
 * `booked` only if a booking happened on that link that day, so "both
 * observed" dropped every lead-day that booked nobody and divided by the
 * converting days alone. Measured on 30 days of production (2026-09-18) it
 * inflated Book % on every channel that has a stage its links do not share:
 * Webinar 140.0% against a true 0.2% (4,042 registrations, 152 bookings),
 * Instagram 82.4% against 10.1%, Website 58.0% against 45.1%.
 *
 * So the denominator is every row that observed it, and a denominator row with
 * no numerator counts as the zero it was.
 *
 * A rate above 100% survives this and is not a bug: a booking today can belong
 * to a lead captured last week, and a direct Calendly link books with no lead
 * row at all. The row's `directBooked` names that second case. Both sides still
 * come from our own tables, so the number is real — it is simply not a cohort
 * conversion rate, and `funnel-monthly` is where a cohort-correct one lives.
 *
 * Still used for the visits denominator. NOT used for Book %: see
 * `bookedOfSignupsPct`, which is denominated on the acquired population rather
 * than on site leads alone.
 */
export function ofObservedPct(
  facts: ChannelFact[],
  numerator: MetricKey,
  denominator: MetricKey,
  { requireCoverage = false } = {},
): number | null {
  const seen = facts.filter((fact) => fact[denominator] != null);
  if (!seen.some((fact) => fact[numerator] != null)) return null;

  const covered = seen.reduce((sum, fact) => sum + (fact[numerator] ?? 0), 0);
  if (requireCoverage) {
    const observed = facts.reduce(
      (sum, fact) => sum + (fact[numerator] ?? 0),
      0,
    );
    if (observed > 0 && covered < observed * MIN_COVERAGE) return null;
  }

  return pct(covered, sumObserved(seen.map((fact) => fact[denominator])));
}

/**
 * A booking on this row was made by someone the channel has already counted.
 *
 * The webinar's night-of and replay calls-to-action (`internal-webinar`) are shown inside the
 * room and in the sends that follow it, so every click came from somebody who registered first
 * and is therefore already sitting in the channel's `contacts`. Those rows carry the booking
 * without an audience of their own, which makes the per-row test for "nothing acquired this"
 * read them as direct Calendly links. They are the opposite: the most thoroughly acquired
 * bookings the channel has.
 *
 * Measured against live data on 2026-09-21: 119 of the Webinar channel's 146 bookings over 30
 * days and 226 of its 261 over 90 days sat on these rows, every one of them on this source, and
 * no row outside the Webinar channel carries it. Book % published 0.7% against a true 3.6%, and
 * `directBooked` claimed 119 direct bookings that had never happened.
 *
 * Keyed on the source rather than the channel because the source is the property that makes the
 * claim true -- the link is only reachable from inside the event -- and because a channel name
 * is a label we choose, while this is a fact about where the link lives.
 */
const bookedByOwnAudience = (fact: ChannelFact) =>
  fact.source === "internal-webinar";

/**
 * A booking with nothing behind it anywhere, shown on the page as "skipped
 * form": no lead and no registration or contact on the row, and not one of the
 * in-event links whose audience the channel counted on a different row. The
 * table and the confidence check both read this, so they cannot disagree.
 */
export const isSkippedFormBooking = (fact: ChannelFact) =>
  fact.leads == null && fact.contacts == null && !bookedByOwnAudience(fact);

/**
 * Book %, denominated on everyone the channel acquired rather than on site
 * leads alone.
 *
 * `applyLeadDefinition` splits one population in two: a site form fill stays a
 * `lead`, while a webinar registration, an off-site GHL form fill and a
 * ManyChat contact become `contacts`, because they are not leads by the site's
 * definition. Both are people, and both can book. Denominating on `leads`
 * alone therefore divides a channel's whole booking count by whatever slice of
 * its audience happened to fill in a form on our own site.
 *
 * Measured live on 2026-09-21 that published Webinar Book % as **300%** -- 27
 * bookings over 9 site leads, while the 4,037 registrations that actually
 * produced them sat in `contacts` and were skipped. VSL read 200% and
 * Instagram 84.8% the same way. `costPerSignup` already reasons correctly
 * about this ("Webinar ads buy registrations, so spend / site leads alone
 * reads thousands of dollars a lead"); Book % never did.
 *
 * Everything else about `ofObservedPct` is kept: the denominator is every row
 * that observed acquisition, a denominator row with no booking counts as the
 * zero it was, and a booking on a row with no audience stays out of the rate
 * and is disclosed as `directBooked` instead.
 */
export function bookedOfSignupsPct(facts: ChannelFact[]): number | null {
  const seen = facts.filter(
    (fact) =>
      fact.leads != null || fact.contacts != null || bookedByOwnAudience(fact),
  );
  if (!seen.some((fact) => fact.booked != null)) return null;
  const booked = seen.reduce((sum, fact) => sum + (fact.booked ?? 0), 0);
  const signups = seen.reduce(
    (sum, fact) => sum + (fact.leads ?? 0) + (fact.contacts ?? 0),
    0,
  );
  return pct(booked, signups);
}

/**
 * The coverage guard belongs to visits alone.
 *
 * Under a visits denominator, a lead on a row with no visits can only mean the
 * two connectors keyed the same traffic differently — GA4 has a session for
 * every lead, so a lead with no session is a join failure. Under any other
 * denominator the same shape is an ordinary category: a booking on a row with
 * no leads is a direct Calendly link, which is real, expected, and already
 * reported as the row's `directBooked`. Nulling those would hide an honest
 * rate to protect against a failure that cannot happen there.
 */
export function ofVisitsPct(
  facts: ChannelFact[],
  numerator: MetricKey,
): number | null {
  return ofObservedPct(facts, numerator, "visits", { requireCoverage: true });
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
          ? // See ofObservedPct: a denominator-day that converted nobody
            // carries no numerator row, and dropping it averaged each step
            // over its converting days only.
            previous.key === "visits"
            ? ofVisitsPct(current, key)
            : ofObservedPct(current, key, previous.key)
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
      bookPct: bookedOfSignupsPct(current),
      winPct: ofObservedPct(current, "won", "booked"),
    },
    directBooked: sumObserved(
      current.filter(isSkippedFormBooking).map((fact) => fact.booked),
    ),
    costPerLead:
      spend != null && metrics.leads ? round1(spend / metrics.leads) : null,
    costPerBooked:
      spend != null && metrics.booked ? round1(spend / metrics.booked) : null,
    costPerSignup:
      spend != null && (metrics.contacts ?? 0) > (metrics.leads ?? 0)
        ? round1(spend / ((metrics.leads ?? 0) + (metrics.contacts ?? 0)))
        : null,
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

export type SyncHealthStatus =
  | "ok"
  | "empty"
  | "skipped"
  | "failed"
  | "stale"
  | "never";

export type SyncHealthRow = {
  connector: string;
  status: SyncHealthStatus;
  finishedAt: string | null;
  rowsWritten: number;
  /** The recorded error or skip reason, for the row's caption. */
  note: string | null;
};

/** What each data feed is called on screen. Unknown ids show as themselves. */
const CONNECTOR_LABELS: Record<string, string> = {
  "ga4-visits": "GA4 visits",
  leads: "Our lead forms",
  "ghl-forms": "GHL forms",
  "ghl-email": "GHL email",
  "bitly-clicks": "Bitly clicks",
  "metricool-posts": "Metricool posts",
  "metricool-ads": "Metricool spend",
  "youtube-analytics": "YouTube Analytics",
  "webinar-ingest": "Webinar registrations",
  "manychat-ingest": "ManyChat",
  "close-lead-funnel": "Close outcomes",
};

export function connectorLabel(connector: string): string {
  return CONNECTOR_LABELS[connector] ?? connector;
}

/** A connector is stale when its last run is older than this. Daily crons. */
export const STALE_AFTER_HOURS = 36;

/**
 * A connector that runs on time, reports no error and writes nothing for this
 * long is broken in a way the error column cannot show. Bitly did exactly
 * that from September 2026: 0 rows a day, every run green, every Clicks cell
 * blank. Two days so a genuinely quiet day never trips it; at least two runs so
 * one empty run on its own never does either.
 */
export const EMPTY_AFTER_HOURS = 48;

/**
 * Feeds that legitimately write nothing for days: ad spend while campaigns are
 * paused, webinar pushes between events. An empty run there is not a fault.
 */
const MAY_BE_QUIET = new Set(["metricool-ads", "webinar-ingest"]);

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
          : writesNothing(runs, connector, now)
            ? "empty"
            : "ok";
    return {
      connector,
      status,
      finishedAt,
      rowsWritten: run.rows_written,
      note: skipped
        ? run.error!.replace(/^skipped:\s*/, "")
        : status === "empty"
          ? emptyNote(runs, connector)
          : run.error,
    };
  });
}

function writesNothing(runs: SyncRun[], connector: string, now: Date) {
  if (MAY_BE_QUIET.has(connector)) return false;
  const since = now.getTime() - EMPTY_AFTER_HOURS * 60 * 60 * 1000;
  const recent = runs.filter(
    (run) =>
      run.connector === connector &&
      !run.error &&
      new Date(run.started_at).getTime() >= since,
  );
  return recent.length >= 2 && recent.every((run) => run.rows_written === 0);
}

function emptyNote(runs: SyncRun[], connector: string): string {
  const lastWrite = runs
    .filter((run) => run.connector === connector && run.rows_written > 0)
    .map((run) => run.started_at)
    .sort()
    .at(-1);
  return lastWrite
    ? `Runs without errors but has added nothing since ${lastWrite.slice(0, 10)}.`
    : "Runs without errors but has not added anything in the last two days.";
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
