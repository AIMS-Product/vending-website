import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFunnelMonthly,
  type FunnelMonthlyReport,
  type FunnelPeriodRow,
} from "@/lib/services/funnel-monthly";
import { fetchFunnelInputs } from "@/lib/services/funnel-monthly-data";
import { getCloseWins, type CloseWinsReport } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * The executive rollup: one row per month, the whole funnel aggregated across
 * every source and page, most recent first.
 *
 * It owns no funnel arithmetic. `buildFunnelMonthly` is run twice over one
 * read — once grouped by channel, once by page — and this file keeps the
 * totals plus both breakdowns side by side. Cohort rules, the visit window
 * clip and every rate therefore come from exactly one place, so a fix there
 * reaches this view without being reimplemented.
 *
 * The only number added here is cost per lead, because spend lives in
 * `channel_daily` and the funnel rollup has never read it.
 */

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

export type ExecutiveMonth = {
  key: string;
  label: string;
  /** Last day the visit columns cover. Print it beside any visit number. */
  visitsEnd: string | null;
  /** First day they cover, in the cutover month only. */
  visitsStart: string | null;
  totals: FunnelPeriodRow;
  byChannel: FunnelPeriodRow[];
  byPage: FunnelPeriodRow[];
  /**
   * Observed ad spend over the days this month could capture a lead. Null
   * means nothing was observed. See `spendFrom`.
   */
  spend: number | null;
  /** First day the spend column covers, when it is not the month's first. */
  spendFrom: string | null;
  /** Spend over leads. Cross-instrument: ad platforms over our own table. */
  costPerLead: number | null;
  /**
   * The same division per channel. A channel nothing was spent on is absent,
   * and the panel renders absent as a dash — never as a free lead.
   */
  costPerLeadByChannel: Record<string, number | null>;
};

export type FunnelExecutiveReport = {
  months: ExecutiveMonth[];
  visitsThrough: string | null;
  /** Channels any spend was observed for. Every other row's CPL is a dash. */
  spendChannels: string[];
  showCoverage: FunnelMonthlyReport["showCoverage"];
  /**
   * Won deals as Close records them, by the month they were won, per channel.
   * Includes buyers who never filled a site form (webinar, reactivation), so
   * it is not the same population as the lead-cohort Won column above.
   */
  closeWins: CloseWinsReport;
  generatedAt: string;
};

/** Channels whose ad spend buys registrations, never site leads. */
const REGISTRATION_SPEND_CHANNELS: ReadonlySet<string> = new Set(["Webinar"]);

/** One month's observed spend, and the same split by channel. */
export type SpendRow = { day: string; channel: string; spend: number | null };

