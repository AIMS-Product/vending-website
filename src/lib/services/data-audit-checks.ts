import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { createGa4Client, type Ga4Client } from "@/lib/ga4/client";
import { createCloseClient } from "@/lib/close/client";
import { createGhlClient, type GhlClient } from "@/lib/ghl/client";
import {
  createMetricoolClient,
  type AdNetwork,
  type MetricoolClient,
} from "@/lib/metricool/client";
import type { YouTubeAnalyticsClient } from "@/lib/youtube-analytics/client";
import { youtubeSourceFromConfig } from "@/lib/services/youtube-analytics-sync";
import {
  createCalendlyApiClient,
  type CalendlyApiClient,
} from "@/lib/services/calendly-api";
import { bookingLinkId, channelDailyKey } from "@/lib/services/channel-daily";
import { formSubmissionRows } from "@/lib/services/ghl-sync";
import { resolveFieldIds } from "@/lib/services/close-lead-funnel-sync";
import {
  assertion,
  compare,
  errorResult,
  summariseAudit,
  type AuditResult,
  type AuditSummary,
} from "@/lib/services/data-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

/**
 * Windows. GA4 keeps moving sessions between keys for about two days and the
 * ad platforms restate spend for one, so a check that included yesterday would
 * cry wolf every morning. Each source is checked over days it has settled.
 */
const SETTLED_LAG_DAYS = { ga4: 2, ads: 2, youtube: 3, live: 1 } as const;
const WINDOW_DAYS = 7;
/**
 * Bookings only. A moved booking is stranded forever, so the spine check looks
 * back a quarter rather than the 30 days the spend check uses: the 90 phantom
 * bookings found on 2026-09-21 had been accumulating since June.
 */
const ORPHAN_WINDOW_DAYS = 90;
const ADS_WINDOW_DAYS = 4;

export type DataAuditDeps = {
  client?: Client;
  now?: Date;
  ga4?: Ga4Client | null;
  ghl?: GhlClient | null;
  metricool?: MetricoolClient | null;
  youtube?: YouTubeAnalyticsClient | null;
  calendly?: CalendlyApiClient | null;
  close?: CloseSearchClient | null;
};

export type CloseSearchClient = {
  listCustomFields(
    scope: "lead",
  ): Promise<{ data?: Parameters<typeof resolveFieldIds>[0] }>;
  searchLeads(body: Record<string, unknown>): Promise<{
    count?: { total?: number };
    data?: unknown[];
  }>;
};

export type DataAuditRun = {
  runAt: string;
  results: AuditResult[];
  summary: AuditSummary;
};

/**
 * Asks every source system what it has, puts it beside what we stored, and
 * returns one verdict per check. A source that throws becomes one failed
 * check, never a failed run: the other twelve answers are still worth having.
 */
export async function runDataAudit(
  deps: DataAuditDeps = {},
): Promise<DataAuditRun> {
  const now = deps.now ?? new Date();
  const client = deps.client ?? createAdminClient();
  const ga4 = deps.ga4 === undefined ? ga4FromConfig() : deps.ga4;
  const ghl = deps.ghl === undefined ? ghlFromConfig() : deps.ghl;
  const metricool =
    deps.metricool === undefined ? metricoolFromConfig() : deps.metricool;
  const youtubeSource =
    deps.youtube === undefined
      ? youtubeSourceFromConfig()
      : deps.youtube && { client: deps.youtube, sourceName: "YouTube" };
  const calendly =
    deps.calendly === undefined ? calendlyFromConfig() : deps.calendly;
  const close = deps.close === undefined ? closeFromConfig() : deps.close;

  const results = [
    ...(await safe("ga4", () => ga4Checks(client, ga4, now))),
    ...(await safe("close", () => closeChecks(client, close, now))),
    ...(await safe("calendly", () => calendlyChecks(client, calendly, now))),
    ...(await safe("ads", () => adSpendCheck(client, metricool, now))),
    ...(await safe("ghl", () => ghlFormsCheck(client, ghl, now))),
    ...(await safe("youtube", () =>
      youtubeCheck(client, youtubeSource || null, now),
    )),
    ...(await safe("webinar", () => webinarFreshnessCheck(client, now))),
    ...(await safe("spine", () => spineChecks(client, now))),
    ...(await safe("leads", () => leadsInCloseCheck(client, now))),
    ...(await safe("connectors", () => connectorHealthCheck(client, now))),
  ];

  return {
    runAt: now.toISOString(),
    results,
    summary: summariseAudit(results),
  };
}

