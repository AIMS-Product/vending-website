import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertion,
  compare,
  type AuditResult,
} from "@/lib/services/data-audit";
import type { CloseMonthlyReport } from "@/lib/services/close-monthly-funnel-data";
import {
  funnelForChannel,
  getMonthlyLeads,
} from "@/lib/services/close-monthly-leads";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

export type MomCloseClient = {
  listWonOpportunities(input: {
    from: string;
    to: string;
    skip: number;
  }): Promise<{ data?: Array<{ value?: number | null }>; has_more?: boolean }>;
};

/** 100 opportunities a page; 50 pages is far above any month's wins. */
const MAX_PAGES = 50;

/**
 * The month-over-month tab's CW %, Revenue and Leads, for the last fully
 * closed month. Booked is already checked against Close (close-first-calls);
 * until this, nothing checked the other three against anything.
 *
 * "Ours" is the tab's own loader, so what is verified is the number on screen.
 */
export async function monthOverMonthChecks(
  client: Client,
  close: MomCloseClient | null,
  now: Date,
  loadTab: (input: { now: Date }) => Promise<CloseMonthlyReport>,
): Promise<AuditResult[]> {
  // The tab cannot load without Close; close-config already reports that.
  if (!close) return [];
  const month = lastClosedMonth(now);
  const report = await loadTab({ now });
  if (!report.ok) {
    throw new Error(`The month-over-month tab did not load: ${report.error}`);
  }
  const totals = report.funnel.months.find((m) => m.key === month.key)?.totals;
  const fromClose = await closeWonForMonth(close, month);
  const shared = { window: month.label, sourceName: "Close" };

  return [
    compare({
      ...shared,
      checkId: "mom-won",
      label: "Month over month: closed won",
      ours: totals?.won ?? 0,
      source: fromClose.won,
      tolerancePct: 3,
      note: "Opportunities Close marks won that month, by date won: the grid's CW % numerator.",
    }),
    compare({
      ...shared,
      checkId: "mom-revenue",
      label: "Month over month: revenue",
      ours: totals?.revenue ?? 0,
      source: fromClose.revenue,
      tolerancePct: 3,
      unit: "money",
      note: "Value of those won opportunities, read from Close.",
    }),
    await leadsByChannelCheck(client, report, month),
  ];
}

type Month = {
  key: string;
  from: string;
  exclusiveEnd: string;
  label: string;
};

export function lastClosedMonth(now: Date): Month {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const from = start.toISOString().slice(0, 10);
  const last = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10);
  return {
    key: from.slice(0, 7),
    from,
    exclusiveEnd: end.toISOString().slice(0, 10),
    label: `${from} to ${last}`,
  };
}

/**
 * Every opportunity Close marks won in the month, read straight from Close
 * rather than through the tab's cached read: the grid credits wins by the day
 * they were won (Dom's rule counts meetings, so a win read off the lead row
 * would count once per counted call).
 */
async function closeWonForMonth(close: MomCloseClient, month: Month) {
  const last = new Date(
    Date.parse(`${month.exclusiveEnd}T00:00:00Z`) - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  let won = 0;
  let cents = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await close.listWonOpportunities({
      from: month.from,
      to: last,
      skip: page * 100,
    });
    for (const opportunity of result.data ?? []) {
      won += 1;
      cents += opportunity.value ?? 0;
    }
    if (!result.has_more) break;
  }
  return { won, revenue: cents / 100 };
}

/**
 * Every lead in lead_submissions for the month, by channel, against what the
 * grid shows for that channel's funnel. A funnel with leads but no booked call
 * that month has no row on the grid, so its leads would vanish without this.
 *
 * Counted over the tab's own window, not just the month: a lead is one person
 * per 30 days, so a narrower window would split people the tab counts once.
 */
async function leadsByChannelCheck(
  client: Client,
  report: Extract<CloseMonthlyReport, { ok: true }>,
  month: Month,
): Promise<AuditResult> {
  const stored = await getMonthlyLeads(client, {
    from: report.from,
    to: report.to,
  });
  const shownFor = (funnel: string) =>
    report.funnel.rows.find((row) => row.label === funnel)?.byMonth[month.key]
      ?.leads ?? 0;

  const mismatches: string[] = [];
  const unmapped: string[] = [];
  let lost = 0;
  for (const [key, count] of stored.byChannel) {
    const [monthKey, channel] = key.split("|");
    if (monthKey !== month.key) continue;
    const funnel = funnelForChannel(channel);
    if (!funnel) {
      unmapped.push(`${channel} ${count}`);
      continue;
    }
    const shown = shownFor(funnel);
    if (shown !== count) {
      mismatches.push(`${channel}: ${count} stored, ${shown} shown`);
      lost += Math.abs(count - shown);
    }
  }

  const byDesign = unmapped.length
    ? ` Not on the grid by design, having no Close funnel: ${unmapped.join(", ")}.`
    : "";
  return assertion({
    checkId: "mom-leads",
    label: "Month over month: leads by channel",
    window: month.label,
    sourceName: "lead_submissions",
    ok: mismatches.length === 0,
    count: lost,
    detail:
      (mismatches.length === 0
        ? "Every channel's leads match what the grid shows."
        : `The grid disagrees with lead_submissions: ${mismatches.join("; ")}.`) +
      byDesign,
  });
}
