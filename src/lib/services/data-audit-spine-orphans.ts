import "server-only";

import {
  assertion,
  errorResult,
  type AuditResult,
} from "@/lib/services/data-audit";
import { pageAll, type AuditClient } from "@/lib/services/data-audit-query";
import {
  CHANNEL_CONNECTORS,
  WINDOW_DAYS as CHANNEL_WINDOW_DAYS,
} from "@/lib/services/channel-sync";
import {
  FORM_ROUTES,
  FORM_WINDOW_DAYS,
  GHL_CONNECTORS,
} from "@/lib/services/ghl-sync";
import {
  ADS_WINDOW_DAYS,
  METRICOOL_ADS_CONNECTOR,
  METRICOOL_CONNECTOR,
  WINDOW_DAYS as POSTS_WINDOW_DAYS,
} from "@/lib/services/metricool-sync";
import {
  YOUTUBE_ANALYTICS_CONNECTOR,
  WINDOW_DAYS as YOUTUBE_WINDOW_DAYS,
} from "@/lib/services/youtube-analytics-sync";

/**
 * Rows whose stamp is an older day than the newest stamp in their own family
 * on their own day: the rows the latest write of that day did not regenerate.
 *
 * A writer rewrites every key it still generates on each run, and each write
 * stamps `synced_at`, so within one writer's rows on one day an older stamp is
 * a key it stopped generating. Stamps are compared by day, not instant: the
 * connectors run minutes apart inside one cron, and a manual run hours later
 * is not staleness. A day the writer wrote nothing on proves nothing (a quiet
 * API day, an empty report), so its rows are compared only with each other.
 *
 * `ceiling` caps a family's newest stamp at the day of that writer's latest
 * clean run. Every connector's write bumps the same `synced_at`, so a row GA4
 * touched today would otherwise make the leads rows beside it look stale on a
 * day the leads sync has not run.
 */
export function staleOnOwnDay<T extends { day: string; synced_at: string }>(
  rows: readonly T[],
  familyOf: (row: T) => string | null,
  ceiling: (family: string) => string | undefined = () => undefined,
): T[] {
  const id = (family: string, day: string) => `${family}\u0000${day}`;
  const newest = new Map<string, string>();
  for (const row of rows) {
    const family = familyOf(row);
    if (family === null) continue;
    const key = id(family, row.day);
    const stamp = row.synced_at.slice(0, 10);
    if (stamp > (newest.get(key) ?? "")) newest.set(key, stamp);
  }
  return rows.filter((row) => {
    const family = familyOf(row);
    if (family === null) return false;
    const stamp = newest.get(id(family, row.day)) ?? "";
    const cap = ceiling(family);
    const reference = cap !== undefined && cap < stamp ? cap : stamp;
    return row.synced_at.slice(0, 10) < reference;
  });
}

type SpineRow = {
  day: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
  synced_at: string;
} & Partial<Record<OrphanMetric, number | null>>;

type OrphanMetric = "spend" | "visits" | "leads" | "clicks" | "won";

type Writer = {
  /** `channel_sync_runs.connector`. */
  connector: string;
  /** How many days before its own run day the writer re-reads. */
  back: number;
  /** Days before its run day the re-read stops; YouTube ends yesterday. */
  endLag?: number;
  owns: (row: SpineRow) => boolean;
};

type OrphanCheck = {
  checkId: string;
  metric: OrphanMetric;
  label: string;
  noun: string;
  money?: boolean;
  warnOnly: boolean;
  /** Rows of writers this check deliberately leaves alone; see each use. */
  ignore?: (row: SpineRow) => boolean;
  /** A row belongs to the first writer that owns it. */
  writers: readonly Writer[];
};

const isAdRow = (row: SpineRow) =>
  row.source === "google" || row.source === "meta_ads";

const GHL_ROUTE_KEYS = new Set(
  Object.values(FORM_ROUTES).flatMap((route) =>
    route === "exclude"
      ? []
      : [`${route.source}\u0000${route.medium}\u0000${route.content}`],
  ),
);
const isGhlFormRow = (row: SpineRow) =>
  row.source === "ghl_form" ||
  GHL_ROUTE_KEYS.has(`${row.source}\u0000${row.medium}\u0000${row.content}`);

const isYouTubeVideoRow = (row: SpineRow) =>
  row.source === "youtube" && row.medium === "organic";

/**
 * webinar-ingest is a push from vp-webinars. Which days it re-sends is the
 * sender's choice and is not recorded on the run, so there is no window in
 * which a row it did not rewrite is known to be one it dropped.
 */
const isWebinarAudienceRow = (row: SpineRow) =>
  row.destination === "webinar-register" &&
  (row.source === "meta_ads" || row.source === "unattributed") &&
  ["warm", "cold", "unattributed"].includes(row.content);

/**
 * manychat-ingest writes one fixed key per day (manychat / chat / pearl) and
 * rewrites it only when an event for that day arrives. Its key cannot move,
 * so it cannot strand a row, and an old stamp is its normal state.
 */