/** A whole check group that threw still reports, as one error row. */
async function safe(
  group: string,
  run: () => Promise<AuditResult[]>,
): Promise<AuditResult[]> {
  try {
    return await run();
  } catch (error) {
    return [
      errorResult(`${group}-group`, group, "the checked window", group, error),
    ];
  }
}

async function ga4Checks(
  client: Client,
  ga4: Ga4Client | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, to, label } = settledWindow(now, SETTLED_LAG_DAYS.ga4);
  const shared = { window: label, sourceName: "Google Analytics" };
  if (!ga4) {
    return [
      assertion({
        ...shared,
        checkId: "ga4-config",
        label: "Visits checked against Google Analytics",
        ok: false,
        detail: "GA4 is not configured, so no visit number was verified.",
      }),
    ];
  }
  const sessions = await ga4.fetchChannelSessions({
    startDate: from,
    endDate: to,
  });
  const source = sessions.reduce((total, row) => total + row.sessions, 0);

  const [spine, pageViews] = await Promise.all([
    sumColumn(client, "channel_daily", "visits", (query) =>
      query.gte("day", from).lte("day", to),
    ),
    sumColumn(client, "ga4_page_views", "sessions", (query) =>
      query.gte("day", from).lte("day", to),
    ),
  ]);

  return [
    compare({
      ...shared,
      checkId: "ga4-visits-spine",
      label: "Channels & KPI visits",
      ours: spine,
      source,
      tolerancePct: 2,
      note: "Channels and KPI divide their rates by this.",
    }),
    compare({
      ...shared,
      checkId: "ga4-page-views",
      label: "Funnels & Executive visits",
      ours: pageViews,
      source,
      tolerancePct: 2,
    }),
  ];
}

/**
 * Close's own count of first calls booked in the window, against the mirror
 * every Close-based tab reads. Catches a stalled crawl and a mirror that kept
 * leads whose booked date was cleared.
 */
async function closeChecks(
  client: Client,
  close: CloseSearchClient | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, to, label, exclusiveEnd } = settledWindow(
    now,
    SETTLED_LAG_DAYS.live,
  );
  const shared = { window: label, sourceName: "Close" };
  const freshness = await mirrorFreshness(client, now);
  if (!close) {
    return [
      freshness,
      assertion({
        ...shared,
        checkId: "close-config",
        label: "First calls checked against Close",
        ok: false,
        detail: "CLOSE_API_KEY is not set, so no Close number was verified.",
      }),
    ];
  }

  const definitions = await close.listCustomFields("lead");
  const fieldIds = resolveFieldIds(definitions.data ?? []);
  if (!fieldIds.bookedDate) {
    throw new Error("Close has no 'First Sales Call Booked Date' field.");
  }
  // `include_counts` returns the total without paging 8,000 leads.
  const search = await close.searchLeads({
    query: {
      type: "and",
      queries: [
        { type: "object_type", object_type: "lead" },
        {
          type: "field_condition",
          field: { type: "custom_field", custom_field_id: fieldIds.bookedDate },
          condition: {
            type: "moment_range",
            on_or_after: {
              type: "fixed_local_date",
              value: from,
              which: "start",
            },
            before: {
              type: "fixed_local_date",
              value: exclusiveEnd,
              which: "start",
            },
          },
        },
      ],
    },
    _fields: { lead: ["id"] },
    _limit: 1,
    include_counts: true,
  });
  const source = search.count?.total ?? null;

  const ours = await countRows(client, "close_lead_funnel", (query) =>
    query
      .gte("first_sales_call_booked_date", from)
      .lte("first_sales_call_booked_date", to),
  );

  return [
    freshness,
    compare({
      ...shared,
      checkId: "close-first-calls",
      label: "First calls booked (before exclusions)",
      ours,
      source,
      tolerancePct: 1,
      note: "The Close view subtracts canceled and out-of-US leads from this.",
    }),
  ];
}

