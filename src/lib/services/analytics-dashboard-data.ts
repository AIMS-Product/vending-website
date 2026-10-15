import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { resolveChannel } from "@/lib/analytics/channel";
import { flowChannelForFunnel } from "@/lib/analytics/channel-flow";
import {
  addDays,
  reportingDay,
  type DashboardWindow,
} from "@/lib/analytics/dashboard-window";
import {
  collapseToLeads,
  lookbackStart,
} from "@/lib/analytics/lead-definition";
import { QUALIFIED_BANDS } from "@/lib/analytics/weekly-scorecard";
import {
  costPerBookedByMonth,
  isReactivation,
  monthKeys,
  type CostRow,
} from "@/lib/analytics/dashboard-metrics";
import { config } from "@/lib/config";
import { isChatbotCapture } from "@/lib/services/admin-analytics-internal";
import {
  fetchBookings,
  fetchFunnels,
} from "@/lib/services/booked-metrics-data";
import {
  REPORTING_TIME_ZONE,
  readBookedMetric,
  type BookingRow,
  type FunnelRow,
} from "@/lib/services/booked-metrics";
import { getCacPageData } from "@/lib/services/cac-report-data";
import { fetchFacts } from "@/lib/services/channel-report";
import {
  normaliseFacts,
  type ChannelFact,
} from "@/lib/services/channel-report-rollup";
import {
  cachedCloseReads,
  fetchCloseDeals,
  type CloseDeal,
} from "@/lib/services/close-wins";
import { getV2Calls } from "@/lib/services/booked-calls-v2-data";
import type { CloseCall } from "@/lib/services/close-week-view";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { readAllPages } from "@/lib/services/paged-read";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reads behind /admin/analytics. Each source is read once per request
 * (React `cache`) and comes back as its own result, so a failed read blanks
 * only the cards built on it and says why. Nothing here returns a zero for
 * "could not read".
 */

export type Read<T> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(
  label: string,
  run: () => Promise<T>,
): Promise<Read<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`analytics dashboard: ${label} failed`, { message });
    return { ok: false, error: `${label} could not be read.` };
  }
}

const PAGE = 1000;
const MAX_ROWS = 60_000;

type DashboardCall = CloseCall & {
  email: string | null;
  setter: string | null;
};

/**
 * Booked calls in [from, to] (reporting days) under Dom's rule
 * (booked_calls.v2.2, live since 2026-10-14): one per counted Close meeting,
 * dated by the day it was booked. `marketingOnly` keeps the calls the
 * marketing team booked (drops Lane 2 and Social DMs).
 */
export const readCalls = cache(
  async (from: string, to: string, marketingOnly = false) => {
    const calls = await readAllCalls(from, to);
    if (!marketingOnly || !calls.ok) return calls;
    return {
      ok: true as const,
      data: calls.data.filter((c) => !isReactivation(c)),
    };
  },
);

const readAllCalls = cache((from: string, to: string) =>
  attempt("Booked calls V2", async () => {
    const calls = await getV2Calls(from, to);
    if (!calls.ok) throw new Error(calls.error);
    return calls.calls as DashboardCall[];
  }),
);

type DashboardLead = {
  /** Reporting-time-zone day the person first submitted. */
  day: string;
  channel: string;
  /** False while the lead has not reached Close. */
  inClose: boolean;
  createdAt: string;
};

/** Site leads (§4): one person per 30-day run, internal and newsletter out. */
export const readLeads = cache((from: string) =>
  attempt("Site leads", async () => {
    const client = createAdminClient();
    const { rows, error } = await readAllPages<{
      email: string | null;
      created_at: string;
      full_name: string | null;
      lifecycle_status: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      metadata: unknown;
      close_sync_status: string | null;
    }>(
      (start, end, count) =>
        client
          .from("lead_submissions")
          .select(
            "email,created_at,full_name,lifecycle_status,utm_source,utm_medium,metadata,close_sync_status",
            { count },
          )
          .gte("created_at", lookbackStart(`${from}T00:00:00Z`).toISOString())
          .order("created_at")
          .order("id")
          .range(start, end),
      { pageSize: PAGE, maxRows: MAX_ROWS },
    );
    if (error) throw new Error(error.message);
    return collapseToLeads(rows)
      .map(
        (lead): DashboardLead => ({
          day: reportingDay(new Date(lead.created_at)),
          channel: resolveChannel(lead.utm_source, {
            medium: lead.utm_medium,
            capturedByChatbot:
              !lead.utm_source?.trim() && isChatbotCapture(lead.metadata),
          }).channel,
          inClose: lead.close_sync_status === "synced",
          createdAt: lead.created_at,
        }),
      )
      .filter((lead) => lead.day >= from);
  }),
);

/**
 * Reporting days of site form fills the qualification quiz scored into a
 * calling band (`QUALIFIED_BANDS`), from `from` on. One per submission.
 */
export const readQualifiedDays = cache((from: string) =>
  attempt("Scored site forms", async () => {
    const client = createAdminClient();
    const { rows, error } = await readAllPages<{
      created_at: string;
      band: string | null;
    }>(
      (start, end, count) =>
        client
          .from("lead_submissions")
          .select(
            "created_at,band:qualification_summary->>qualification_band",
            {
              count,
            },
          )
          .gte("created_at", `${from}T00:00:00Z`)
          .order("created_at")
          .order("id")
          .range(start, end),
      { pageSize: PAGE, maxRows: MAX_ROWS },
    );
    if (error) throw new Error(error.message);
    return rows
      .filter((row) => row.band != null && QUALIFIED_BANDS.has(row.band))
      .map((row) => reportingDay(new Date(row.created_at)));
  }),
);

