import type { AnalyticsTabKey } from "@/components/admin/AnalyticsPanels";

/**
 * The trust bar's rules: which feeds each tab reads, how old each feed may get,
 * whether last night's audit ran, and which on-screen numbers a failed check
 * covers. Pure and client-safe; `data-trust-bar-data.ts` gathers the inputs.
 *
 * This file only labels numbers. It never changes how one is computed.
 */

export type TrustTone = "ok" | "warn" | "bad";

/** Where the Definitions link lands: the glossary on every tab, REPORTING.md on /admin/data. */
export const DEFINITIONS_ID = "definitions";

/** Where a feed's "last updated" comes from. */
export type FeedSource =
  /** A cron connector logging to `channel_sync_runs`: last clean run. */
  | { kind: "run"; connector: string }
  /** A table written live (webhook, form): newest row. */
  | {
      kind: "table";
      table:
        | "lead_submissions"
        | "calendly_bookings"
        | "ga4_page_views"
        | "lead_video_views";
      /** `day` is a date: the newest day of data, read as the end of that day. */
      column: "created_at" | "day" | "last_seen_at";
    };

export type FeedDef = {
  /** Plain words, as a marketer would say it. */
  label: string;
  /** Amber past this; red past twice this. Matches how often it updates. */
  staleAfterHours: number;
  source: FeedSource;
  /**
   * A table only this feed fills. While it has no row at all the feed has
   * never delivered anything, and the bar says "not connected" and what is
   * missing, instead of dating the source from a test run or a clean empty one.
   */
  fills?: { table: "bitly_link_clicks" | "manychat_events"; missing: string };
};

const DAILY = 36;
const HOURLY = 3;

export const FEEDS = {
  "site-leads": {
    label: "Site form fills",
    staleAfterHours: 24,
    source: { kind: "table", table: "lead_submissions", column: "created_at" },
  },
  calendly: {
    label: "Calendly bookings",
    staleAfterHours: 24,
    source: { kind: "table", table: "calendly_bookings", column: "created_at" },
  },
  "ga4-pages": {
    label: "Google Analytics page visits",
    // Newest day held (indexed; synced_at is not). The daily sync writes
    // through yesterday, so two days is late.
    staleAfterHours: 48,
    source: { kind: "table", table: "ga4_page_views", column: "day" },
  },
  "video-views": {
    label: "Pre-call video views",
    staleAfterHours: 72,
    source: {
      kind: "table",
      table: "lead_video_views",
      column: "last_seen_at",
    },
  },
  close: {
    label: "Close (calls, shows, sales)",
    staleAfterHours: HOURLY,
    source: { kind: "run", connector: "close-lead-funnel" },
  },
  "ga4-visits": {
    label: "Google Analytics visits by channel",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "ga4-visits" },
  },
  "spine-leads": {
    label: "Leads by channel",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "leads" },
  },
  "ghl-forms": {
    label: "GoHighLevel forms",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "ghl-forms" },
  },
  "ghl-email": {
    label: "GoHighLevel email",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "ghl-email" },
  },
  bitly: {
    label: "Bitly clicks",
    staleAfterHours: HOURLY,
    source: { kind: "run", connector: "bitly-clicks" },
    fills: {
      table: "bitly_link_clicks",
      missing: "no click has ever been stored",
    },
  },
  "metricool-posts": {
    label: "Social posts (Metricool)",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "metricool-posts" },
  },
  "metricool-ads": {
    label: "Ad spend (Metricool)",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "metricool-ads" },
  },
  youtube: {
    label: "YouTube Analytics",
    staleAfterHours: DAILY,
    source: { kind: "run", connector: "youtube-analytics" },
  },
  webinar: {
    label: "Webinar registrations",
    // Pushed after each weekly webinar, not on a cron.
    staleAfterHours: 8 * 24,
    source: { kind: "run", connector: "webinar-ingest" },
  },
  manychat: {
    label: "ManyChat contacts",
    staleAfterHours: 48,
    source: { kind: "run", connector: "manychat-ingest" },
    fills: {
      table: "manychat_events",
      missing: "ManyChat has never sent an event",
    },
  },
} as const satisfies Record<string, FeedDef>;

export type FeedKey = keyof typeof FEEDS;

