import { flowChannelForFunnel } from "@/lib/analytics/channel-flow";
import { keptCalls } from "@/lib/analytics/dashboard-metrics";
import { addDays, daysBetween } from "@/lib/analytics/dashboard-window";
import type { CloseCall } from "@/lib/services/close-week-view";
import type { ChannelFact } from "@/lib/services/channel-report-rollup";

/*
 * The Leadership Scorecard's marketing rows, by Monday-Sunday week, the way
 * the Q4'26 sheet counts them (Kody's Q3 row reproduced on Mon-Sun weeks:
 * marketing 88/81/65 against his 89/79/63). Pure: the loader passes rows in.
 */

export const SCORECARD_WEEKS = 8;

/** Website form bands the qualification quiz routes to a call. */
export const QUALIFIED_BANDS = new Set(["top_closers", "lane_1", "setting"]);

/** Spine sources whose spend Metricool writes, with the name people use. */
export const PAID_NETWORKS = [
  { source: "google", label: "Google Ads" },
  { source: "meta_ads", label: "Meta" },
] as const;

export type ScorecardWeek = {
  start: string;
  end: string;
  /** False for the running week: its numbers are "so far". */
  complete: boolean;
  /** Close first calls dated in the week, every one (the sheet's Total). */
  booked: number;
  /** After the §3 exclusions, one per lead. */
  bookedKept: number;
  /** `bookedKept` without Lane 2 reactivation. */
  bookedMarketing: number;
  /** Captured (§4): site leads plus contacts on the spine. */
  mqls: number;
  /** Site form fills the quiz scored into a calling band. */
  qualified: number;
  spend: number;
  spendByNetwork: Array<{ label: string; spend: number }>;
  /** Paid networks with days in the week that have no spend recorded. */
  missingSpend: Array<{ label: string; days: number }>;
  /** Spend over MQLs; null with no MQLs. Incomplete when spend is. */
  costPerMql: number | null;
};

/** The Monday on or before `day` (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // Sun 0 .. Sat 6
  return addDays(day, -((dow + 6) % 7));
}

/** `count` Monday-Sunday weeks, newest first, ending with the one holding `today`. */
export function scorecardWeeks(
  today: string,
  count = SCORECARD_WEEKS,
): Array<{ start: string; end: string }> {
  const newest = mondayOf(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(newest, -7 * i);
    return { start, end: addDays(start, 6) };
  });
}

export function buildScorecard(input: {
  today: string;
  calls: readonly CloseCall[];
  facts: readonly ChannelFact[];
  /** Reporting days of site form fills scored into a qualified band. */
  qualifiedDays: readonly string[];
  count?: number;
}): ScorecardWeek[] {
  const kept = keptCalls(input.calls);
  const weeks = scorecardWeeks(input.today, input.count);
  // A network counts as running if it recorded spend anywhere on screen.
  // ponytail: one paused for all 8 weeks reads as "not running", not missing.
  const running = PAID_NETWORKS.filter((n) =>
    input.facts.some((f) => f.source === n.source && f.spend != null),
  );
  // Today's spend lands overnight, so only days before today can be missing.
  const lastSettled = addDays(input.today, -1);

  return weeks.map(({ start, end }) => {
    const within = (day: string) => day >= start && day <= end;
    const facts = input.facts.filter((f) => within(f.day));
    const spendByNetwork = PAID_NETWORKS.map((n) => ({
      label: n.label,
      spend: sum(
        facts.filter((f) => f.source === n.source).map((f) => f.spend ?? 0),
      ),
    }));
    const spend = sum(spendByNetwork.map((n) => n.spend));
    const settledEnd = end < lastSettled ? end : lastSettled;
    const missingSpend = running.flatMap((n) => {
      const days = daysBetween({ startDay: start, endDay: settledEnd }).filter(
        (day) =>
          !facts.some(
            (f) => f.day === day && f.source === n.source && f.spend != null,
          ),
      ).length;
      return days > 0 ? [{ label: n.label, days }] : [];
    });
    const mqls = sum(facts.map((f) => (f.leads ?? 0) + (f.contacts ?? 0)));
    const keptInWeek = kept.filter((c) => within(c.bookedDate));
    return {
      start,
      end,
      complete: end < input.today,
      booked: input.calls.filter((c) => within(c.bookedDate)).length,
      bookedKept: keptInWeek.length,
      bookedMarketing: keptInWeek.filter(
        (c) => flowChannelForFunnel(c.funnel) !== "reactivation",
      ).length,
      mqls,
      qualified: input.qualifiedDays.filter(within).length,
      spend,
      spendByNetwork,
      missingSpend,
      costPerMql: mqls > 0 ? spend / mqls : null,
    };
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