async function mirrorFreshness(client: Client, now: Date) {
  const { data } = await client
    .from("close_lead_funnel")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1);
  const syncedAt = data?.[0]?.synced_at ?? null;
  const ageHours = syncedAt
    ? (now.getTime() - new Date(syncedAt).getTime()) / 3_600_000
    : null;
  return assertion({
    checkId: "close-mirror-fresh",
    label: "Close mirror is current",
    window: "now",
    sourceName: "Close",
    ok: ageHours !== null && ageHours <= 3,
    detail:
      ageHours === null
        ? "The Close mirror has never been written."
        : `Last crawled ${round1(ageHours)} hours ago; it runs hourly.`,
  });
}

async function calendlyChecks(
  client: Client,
  calendly: CalendlyApiClient | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, label, exclusiveEnd } = settledWindow(
    now,
    SETTLED_LAG_DAYS.live,
  );
  const shared = { window: label, sourceName: "Calendly" };
  if (!calendly) {
    return [
      assertion({
        ...shared,
        checkId: "calendly-config",
        label: "Bookings checked against Calendly",
        ok: false,
        detail:
          "CALENDLY_API_TOKEN is not set, so no booking number was verified.",
      }),
    ];
  }
  const organizationUri = await calendly.getCurrentOrganizationUri();
  const events = await calendly.listScheduledEvents({
    organizationUri,
    minStartTime: `${from}T00:00:00.000000Z`,
    maxStartTime: `${exclusiveEnd}T00:00:00.000000Z`,
  });
  const ours = await countRows(client, "calendly_bookings", (query) =>
    query
      .eq("status", "booked")
      .gte("event_start_at", `${from}T00:00:00Z`)
      .lt("event_start_at", `${exclusiveEnd}T00:00:00Z`),
  );

  return [
    compare({
      ...shared,
      checkId: "calendly-bookings",
      label: "Calls on the calendar",
      ours,
      source: events.length,
      tolerancePct: 2,
      note: "Calls scheduled in the window that are still active.",
    }),
  ];
}

async function adSpendCheck(
  client: Client,
  metricool: MetricoolClient | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, to, label } = settledWindow(
    now,
    SETTLED_LAG_DAYS.ads,
    ADS_WINDOW_DAYS,
  );
  const shared = { window: label, sourceName: "the ad platforms" };
  const blogId = (config.METRICOOL_BLOG_IDS ?? config.METRICOOL_BLOG_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];
  if (!metricool || !blogId) {
    return [
      assertion({
        ...shared,
        checkId: "ad-spend-config",
        label: "Ad spend checked against the platforms",
        ok: false,
        detail: "Metricool is not configured, so no spend was verified.",
      }),
    ];
  }

  const networks: readonly AdNetwork[] = ["googleads", "facebookads"];
  let source = 0;
  for (const day of daysBetween(from, to)) {
    for (const network of networks) {
      const campaigns = await metricool.fetchCampaigns({
        blogId,
        network,
        from: day,
        to: day,
      });
      for (const campaign of campaigns) source += campaign.spend ?? 0;
    }
  }
  const ours = await sumColumn(client, "channel_daily", "spend", (query) =>
    query.gte("day", from).lte("day", to),
  );

  return [
    compare({
      ...shared,
      checkId: "ad-spend",
      label: "Ad spend",
      ours: ours === null ? null : round2(ours),
      source: round2(source),
      tolerancePct: 1,
      unit: "money",
      note: "Cost per lead and cost per booked call divide by this.",
    }),
  ];
}