/** Every feed that writes the channel spine (`channel_daily`). */
const SPINE: readonly FeedKey[] = [
  "ga4-visits",
  "spine-leads",
  "ghl-forms",
  "ghl-email",
  "bitly",
  "metricool-posts",
  "metricool-ads",
  "youtube",
  "webinar",
  "manychat",
];

export type TrustScope = AnalyticsTabKey | "data";

/**
 * THE map of tab to the feeds its loader reads. Read off each tab's data
 * loader (the tables it selects from); change it in the same commit as a
 * loader that starts or stops reading a table. Close deals read live from the
 * Close API are always current and are not listed.
 */
export const TAB_FEEDS: Record<TrustScope, readonly FeedKey[]> = {
  // admin-analytics.ts: lead_submissions, calendly_bookings
  overview: ["site-leads", "calendly"],
  acquisition: ["site-leads", "calendly"],
  pages: ["site-leads", "calendly"],
  quality: ["site-leads", "calendly"],
  // channel-journeys-data.ts: spine impressions/clicks, Close, leads, webinars
  journeys: [
    "site-leads",
    "ga4-pages",
    "close",
    "metricool-posts",
    "bitly",
    "ghl-email",
    "webinar",
  ],
  // funnel-map.ts: spine visits + leads, Close, GHL email stats
  map: ["ga4-visits", "spine-leads", "close", "ghl-email"],
  // channel-report.ts: the whole spine, Close wins, Calendly, lead forms
  channels: [...SPINE, "close", "calendly", "site-leads"],
  // youtube-attribution.ts: leads, Bitly clicks, YouTube videos, Close shows
  youtube: ["site-leads", "ga4-pages", "bitly", "youtube", "close"],
  // video-engagement-report.ts: video views, leads, Calendly, Close
  video: ["video-views", "site-leads", "calendly", "close"],
  // booked-calls-data.ts: Calendly, Close
  booked: ["calendly", "close"],
  // close-week-view-data.ts + close-mtd-funnel-data.ts: Close mirror
  close: ["close"],
  // close-monthly-funnel-data.ts: Close mirror, site leads
  mom: ["close", "site-leads"],
  // funnel-executive.ts: spend from the spine, funnel inputs
  exec: ["site-leads", "ga4-pages", "close", "metricool-ads"],
  // kpi-report-data.ts: spine facts, Close, GHL email, webinars, Calendly
  kpi: [...SPINE, "close", "calendly", "site-leads"],
  // funnel-monthly-data.ts: leads, GA4 page views, Close
  funnels: ["site-leads", "ga4-pages", "close"],
  // /admin/data is about every number.
  data: Object.keys(FEEDS) as FeedKey[],
};

/** What the reader found for one feed. */
export type FeedObservation = {
  feed: FeedKey;
  /** Last clean run, or newest row for a live table. Null when none. */
  lastSuccessAt: string | null;
  /** Connector health from `summariseSyncRuns`, for run feeds only. */
  status?: "ok" | "empty" | "skipped" | "failed" | "stale" | "never";
  note?: string | null;
  /** The read itself failed. */
  error?: string | null;
  /** False when the feed's `fills` table has no row at all. */
  connected?: boolean;
};

export type FeedVerdict = {
  feed: FeedKey;
  label: string;
  lastSuccessAt: string | null;
  tone: TrustTone;
  /** Plain words, null when healthy. */
  problem: string | null;
  /** False: never delivered data. Listed apart, not dated, not "out of date". */
  connected: boolean;
};

const HOUR_MS = 3_600_000;