export function buildFunnelExecutive(input: {
  byChannel: FunnelMonthlyReport;
  byPage: FunnelMonthlyReport;
  spend: SpendRow[];
  closeWins?: CloseWinsReport;
}): FunnelExecutiveReport {
  const byDay = new Map<string, number>();
  const byDayChannel = new Map<string, number>();
  const spendChannels = new Set<string>();

  for (const row of input.spend) {
    if (row.spend === null) continue;
    // Webinar ads buy webinar registrations on GHL, not site leads; counted
    // here they tripled August's cost per lead ($117.90 against ~$110 on the
    // paid channels). The Channels tab prices them per registration instead.
    if (REGISTRATION_SPEND_CHANNELS.has(row.channel)) continue;
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.spend);
    const channelKey = `${row.day}\u0000${row.channel}`;
    byDayChannel.set(
      channelKey,
      (byDayChannel.get(channelKey) ?? 0) + row.spend,
    );
    spendChannels.add(row.channel);
  }

  const pagesByMonth = new Map(
    input.byPage.months.map((month) => [month.key, month]),
  );

  const months = input.byChannel.months
    // A month before the site could capture a lead has nothing to say about
    // whether we are improving at capturing them. Dropped only when NOTHING
    // was observed: a month with leads, or with visits, always shows.
    .filter((month) => month.totals.leads > 0 || month.totals.visits !== null)
    .map((month): ExecutiveMonth => {
      // Spend is clipped to the days the month's leads could have arrived on.
      // July 2026 otherwise divides a whole month of spend by five days of
      // leads -- lead capture went live on the 27th -- and prints a cost per
      // lead four times the truth. Rule 4: both sides, the same days.
      const from = month.visitsStart ?? month.start;
      const spend = sumDays(byDay, from, month.end);

      return {
        key: month.key,
        label: month.label,
        visitsEnd: month.visitsEnd,
        visitsStart: month.visitsStart,
        totals: month.totals,
        byChannel: month.rows,
        byPage: pagesByMonth.get(month.key)?.rows ?? [],
        spend,
        spendFrom: month.visitsStart,
        costPerLead: perLead(spend, month.totals.leads),
        costPerLeadByChannel: Object.fromEntries(
          month.rows.map((row) => [
            row.funnel,
            perLead(
              sumDays(byDayChannel, from, month.end, row.funnel),
              row.leads,
            ),
          ]),
        ),
      };
    });

  return {
    months,
    visitsThrough: input.byChannel.visitsThrough,
    spendChannels: [...spendChannels].sort(),
    showCoverage: input.byChannel.showCoverage,
    closeWins: input.closeWins ?? { ok: false, error: "Not read." },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Spend over a day range, or null when no day in it was observed.
 *
 * Null rather than 0 so an unobserved range reads as a dash. A day that was
 * observed and genuinely cost nothing still sums to a real 0.
 */
function sumDays(
  byDay: ReadonlyMap<string, number>,
  from: string,
  to: string,
  channel?: string,
): number | null {
  let total: number | null = null;
  for (const [key, value] of byDay) {
    const day =
      channel === undefined ? key : key.slice(0, key.indexOf("\u0000"));
    if (channel !== undefined && key.slice(day.length + 1) !== channel)
      continue;
    if (day < from || day > to) continue;
    total = (total ?? 0) + value;
  }
  return total;
}

/**
 * Never turns missing into zero: no spend observed is a dash, and so is no
 * leads. Zero spend with leads is a real, observed zero.
 */
function perLead(spend: number | null, leads: number): number | null {
  if (spend === null || leads <= 0) return null;
  return spend / leads;
}

export async function getFunnelExecutive(
  input: { client?: Client; now?: Date; includeInternal?: boolean } = {},
): Promise<FunnelExecutiveReport> {
  const client = input.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const shared = await fetchFunnelInputs(client, now);
  const options = { ...shared, now, includeInternal: input.includeInternal };
  const start = monthStart(shared);

  const [spend, closeWins] = await Promise.all([
    fetchSpend(client, start),
    getCloseWins({
      from: start,
      to: now.toISOString().slice(0, 10),
      periodOf: (day) => day.slice(0, 7),
      mirror: client,
    }),
  ]);
  return buildFunnelExecutive({
    byChannel: buildFunnelMonthly({ ...options, grouping: "channel" }),
    byPage: buildFunnelMonthly({ ...options, grouping: "page" }),
    spend,
    closeWins,
  });
}

/** The earliest month the funnel report will render, so spend matches it. */
function monthStart(shared: { leads: Array<{ created_at: string }> }): string {
  const earliest = shared.leads[0]?.created_at ?? new Date().toISOString();
  return `${earliest.slice(0, 7)}-01`;
}

async function fetchSpend(
  client: Client,
  startDay: string,
): Promise<SpendRow[]> {
  const rows: SpendRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("channel_daily")
      .select("day,channel,spend")
      .gte("day", startDay)
      .not("spend", "is", null)
      .order("day")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Spend missing would print a cost per lead that is quietly too low, so
      // the tab fails rather than showing one.
      throw new Error(`channel_daily spend read failed: ${error.message}`);
    }
    const batch = (data ?? []) as SpendRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