async function ghlFormsCheck(
  client: Client,
  ghl: GhlClient | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, to, label, exclusiveEnd } = settledWindow(
    now,
    SETTLED_LAG_DAYS.live,
  );
  const shared = { window: label, sourceName: "GoHighLevel" };
  if (!ghl) {
    return [
      assertion({
        ...shared,
        checkId: "ghl-config",
        label: "Off-site forms checked against GoHighLevel",
        ok: false,
        detail: "GHL is not configured, so no form number was verified.",
      }),
    ];
  }
  const [forms, submissions] = await Promise.all([
    ghl.listForms(),
    // `endAt` is exclusive: the window's own last day comes back empty.
    ghl.fetchFormSubmissions({ startAt: from, endAt: exclusiveEnd }),
  ]);
  const rows = formSubmissionRows(
    submissions,
    new Map(forms.map((form) => [form.id, form.name])),
  ).filter((row) => row.day >= from && row.day <= to);
  const source = rows.length;

  // Compares the same keys the connector writes, so a routing change cannot
  // quietly move submissions out of the comparison.
  const campaigns = [
    ...new Set(rows.map((row) => channelDailyKey(row).campaign)),
  ];
  const ours =
    campaigns.length === 0
      ? 0
      : await sumColumn(client, "channel_daily", "leads", (query) =>
          query.gte("day", from).lte("day", to).in("campaign", campaigns),
        );

  return [
    compare({
      ...shared,
      checkId: "ghl-forms",
      label: "Off-site form fills",
      ours,
      source,
      tolerancePct: 1,
      note: "Webinar registration forms are counted separately, as registrations.",
    }),
  ];
}

async function youtubeCheck(
  client: Client,
  youtube: { client: YouTubeAnalyticsClient; sourceName: string } | null,
  now: Date,
): Promise<AuditResult[]> {
  const { from, to, label } = settledWindow(now, SETTLED_LAG_DAYS.youtube);
  const shared = {
    window: label,
    sourceName: youtube?.sourceName ?? "YouTube",
  };
  if (!youtube) {
    return [
      assertion({
        ...shared,
        checkId: "youtube-config",
        label: "Views checked against YouTube",
        ok: false,
        detail:
          "YouTube OAuth is not connected, so no view count was verified.",
      }),
    ];
  }
  let source = 0;
  for (const day of daysBetween(from, to)) {
    const rows = await youtube.client.fetchVideoDay(day);
    for (const row of rows) source += row.views ?? 0;
  }
  const ours = await sumColumn(
    client,
    "youtube_video_daily",
    "views",
    (query) => query.gte("day", from).lte("day", to),
  );

  return [
    compare({
      ...shared,
      checkId: "youtube-views",
      label: "YouTube views",
      ours,
      source,
      tolerancePct: 2,
    }),
  ];
}

async function webinarFreshnessCheck(
  client: Client,
  now: Date,
): Promise<AuditResult[]> {
  const { data } = await client
    .from("webinar_events")
    .select("date,received_at,registrations")
    .order("date", { ascending: false })
    .limit(1);
  const latest = data?.[0] ?? null;
  const ageDays = latest?.received_at
    ? (now.getTime() - new Date(latest.received_at).getTime()) / 86_400_000
    : null;
  return [
    assertion({
      checkId: "webinar-push",
      label: "Webinar numbers are arriving",
      window: "latest webinar",
      sourceName: "the webinar sheet",
      ok: ageDays !== null && ageDays <= 8,
      count: latest?.registrations ?? null,
      detail:
        latest === null
          ? "No webinar has ever been received."
          : `Latest is ${latest.date} with ${latest.registrations ?? 0} registrations, received ${round1(ageDays ?? 0)} days ago.`,
    }),
  ];
}