export function judgeFeed(obs: FeedObservation, now: Date): FeedVerdict {
  const def: FeedDef = FEEDS[obs.feed];
  const base = {
    feed: obs.feed,
    label: def.label,
    lastSuccessAt: obs.lastSuccessAt,
    connected: true,
  };
  if (obs.error) {
    return {
      ...base,
      tone: "bad",
      problem: `could not be read (${obs.error})`,
    };
  }
  // A failing run is a failure to show, not a feed nobody connected. A
  // skipped run says itself why ("BITLY_ACCESS_TOKEN is not set.").
  if (obs.connected === false && def.fills && obs.status !== "failed") {
    return {
      ...base,
      connected: false,
      tone: "warn",
      problem:
        obs.status === "skipped" && obs.note
          ? `${def.fills.missing}: ${obs.note.replace(/\.$/, "")}`
          : def.fills.missing,
    };
  }
  if (!obs.lastSuccessAt) {
    return {
      ...base,
      tone: "bad",
      problem: "has no successful update on record",
    };
  }
  const ageHours =
    (now.getTime() - new Date(obs.lastSuccessAt).getTime()) / HOUR_MS;
  const age = formatAge(ageHours);
  if (ageHours > def.staleAfterHours * 2) {
    return { ...base, tone: "bad", problem: `last updated ${age} ago` };
  }
  if (ageHours > def.staleAfterHours) {
    return { ...base, tone: "warn", problem: `last updated ${age} ago` };
  }
  if (obs.status === "failed") {
    return {
      ...base,
      tone: "warn",
      problem: `its latest run failed${obs.note ? `: ${obs.note}` : ""}`,
    };
  }
  if (obs.status === "empty") {
    return {
      ...base,
      tone: "warn",
      problem: "runs but adds no new data",
    };
  }
  return { ...base, tone: "ok", problem: null };
}

function formatAge(hours: number): string {
  if (hours < 48) return `${Math.max(1, Math.round(hours))} hours`;
  return `${Math.round(hours / 24)} days`;
}

// ---------------------------------------------------------------------------
// Last night's audit
// ---------------------------------------------------------------------------

/** The audit runs daily; a run older than this means last night's did not. */
export const AUDIT_MISSING_AFTER_HOURS = 26;

export type AuditCheck = {
  checkId: string;
  label: string;
  window: string;
  status: "pass" | "warn" | "fail" | "skipped" | "error";
  detail: string;
};

export type AuditRun = { runAt: string; checks: AuditCheck[] };

export type AuditVerdict = {
  tone: TrustTone;
  runAt: string | null;
  /** False when no run is stored or the newest is older than 26 hours. */
  ranLastNight: boolean;
  passed: number;
  total: number;
  /** Every check that did not pass, worst first. */
  notPassed: { label: string; status: AuditCheck["status"] }[];
  /** Why the audit cannot be read, when it cannot. */
  error: string | null;
};

const STATUS_RANK: Record<AuditCheck["status"], number> = {
  fail: 0,
  error: 1,
  warn: 2,
  skipped: 3,
  pass: 4,
};