const isManychatRow = (row: SpineRow) => row.source === "manychat";

/**
 * ghl-email writes each day exactly once, as yesterday's delta, and never
 * re-reads it: every row but the newest is older than its latest run by design.
 */
const isGhlEmailRow = (row: SpineRow) => row.source === "ghl_email";

const ADS: Writer = {
  connector: METRICOOL_ADS_CONNECTOR,
  back: ADS_WINDOW_DAYS,
  owns: isAdRow,
};
const LEADS: Writer = {
  connector: CHANNEL_CONNECTORS.leads,
  back: CHANNEL_WINDOW_DAYS.leads,
  owns: () => true,
};

/**
 * One check per metric. Spend and visits fail: each has a clear that runs
 * every night (`clearRenamedAdRows`, GA4's superseded-key clear), so a hit
 * means the clear broke, the same footing as bookings. Leads, clicks and won
 * warn: nothing blanks a row those syncs dropped, so a hit is a row to repair
 * by hand, and failing would hold every night until someone did.
 */
const ORPHAN_CHECKS: readonly OrphanCheck[] = [
  {
    checkId: "spine-orphaned-spend",
    metric: "spend",
    label: "No spend counted on a row the ad sync dropped",
    noun: "of spend",
    money: true,
    warnOnly: false,
    // The Webinar trigger only keeps a row's channel label; it clears
    // nothing, so it needs no exception here.
    writers: [ADS],
  },
  {
    checkId: "spine-orphaned-visits",
    metric: "visits",
    label: "No visits counted on a row GA4 dropped",
    noun: "visits",
    warnOnly: false,
    // `thankyou_visits` is cleared in the same pass; checking visits checks
    // the clear.
    writers: [
      {
        connector: CHANNEL_CONNECTORS.ga4,
        back: CHANNEL_WINDOW_DAYS.ga4,
        owns: () => true,
      },
    ],
  },
  {
    checkId: "spine-orphaned-leads",
    metric: "leads",
    label: "No lead counted on a row its sync dropped",
    noun: "leads",
    warnOnly: true,
    ignore: (row) => isWebinarAudienceRow(row) || isManychatRow(row),
    // GHL forms before site leads: the form routes name exact keys, and the
    // leads sync owns every other key that carries a lead.
    writers: [
      {
        connector: GHL_CONNECTORS.forms,
        back: FORM_WINDOW_DAYS,
        owns: isGhlFormRow,
      },
      LEADS,
    ],
  },
  {
    checkId: "spine-orphaned-clicks",
    metric: "clicks",
    label: "No clicks counted on a row its sync dropped",
    noun: "clicks",
    // Also warn because a post deleted on the network keeps its last clicks,
    // which really happened: a hit needs a look before it is a double count.
    warnOnly: true,
    ignore: (row) => isManychatRow(row) || isGhlEmailRow(row),
    // bitly-clicks is not listed: `bitly_link_clicks` has never held a row
    // (no token in any environment), so no click on the spine is Bitly's. Its
    // keys come from each link's UTMs and share sources with Metricool posts;
    // when it connects, split the two here first, or a day one ran and the
    // other did not will flag the other's rows.
    writers: [
      ADS,
      {
        connector: YOUTUBE_ANALYTICS_CONNECTOR,
        back: YOUTUBE_WINDOW_DAYS,
        endLag: 1,
        owns: isYouTubeVideoRow,
      },
      {
        connector: METRICOOL_CONNECTOR,
        back: POSTS_WINDOW_DAYS,
        owns: () => true,
      },
    ],
  },
  {
    checkId: "spine-orphaned-won",
    metric: "won",
    label: "No won deal counted on a row its sync dropped",
    noun: "won deals",
    // The won counts on Channels and Executive come from Close (close-wins),
    // not from this column.
    warnOnly: true,
    // webinar-ingest writes won as null; an old webinar row with a win is its
    // own, not the leads sync's.
    ignore: (row) => isWebinarAudienceRow(row) || isManychatRow(row),
    writers: [LEADS],
  },
];

/** How far back a writer's latest clean run is looked for. */
const RUN_LOOKBACK_DAYS = 7;
const WORST_SHOWN = 3;
const KEY_ORDER = [
  "day",
  "source",
  "medium",
  "campaign",
  "content",
  "destination",
] as const;

/**
 * The same defect `spine-orphaned-bookings` catches, for every other metric a
 * sync rewrites on a rolling window: a row whose key the sync stopped
 * generating keeps its last value and is summed forever (REPORTING.md
 * section 8).
 *
 * Each row is judged by the writer that owns it, over that writer's own
 * re-read window as of its latest clean run. A writer never re-touches a day
 * older than its window, so a row there is not an orphan by definition, only
 * history; those days are not read. The window's oldest day is left out too:
 * a report cut at a day boundary (GA4's start date, a post's publish time in
 * another zone) may re-read that day only in part.
 */
