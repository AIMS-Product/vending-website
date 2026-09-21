/**
 * The month so far as our own Close mirror counts it: booked, showed,
 * qualified, won.
 *
 * This mirrors the shape of Stephen's MTD funnel dashboard and none of its
 * arithmetic. Every stage here is computed from `close_lead_funnel`, our
 * hourly copy of Close, so each one can name the population it counted and
 * the field it read. Nothing is quoted from his sheet.
 *
 * Three things this deliberately does not do, all of them in REPORTING.md:
 *
 *   - It does not nest the stages. 16 of September's calls are logged
 *     "Qualified (Opp)" = Yes with no "First Call Show Up" = Yes, so a
 *     qualified-over-showed rate would read above 100% for some funnels and
 *     imply a subset that does not exist. Every rate here is over booked.
 *   - It does not fold won into the booked cohort. Won is pulled by the day
 *     the deal was won, so a deal won this month may belong to a call booked
 *     two months ago. It is a different population and is labelled as one.
 *   - It does not reproduce Stephen's Booked. His is built from Close meeting
 *     activities and drops four meeting owners, one of whom (Spencer
 *     Reynolds) is an active VP setter. `close_lead_funnel` carries no
 *     meeting-owner field, so that filter cannot be applied here at all. The
 *     difference is stated on screen rather than reconciled away.
 */

import {
  isExcludedCall,
  isYes,
  labelOf,
  NO_SOURCE_LABEL,
  type CloseCall,
} from "@/lib/services/close-week-view";
import type { CloseDeal } from "@/lib/services/close-wins";

/** The outbound/reactivation funnel, excluded from every marketing figure. */
export const SCRAPER_FUNNEL = "Reactivation Scrapers";

export type CloseFunnelStage = {
  key: "booked" | "showed" | "qualified" | "won";
  label: string;
  count: number;
  /** Who this stage counted, in one sentence. Rendered beside the number. */
  population: string;
  /** The Close field it was read from. */
  source: string;
  /** Share of the booked cohort, or null when the stage is a different one. */
  ofBookedPct: number | null;
};

export type CloseFunnelSplit = {
  booked: number;
  showed: number;
  qualified: number;
};

export type CloseMtdFunnel = {
  /** First day of the month, YYYY-MM-DD. */
  from: string;
  /** Today, or the last day of the month once it has passed. */
  to: string;
  stages: CloseFunnelStage[];
  /** Won deals in the window, by the day won. Not a subset of `booked`. */
  won: number;
  revenue: number;
  /** Won deals carrying no value in Close: in `won`, absent from `revenue`. */
  unvalued: number;
  /** First calls the SteelTrap rule drops, shown so the gap is not hidden. */
  excluded: number;
  /** Booked calls logged qualified without a logged show. */
  qualifiedWithoutShow: number;
  /** Everything except `Reactivation Scrapers` — the line Kody's scorecard uses. */
  marketing: CloseFunnelSplit;
  /** `Reactivation Scrapers` alone: the sales floor's own rebooking. */
  scrapers: CloseFunnelSplit;
  /** Per-funnel detail, booked descending. */
  rows: Array<CloseFunnelSplit & { label: string }>;
};

const BOOKED_SOURCE =
  'Close "First Sales Call Booked Date", one row per lead, leaving out leads now "Canceled (by Lead)" or "Outside the US" and the "LTF - Quiz Funnel" funnel.';
const SHOWED_SOURCE =
  'Close "First Call Show Up (Opp)" = Yes. A call nobody logged is not counted as shown.';
const QUALIFIED_SOURCE =
  "Close \"Qualified (Opp)\" = Yes, a rep's judgement after the call, not the site's online questions.";
const WON_SOURCE =
  "Close opportunities with status won, dated by the day they were won.";

function inWindow(day: string | null, from: string, to: string): boolean {
  return day !== null && day.slice(0, 10) >= from && day.slice(0, 10) <= to;
}

function pctOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function isScraper(funnel: string | null): boolean {
  return (funnel ?? "").trim().toLowerCase() === SCRAPER_FUNNEL.toLowerCase();
}

function split(calls: readonly CloseCall[]): CloseFunnelSplit {
  return {
    booked: calls.length,
    showed: calls.filter((call) => isYes(call.showUp)).length,
    qualified: calls.filter((call) => isYes(call.qualified)).length,
  };
}

export function buildCloseMtdFunnel(input: {
  calls: readonly CloseCall[];
  deals: readonly CloseDeal[];
  from: string;
  to: string;
}): CloseMtdFunnel {
  const { from, to } = input;
  const windowed = input.calls.filter((call) =>
    inWindow(call.bookedDate, from, to),
  );
  const excluded = windowed.filter(isExcludedCall);
  const kept = windowed.filter((call) => !isExcludedCall(call));

  const totals = split(kept);
  const scraperCalls = kept.filter((call) => isScraper(call.funnel));
  const scrapers = split(scraperCalls);
  const marketing = {
    booked: totals.booked - scrapers.booked,
    showed: totals.showed - scrapers.showed,
    qualified: totals.qualified - scrapers.qualified,
  };

  const wonDeals = input.deals.filter((deal) =>
    inWindow(deal.dateWon, from, to),
  );
  const revenue = wonDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);

  const byFunnel = new Map<string, CloseCall[]>();
  for (const call of kept) {
    const label = labelOf(call.funnel);
    byFunnel.set(label, [...(byFunnel.get(label) ?? []), call]);
  }
  const rows = [...byFunnel.entries()]
    .map(([label, calls]) => ({ label, ...split(calls) }))
    .sort(
      (a, b) =>
        b.booked - a.booked ||
        b.showed - a.showed ||
        a.label.localeCompare(b.label),
    );

  return {
    from,
    to,
    stages: [
      {
        key: "booked",
        label: "Booked",
        count: totals.booked,
        population: "Leads whose first sales call is scheduled in this month.",
        source: BOOKED_SOURCE,
        ofBookedPct: null,
      },
      {
        key: "showed",
        label: "Showed",
        count: totals.showed,
        population: "Of those booked calls, the ones a rep logged as held.",
        source: SHOWED_SOURCE,
        ofBookedPct: pctOf(totals.showed, totals.booked),
      },
      {
        key: "qualified",
        label: "Qualified",
        count: totals.qualified,
        population:
          "Of those booked calls, the ones a rep marked qualified. Measured over booked, not over showed.",
        source: QUALIFIED_SOURCE,
        ofBookedPct: pctOf(totals.qualified, totals.booked),
      },
      {
        key: "won",
        label: "Closed-won",
        count: wonDeals.length,
        population:
          "Deals won in this month, whenever the call was booked. Not a subset of the booked cohort above.",
        source: WON_SOURCE,
        ofBookedPct: null,
      },
    ],
    won: wonDeals.length,
    revenue,
    unvalued: wonDeals.filter((deal) => deal.value === null).length,
    excluded: excluded.length,
    qualifiedWithoutShow: kept.filter(
      (call) => isYes(call.qualified) && !isYes(call.showUp),
    ).length,
    marketing,
    scrapers,
    rows,
  };
}

export { NO_SOURCE_LABEL };