export function judgeAudit(
  run: AuditRun | null,
  now: Date,
  error: string | null = null,
): AuditVerdict {
  if (error || !run) {
    return {
      tone: "bad",
      runAt: null,
      ranLastNight: false,
      passed: 0,
      total: 0,
      notPassed: [],
      error,
    };
  }
  const ageHours = (now.getTime() - new Date(run.runAt).getTime()) / HOUR_MS;
  const ranLastNight = ageHours <= AUDIT_MISSING_AFTER_HOURS;
  const notPassed = run.checks
    .filter((check) => check.status !== "pass")
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .map((check) => ({ label: check.label, status: check.status }));
  const passed = run.checks.length - notPassed.length;
  const hardFail = notPassed.some(
    (check) => check.status === "fail" || check.status === "error",
  );
  const tone: TrustTone =
    !ranLastNight || hardFail || run.checks.length === 0
      ? "bad"
      : notPassed.length > 0
        ? "warn"
        : "ok";
  return {
    tone,
    runAt: run.runAt,
    ranLastNight,
    passed,
    total: run.checks.length,
    notPassed,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Which on-screen number each check verifies
// ---------------------------------------------------------------------------

export type CoveredMetric = "leads" | "booked" | "won" | "revenue" | "calendly";

/** Days a check compares, inclusive, as YYYY-MM-DD. */
export type DayRange = { from: string; to: string };

/** Which window a covered check compares when it runs; see `expectedWindow`. */
type CheckWindow = "last-closed-month" | "last-7-settled-days";

type CheckCover = {
  checkId: string;
  /**
   * Rows the audit stores INSTEAD of `checkId` when the check could not run:
   * `<group>-group` when the whole group threw (`safe()` in
   * data-audit-checks.ts), `<source>-config` when the source has no key. The
   * month-over-month group returns nothing at all without Close, so
   * `close-config` explains its absence too.
   */
  standIns: readonly string[];
  window: CheckWindow;
  tab: AnalyticsTabKey;
  metric: CoveredMetric;
  /** The number's name as the tab prints it. */
  number: string;
};

const MOM_STAND_INS = ["mom-group", "close-config", "close-group"] as const;
const CLOSE_STAND_INS = ["close-group", "close-config"] as const;
const CALENDLY_STAND_INS = ["calendly-group", "calendly-config"] as const;

/**
 * THE map of audit check to the numbers on screen it verifies. A number is
 * Unverified unless its check is in last night's run and passed (or warned,
 * which is within twice the tolerance). A check missing from the run is not a
 * pass: silence never reads as verified.
 */
export const CHECK_COVERS: ReadonlyArray<CheckCover> = [
  {
    checkId: "mom-leads",
    standIns: MOM_STAND_INS,
    window: "last-closed-month",
    tab: "mom",
    metric: "leads",
    number: "Leads",
  },
  {
    checkId: "close-first-calls",
    standIns: CLOSE_STAND_INS,
    window: "last-7-settled-days",
    tab: "mom",
    metric: "booked",
    number: "Booked",
  },
  {
    checkId: "mom-won",
    standIns: MOM_STAND_INS,
    window: "last-closed-month",
    tab: "mom",
    metric: "won",
    number: "CW % (won)",
  },
  {
    checkId: "mom-revenue",
    standIns: MOM_STAND_INS,
    window: "last-closed-month",
    tab: "mom",
    metric: "revenue",
    number: "Revenue",
  },
  {
    checkId: "close-first-calls",
    standIns: CLOSE_STAND_INS,
    window: "last-7-settled-days",
    tab: "close",
    metric: "booked",
    number: "Booked (first calls)",
  },
  {
    checkId: "calendly-bookings",
    standIns: CALENDLY_STAND_INS,
    window: "last-7-settled-days",
    tab: "overview",
    metric: "calendly",
    number: "Calls booked on Calendly",
  },
  {
    checkId: "calendly-bookings",
    standIns: CALENDLY_STAND_INS,
    window: "last-7-settled-days",
    tab: "booked",
    metric: "calendly",
    number: "Marketing booked",
  },
];

const DAY_MS = 86_400_000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The window a check compares when run at `at`, for a check that left no row
 * to read it from. Mirrors `lastClosedMonth` (data-audit-mom-checks.ts) and
 * `settledWindow(now, 1)` over 7 days (data-audit-checks.ts); a test pins
 * both against those functions.
 */
export function expectedWindow(window: CheckWindow, at: Date): DayRange {
  if (window === "last-closed-month") {
    const start = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1),
    );
    const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    return {
      from: dayKey(start),
      to: dayKey(new Date(end.getTime() - DAY_MS)),
    };
  }
  return {
    from: dayKey(new Date(at.getTime() - 7 * DAY_MS)),
    to: dayKey(new Date(at.getTime() - DAY_MS)),
  };
}

/** The first and last YYYY-MM-DD in a stored window label, when it has any. */
function rangeOf(label: string): DayRange | null {
  const days = (label.match(/\d{4}-\d{2}-\d{2}/g) ?? []).sort();
  const [from] = days;
  const to = days.at(-1);
  return from && to ? { from, to } : null;
}

export type UnverifiedFlag = {
  metric: CoveredMetric;
  number: string;
  /** The days the check covers (or would have covered). */
  from: string;
  to: string;
  reason: string;
};

const WHY: Record<AuditCheck["status"], string> = {
  fail: "disagreed with",
  error: "could not be checked against",
  skipped: "was not compared with",
  warn: "",
  pass: "",
};

/**
 * Numbers on this tab that last night's audit did not confirm: the check
 * failed, errored or was skipped, its group crashed, its source is not
 * configured, it is missing from the run, or no run happened in 26 hours.
 */