/** Invariants that need no outside system: the shapes past bugs left behind. */
async function spineChecks(client: Client, now: Date): Promise<AuditResult[]> {
  const from = dayKey(addDays(now, -30));
  const to = dayKey(addDays(now, -1));
  const rows = await pageAll<{
    day: string;
    source: string;
    campaign: string;
    content: string;
  }>(client, "channel_daily", "day,source,medium,campaign,content", (query) =>
    query.gte("day", from).lte("day", to).not("spend", "is", null),
  );
  const contentsByCampaignDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.day}\u0000${row.source}\u0000${row.campaign}`;
    contentsByCampaignDay.set(
      key,
      (contentsByCampaignDay.get(key) ?? new Set()).add(row.content),
    );
  }
  const forked = [...contentsByCampaignDay.values()].filter(
    (contents) => contents.size > 1,
  ).length;

  const holes = await findDayHoles(client, now);
  const orphans = await orphanedBookingsCheck(client, now);

  return [
    orphans,
    assertion({
      checkId: "spine-forked-spend",
      label: "No campaign day counted twice",
      window: "last 30 days",
      sourceName: "our spine",
      ok: forked === 0,
      count: forked,
      detail:
        forked === 0
          ? "Every campaign day holds one spend row."
          : `${forked} campaign days hold spend under two different campaign names, so that spend is counted twice.`,
    }),
    holes,
  ];
}

type BookingRow = {
  day: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
  booked: number | null;
  synced_at: string;
};

/**
 * Bookings stranded on the day they were dated to before they moved.
 *
 * `channel_daily` is rebuilt by upsert and an upsert never deletes, so when a
 * booking's day changes the sync writes the new day and the old row keeps its
 * count; the rollup then sums both. `clearMovedBookingRows` in `channel-sync`
 * blanks them and this is the check that the blanking is working. Nothing
 * compared `booked` to anything before, which is how 90 phantom bookings
 * survived from June to September 2026 (REPORTING.md section 3).
 *
 * `synced_at` cannot say a row is stale on its own — three connectors write
 * this table and each one's write bumps the column. Among rows that carry a
 * booking it can, because only the booking writers set `booked` and they
 * rewrite a day's booking rows in one pass, so a booking row stamped an older
 * day than the newest booking row on its own day was not regenerated. Stamps
 * are compared by day, not instant: the connectors run minutes apart inside
 * one cron, and a manual run lands hours later without meaning staleness.
 *
 * Counted only when the same link holds a booking on another day, the
 * restriction `clearMovedBookingRows` applies for the same reason: a booking
 * on a link with no surviving booking anywhere has nowhere to move to, so it
 * can only be deleted by hand. Two such rows are standing and documented
 * (REPORTING.md section 9) rather than fixable, and a check that failed on
 * them every night would be ignored by the second week.
 */
async function orphanedBookingsCheck(
  client: Client,
  now: Date,
): Promise<AuditResult> {
  const from = dayKey(addDays(now, -ORPHAN_WINDOW_DAYS));
  const to = dayKey(addDays(now, -1));
  const rows = await pageAll<BookingRow>(
    client,
    "channel_daily",
    "day,source,medium,campaign,content,destination,booked,synced_at",
    (query) => query.gte("day", from).lte("day", to).gt("booked", "0"),
  );

  const newestByDay = new Map<string, string>();
  const daysByLink = new Map<string, Set<string>>();
  for (const row of rows) {
    const stamp = row.synced_at.slice(0, 10);
    if (stamp > (newestByDay.get(row.day) ?? ""))
      newestByDay.set(row.day, stamp);
    const link = bookingLinkId(row);
    daysByLink.set(link, (daysByLink.get(link) ?? new Set()).add(row.day));
  }

  const orphans = rows.filter(
    (row) =>
      row.synced_at.slice(0, 10) < (newestByDay.get(row.day) ?? "") &&
      (daysByLink.get(bookingLinkId(row))?.size ?? 0) > 1,
  );
  const bookings = orphans.reduce(
    (sum, row) => sum + Number(row.booked ?? 0),
    0,
  );
  const days = [...new Set(orphans.map((row) => row.day))].sort();

  return assertion({
    checkId: "spine-orphaned-bookings",
    label: "No booking counted on a day it moved off",
    window: `${from} to ${to}`,
    sourceName: "our spine",
    ok: orphans.length === 0,
    count: bookings,
    detail:
      orphans.length === 0
        ? "Every stored booking was written by the latest sync of its own day."
        : `${bookings} bookings sit on ${orphans.length} rows the latest sync of their own day did not rewrite, so they are counted twice. Days affected: ${days.join(", ")}.`,
  });
}

/**
 * A day with nothing where the days around it are busy. This is what a failed
 * fetch leaves behind, and a missing day is invisible in a monthly total.
 */
async function findDayHoles(client: Client, now: Date): Promise<AuditResult> {
  const from = dayKey(addDays(now, -15));
  // Each probe ends where its source has settled. YouTube Analytics reports
  // about three days late, and ending it two days back failed this check every
  // night on a day that then filled in by itself.
  const probes = [
    {
      table: "channel_daily",
      column: "visits",
      label: "visits",
      lag: SETTLED_LAG_DAYS.ga4,
    },
    {
      table: "youtube_video_daily",
      column: "views",
      label: "YouTube views",
      lag: SETTLED_LAG_DAYS.youtube,
    },
  ] as const;

  const holes: string[] = [];
  for (const probe of probes) {
    const to = dayKey(addDays(now, -probe.lag));
    const rows = await pageAll<Record<string, unknown>>(
      client,
      probe.table,
      `day,${probe.column}`,
      (query) =>
        query.gte("day", from).lte("day", to).not(probe.column, "is", null),
    );
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const day = String(row.day);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(row[probe.column] ?? 0));
    }
    const days = daysBetween(from, to);
    const busy = days.filter((day) => (byDay.get(day) ?? 0) > 0).length;
    if (busy < 3) continue; // Nothing to compare against.
    for (const day of days) {
      if ((byDay.get(day) ?? 0) === 0) holes.push(`${probe.label} on ${day}`);
    }
  }

  return assertion({
    checkId: "day-holes",
    label: "No day is missing",
    window: `${from} to ${dayKey(addDays(now, -SETTLED_LAG_DAYS.ga4))} (YouTube to ${dayKey(addDays(now, -SETTLED_LAG_DAYS.youtube))})`,
    sourceName: "our tables",
    ok: holes.length === 0,
    count: holes.length,
    detail:
      holes.length === 0
        ? "Every day in the window carries data."
        : `Nothing stored for ${holes.join(", ")}.`,
  });
}

async function leadsInCloseCheck(
  client: Client,
  now: Date,
): Promise<AuditResult[]> {
  const { from, label, exclusiveEnd } = settledWindow(
    now,
    SETTLED_LAG_DAYS.live,
  );
  const [total, missing] = await Promise.all([
    countRows(client, "lead_submissions", (query) =>
      query
        .gte("created_at", `${from}T00:00:00Z`)
        .lt("created_at", `${exclusiveEnd}T00:00:00Z`),
    ),
    countRows(client, "lead_submissions", (query) =>
      query
        .gte("created_at", `${from}T00:00:00Z`)
        .lt("created_at", `${exclusiveEnd}T00:00:00Z`)
        .is("close_lead_id", null),
    ),
  ]);

  return [
    assertion({
      checkId: "leads-reached-close",
      label: "Every lead reached Close",
      window: label,
      sourceName: "Close",
      ok: (missing ?? 0) === 0,
      warnOnly: true,
      count: missing,
      detail:
        (missing ?? 0) === 0
          ? `All ${total ?? 0} leads were handed to Close.`
          : `${missing} of ${total ?? 0} leads never reached Close; a rep will not see them.`,
    }),
  ];
}

async function connectorHealthCheck(
  client: Client,
  now: Date,
): Promise<AuditResult[]> {
  const since = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const { data } = await client
    .from("channel_sync_runs")
    .select("connector,started_at,error")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1000);

  const latest = new Map<string, { error: string | null }>();
  for (const row of data ?? []) {
    if (!latest.has(row.connector)) latest.set(row.connector, row);
  }
  const broken = [...latest.entries()].filter(
    ([, row]) => row.error && !row.error.startsWith("skipped:"),
  );

  return [
    assertion({
      checkId: "connector-health",
      label: "Every connector ran cleanly",
      window: "last 36 hours",
      sourceName: "our connectors",
      // No connector at all is not health: it is a dead cron.
      ok: broken.length === 0 && latest.size > 0,
      count: broken.length,
      detail:
        latest.size === 0
          ? "No connector has run in the last 36 hours."
          : broken.length === 0
            ? `${latest.size} connectors ran without an error.`
            : broken
                .map(([connector, row]) => `${connector}: ${row.error}`)
                .join(" · "),
    }),
  ];
}

/* ---------------------------------------------------------------- helpers */

const PAGE = 1000;

async function pageAll<T>(
  client: Client,
  table: TableName,
  columns: string,
  apply: (query: PostgrestQuery) => PostgrestQuery,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const query = apply(
      client.from(table).select(columns) as unknown as PostgrestQuery,
    )
      .order("day")
      .range(from, from + PAGE - 1);
    const { data, error } = (await (query as unknown as Promise<unknown>)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    // PostgREST caps a read silently; stop only on a short page.
    if (batch.length < PAGE) break;
  }
  return rows;
}

/** Null when no row carried the column: not observed is not zero. */
async function sumColumn(
  client: Client,
  table: TableName,
  column: string,
  apply: (query: PostgrestQuery) => PostgrestQuery,
): Promise<number | null> {
  const rows = await pageAll<Record<string, unknown>>(
    client,
    table,
    `day,${column}`,
    (query) => apply(query).not(column, "is", null),
  );
  if (rows.length === 0) return null;
  return rows.reduce((total, row) => total + Number(row[column] ?? 0), 0);
}

async function countRows(
  client: Client,
  table: TableName,
  apply: (query: PostgrestQuery) => PostgrestQuery,
): Promise<number | null> {
  const query = apply(
    client
      .from(table)
      .select("*", { count: "exact", head: true }) as unknown as PostgrestQuery,
  );
  const { count, error } = (await (query as unknown as Promise<unknown>)) as {
    count: number | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? null;
}

type TableName = keyof Database["public"]["Tables"];

type PostgrestQuery = {
  gte(column: string, value: string): PostgrestQuery;
  gt(column: string, value: string): PostgrestQuery;
  lte(column: string, value: string): PostgrestQuery;
  lt(column: string, value: string): PostgrestQuery;
  eq(column: string, value: string): PostgrestQuery;
  is(column: string, value: null): PostgrestQuery;
  not(column: string, operator: string, value: null): PostgrestQuery;
  in(column: string, values: readonly string[]): PostgrestQuery;
  order(column: string, options?: { ascending: boolean }): PostgrestQuery;
  range(from: number, to: number): PostgrestQuery;
};

/** The window a source has settled, ending `lagDays` before today. */
export function settledWindow(now: Date, lagDays: number, days = WINDOW_DAYS) {
  const to = dayKey(addDays(now, -lagDays));
  const from = dayKey(addDays(now, -lagDays - (days - 1)));
  const exclusiveEnd = dayKey(addDays(now, -lagDays + 1));
  return {
    from,
    to,
    exclusiveEnd,
    label: `${from} to ${to}`,
  };
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (
    let day = new Date(`${from}T00:00:00.000Z`);
    dayKey(day) <= to;
    day = addDays(day, 1)
  ) {
    days.push(dayKey(day));
  }
  return days;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function ga4FromConfig(): Ga4Client | null {
  if (!config.GA4_SERVICE_ACCOUNT_JSON || !config.GA4_PROPERTY_ID) return null;
  try {
    return createGa4Client({
      serviceAccountJson: config.GA4_SERVICE_ACCOUNT_JSON,
      propertyId: config.GA4_PROPERTY_ID,
    });
  } catch {
    return null;
  }
}

function ghlFromConfig(): GhlClient | null {
  if (!config.GHL_API_KEY || !config.GHL_LOCATION_ID) return null;
  return createGhlClient({
    apiKey: config.GHL_API_KEY,
    locationId: config.GHL_LOCATION_ID,
  });
}

function metricoolFromConfig(): MetricoolClient | null {
  if (!config.METRICOOL_API_KEY || !config.METRICOOL_USER_ID) return null;
  return createMetricoolClient({
    apiKey: config.METRICOOL_API_KEY,
    userId: config.METRICOOL_USER_ID,
  });
}

function calendlyFromConfig(): CalendlyApiClient | null {
  if (!config.CALENDLY_API_TOKEN) return null;
  try {
    return createCalendlyApiClient({ token: config.CALENDLY_API_TOKEN });
  } catch {
    return null;
  }
}

function closeFromConfig(): CloseSearchClient | null {
  if (!config.CLOSE_API_KEY) return null;
  return createCloseClient({
    apiKey: config.CLOSE_API_KEY,
  }) as unknown as CloseSearchClient;
}