export async function orphanedMetricChecks(
  client: AuditClient,
  now: Date,
): Promise<AuditResult[]> {
  const connectors = [
    ...new Set(
      ORPHAN_CHECKS.flatMap((check) => check.writers.map((w) => w.connector)),
    ),
  ];
  const lastRun = await lastCleanRunDays(client, now, connectors);
  const results: AuditResult[] = [];
  for (const check of ORPHAN_CHECKS) {
    try {
      results.push(await orphanCheck(client, check, lastRun));
    } catch (error) {
      results.push(
        errorResult(
          check.checkId,
          check.label,
          "each sync's window",
          "our spine",
          error,
        ),
      );
    }
  }
  return results;
}

/** Connector → the day of its newest run that recorded no error. */
async function lastCleanRunDays(
  client: AuditClient,
  now: Date,
  connectors: readonly string[],
): Promise<Map<string, string>> {
  const since = new Date(now.getTime() - RUN_LOOKBACK_DAYS * 86_400_000);
  const { data, error } = await client
    .from("channel_sync_runs")
    .select("connector,started_at,error")
    .in("connector", [...connectors])
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`channel_sync_runs read failed: ${error.message}`);
  const latest = new Map<string, string>();
  for (const run of data ?? []) {
    // A skipped run wrote nothing and a partly failed one may not have
    // rewritten every key, so neither can vouch for a row being dropped.
    if (run.error !== null || !connectors.includes(run.connector)) continue;
    const day = run.started_at.slice(0, 10);
    if (day > (latest.get(run.connector) ?? "")) latest.set(run.connector, day);
  }
  return latest;
}

async function orphanCheck(
  client: AuditClient,
  check: OrphanCheck,
  lastRun: ReadonlyMap<string, string>,
): Promise<AuditResult> {
  const windows = new Map<string, { from: string; to: string }>();
  for (const writer of check.writers) {
    const runDay = lastRun.get(writer.connector);
    if (!runDay) continue;
    windows.set(writer.connector, {
      from: shiftDay(runDay, -(writer.back - 1)),
      to: shiftDay(runDay, -(writer.endLag ?? 0)),
    });
  }
  const unchecked = check.writers
    .map((writer) => writer.connector)
    .filter((connector, index, all) => all.indexOf(connector) === index)
    .filter((connector) => !windows.has(connector));
  const notRun =
    unchecked.length === 0
      ? ""
      : ` Not checked: ${unchecked.join(", ")} has not run cleanly in the last ${RUN_LOOKBACK_DAYS} days.`;

  if (windows.size === 0) {
    return {
      checkId: check.checkId,
      label: check.label,
      window: `last ${RUN_LOOKBACK_DAYS} days of syncs`,
      sourceName: "our spine",
      ours: null,
      source: null,
      diffPct: null,
      status: "skipped",
      detail: `Nothing to compare against.${notRun}`,
    };
  }

  const spans = [...windows.values()];
  const from = spans.map((span) => span.from).sort()[0]!;
  const to = spans
    .map((span) => span.to)
    .sort()
    .at(-1)!;
  const { metric } = check;
  const rows = (
    await pageAll<SpineRow>(
      client,
      "channel_daily",
      `${KEY_ORDER.join(",")},${metric},synced_at`,
      (query) => query.gte("day", from).lte("day", to).not(metric, "is", null),
      KEY_ORDER,
    )
  ).filter((row) => row[metric] != null);

  const familyOf = (row: SpineRow) => {
    if (check.ignore?.(row)) return null;
    const owner = check.writers.find((writer) => writer.owns(row));
    const span = owner && windows.get(owner.connector);
    if (!owner || !span || row.day < span.from || row.day > span.to)
      return null;
    return owner.connector;
  };
  const orphans = staleOnOwnDay(rows, familyOf, (family) =>
    lastRun.get(family),
  ).filter((row) => Number(row[metric]) !== 0);

  const value = (row: SpineRow) => Number(row[metric] ?? 0);
  const total = orphans.reduce((sum, row) => sum + value(row), 0);
  const format = (amount: number) =>
    check.money
      ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : amount.toLocaleString("en-US");
  const worst = [...orphans]
    .sort((a, b) => value(b) - value(a))
    .slice(0, WORST_SHOWN)
    .map(
      (row) =>
        `${row.day} ${row.source} / ${row.medium} / ${row.campaign} / ${row.content} (${format(value(row))})`,
    );

  return assertion({
    checkId: check.checkId,
    label: check.label,
    window: `${from} to ${to}`,
    sourceName: "our spine",
    ok: orphans.length === 0,
    warnOnly: check.warnOnly,
    count: check.money ? Math.round(total * 100) / 100 : total,
    detail:
      (orphans.length === 0
        ? `Every stored row its sync still re-reads was rewritten by that sync's latest run.`
        : `${orphans.length === 1 ? "1 row" : `${orphans.length} rows`} the latest run of its own sync did not rewrite still ${orphans.length === 1 ? "carries" : "carry"} ${format(total)} ${check.noun}, counted on top of whatever replaced ${orphans.length === 1 ? "it" : "them"}. Largest: ${worst.join("; ")}.`) +
      notRun,
  });
}

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