/**
 * Leads from the last week still not in Close. A lead is handed over within
 * minutes (a 2-minute cron plus a drain on submit), so one still outside
 * after 15 minutes needs a person. Null when leads could not be read.
 */
export async function leadsNotInClose(
  from: string,
  today: string,
): Promise<number | null> {
  const leads = await readLeads(from);
  if (!leads.ok) return null;
  const cutoff = Date.now() - 15 * 60_000;
  const weekAgo = addDays(today, -7);
  return leads.data.filter(
    (l) => !l.inClose && l.day >= weekAgo && Date.parse(l.createdAt) < cutoff,
  ).length;
}

/** The channel spine through the one lead definition, channels re-derived. */
export const readFacts = cache((from: string, to: string) =>
  attempt("The channel spine", async () => {
    const facts = await fetchFacts(createAdminClient(), from, to);
    if (facts === null) throw new Error("channel_daily is not available");
    return normaliseFacts(facts) as ChannelFact[];
  }),
);

/**
 * Won Close opportunities dated in [from, to]. Dom's rule says nothing about
 * wins, so `marketingOnly` drops deals whose Close funnel is a Lane 2 funnel.
 */
export const readDeals = cache(
  async (from: string, to: string, marketingOnly = false) => {
    const deals = await readAllDeals(from, to);
    if (!marketingOnly || !deals.ok) return deals;
    return {
      ok: true as const,
      data: deals.data.filter(
        (d) => flowChannelForFunnel(d.funnel) !== "reactivation",
      ),
    };
  },
);

const readAllDeals = cache((from: string, to: string) =>
  attempt("Close won deals", async (): Promise<CloseDeal[]> => {
    if (!config.CLOSE_API_KEY) throw new Error("CLOSE_API_KEY is not set");
    return fetchCloseDeals({
      from,
      to,
      close: cachedCloseReads(),
      mirror: createAdminClient(),
    });
  }),
);

/**
 * Cost per booked call by month for the six months to `today` (§9). The
 * spine over six months is the slowest read on the dashboard (~6s), and the
 * finished months in it do not move, so the computed rows are kept for 15
 * minutes. A failed read throws, and a throw is never cached.
 */
const cachedCostRows = unstable_cache(
  async (today: string): Promise<CostRow[]> => {
    const [y, m] = today.split("-").map(Number) as [number, number];
    const from = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);
    const facts = await fetchFacts(createAdminClient(), from, today);
    if (facts === null) throw new Error("channel_daily is not available");
    const months = monthKeys(addDays(`${today.slice(0, 7)}-01`, -150), today);
    return costPerBookedByMonth(normaliseFacts(facts) as ChannelFact[], months);
  },
  ["analytics-dashboard-cost-per-booked"],
  { revalidate: 900 },
);

export const readCostByMonth = cache((today: string) =>
  attempt("The channel spine", () => cachedCostRows(today)),
);

const readBookingInputs = cache(() =>
  attempt("Calendly bookings", async () => {
    const client = createAdminClient();
    const today = reportingDay();
    const [bookings, funnels] = await Promise.all([
      fetchBookings(client, addDays(today, -14)),
      fetchFunnels(client),
    ]);
    if (!bookings || !funnels) throw new Error("bookings or mirror unreadable");
    return { bookings, funnels };
  }),
);

export type BookedOnDay = {
  /** New calls booked that day, Lane 2 out (§5 booked-call measures). */
  newBooked: number | null;
  /** First calls on the calendar that day (§5). */
  onCalendar: number | null;
};

/** The two booked-call measures for each day asked, from one read. */
export async function readBookedOn(
  days: readonly string[],
): Promise<Read<Record<string, BookedOnDay>>> {
  const inputs = await readBookingInputs();
  if (!inputs.ok) return inputs;
  const base: {
    bookings: BookingRow[];
    funnels: FunnelRow[];
    timeZone: string;
  } = {
    ...inputs.data,
    timeZone: REPORTING_TIME_ZONE,
  };
  return {
    ok: true,
    data: Object.fromEntries(
      days.map((day) => [
        day,
        {
          newBooked: readBookedMetric("newBookedOn", { ...base, day }).value,
          onCalendar: readBookedMetric("firstCallsOnCalendar", { ...base, day })
            .value,
        },
      ]),
    ),
  };
}

type CacPoint = { month: string; label: string; cac: number | null };

/**
 * §10 blended CAC for the newest months that have typed inputs, oldest
 * first. The model is monthly and typed by hand, so the dashboard shows the
 * latest month it covers and says which.
 */
export const readCac = cache(() =>
  attempt("CAC inputs", async (): Promise<CacPoint[]> => {
    const latest = await getCacPageData(undefined);
    if (latest.unavailable) throw new Error(latest.unavailable);
    const months = latest.months.slice(0, 6);
    const reports = await Promise.all(
      months.map((m) =>
        m.month === latest.report?.month ? latest : getCacPageData(m.month),
      ),
    );
    return months
      .map((m, i) => ({
        month: m.month.slice(0, 7),
        label: m.label,
        cac: reports[i]?.report?.total.cac ?? null,
      }))
      .reverse();
  }),
);

export const readTrust = cache(() => getTrustBar("dashboard"));

/**
 * The earliest day any card needs: the prior window, or two weeks back,
 * whichever is earlier.
 */
export function callSpan(window: DashboardWindow): {
  from: string;
  to: string;
} {
  // Two weeks back: "same day last week", and a sparkline for short windows.
  const weekBack = addDays(window.today, -14);
  return {
    from: window.prior.startDay < weekBack ? window.prior.startDay : weekBack,
    to: window.today,
  };
}