export function unverifiedFlags(
  scope: TrustScope,
  run: AuditRun | null,
  now: Date,
  auditError: string | null = null,
): UnverifiedFlag[] {
  const covers = CHECK_COVERS.filter((cover) => cover.tab === scope);
  const byId = new Map((run?.checks ?? []).map((c) => [c.checkId, c]));
  const stale =
    !run ||
    (now.getTime() - new Date(run.runAt).getTime()) / HOUR_MS >
      AUDIT_MISSING_AFTER_HOURS;

  return covers.flatMap((cover): UnverifiedFlag[] => {
    const base = { metric: cover.metric, number: cover.number };
    if (!run || stale) {
      return [
        {
          ...base,
          ...expectedWindow(cover.window, now),
          reason: auditError
            ? `Unverified: the audit results could not be read (${auditError}).`
            : !run
              ? "Unverified: no audit run is stored, so this number has never been checked."
              : `Not checked last night: the newest audit run is from ${run.runAt.slice(0, 10)}.`,
        },
      ];
    }
    const runAt = new Date(run.runAt);
    const check = byId.get(cover.checkId);
    if (check) {
      if (check.status === "pass" || check.status === "warn") return [];
      return [
        {
          ...base,
          ...(rangeOf(check.window) ?? expectedWindow(cover.window, runAt)),
          reason: `Last night's check "${check.label}" (${check.window}) ${WHY[check.status]} the source: ${check.detail}`,
        },
      ];
    }
    const standIn = cover.standIns
      .map((id) => byId.get(id))
      .find((row) => row && row.status !== "pass");
    return [
      {
        ...base,
        ...expectedWindow(cover.window, runAt),
        reason: standIn
          ? `Not checked last night: "${standIn.label}" did not run. ${standIn.detail}`
          : "Not checked last night: this check is missing from the latest audit run.",
      },
    ];
  });
}

/**
 * The flag for one metric whose window overlaps the days a number shows.
 * Without `shown`, any flag for the metric matches.
 */
export function flagFor(
  flags: readonly UnverifiedFlag[] | undefined,
  metric: CoveredMetric,
  shown?: DayRange,
): UnverifiedFlag | undefined {
  return flags?.find(
    (flag) =>
      flag.metric === metric &&
      (!shown || (flag.from <= shown.to && flag.to >= shown.from)),
  );
}

/** A calendar month (YYYY-MM) as the days it spans. */
export function monthRange(month: string): DayRange {
  return { from: `${month}-01`, to: `${month}-31` };
}

// ---------------------------------------------------------------------------
// One tab's bar
// ---------------------------------------------------------------------------

export type TrustBarModel = {
  scope: TrustScope;
  /** Oldest last update among this tab's feeds; null when any never updated. */
  asOf: string | null;
  freshnessTone: TrustTone;
  /** Connected feeds that are not healthy, worst first. */
  problems: FeedVerdict[];
  /** Connected feeds this tab reads; `asOf` is the oldest of them. */
  feedCount: number;
  /** Feeds that have never delivered data. Not in `asOf`, `problems` or the tone. */
  notConnected: FeedVerdict[];
  audit: AuditVerdict;
  flags: UnverifiedFlag[];
};

const TONE_RANK: Record<TrustTone, number> = { bad: 0, warn: 1, ok: 2 };

export function buildTrustBar(input: {
  scope: TrustScope;
  feeds: readonly FeedObservation[];
  run: AuditRun | null;
  auditError?: string | null;
  now: Date;
}): TrustBarModel {
  const wanted = new Set(TAB_FEEDS[input.scope]);
  const verdicts = input.feeds
    .filter((obs) => wanted.has(obs.feed))
    .map((obs) => judgeFeed(obs, input.now));
  // A feed the tab needs but the reader never reported is not fresh.
  for (const feed of wanted) {
    if (!verdicts.some((verdict) => verdict.feed === feed)) {
      verdicts.push(judgeFeed({ feed, lastSuccessAt: null }, input.now));
    }
  }
  const notConnected = verdicts.filter((verdict) => !verdict.connected);
  const connected = verdicts.filter((verdict) => verdict.connected);
  const problems = connected
    .filter((verdict) => verdict.tone !== "ok")
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
  const times = connected.map((verdict) => verdict.lastSuccessAt);
  const asOf = times.includes(null)
    ? null
    : ((times as string[]).sort().at(0) ?? null);
  return {
    scope: input.scope,
    asOf,
    freshnessTone: problems[0]?.tone ?? "ok",
    problems,
    feedCount: connected.length,
    notConnected,
    audit: judgeAudit(input.run, input.now, input.auditError ?? null),
    flags: unverifiedFlags(
      input.scope,
      input.run,
      input.now,
      input.auditError ?? null,
    ),
  };
}
