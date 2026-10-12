/**
 * What each channel's calls are worth: the flow card's cohort (calls booked
 * in the window, outcomes to date, METRICS.md §5, §6, §8, §16) set against
 * the channel's ad spend in the same window (spine spend, §9, the same spend
 * the "Cost per booked call" card divides). Pure, so the card only draws.
 */

import {
  FLOW_CHANNELS,
  flowChannelForSpine,
  stageRate,
  type ChannelFlow,
  type FlowChannelKey,
} from "@/lib/analytics/channel-flow";
import { inRange } from "@/lib/analytics/dashboard-metrics";
import type { DayRange } from "@/lib/analytics/dashboard-window";

/** Under this many booked calls a rate is mostly noise. */
export const SMALL_SAMPLE = 10;

export type ChannelValueRow = {
  key: FlowChannelKey;
  label: string;
  /** Ad spend in the window; null when the channel spent nothing (unpaid, not free). */
  spend: number | null;
  booked: number;
  showed: number;
  won: number;
  revenue: number;
  /** Percent, one decimal; null at zero booked. */
  showRate: number | null;
  closeRate: number | null;
  costPerBooked: number | null;
  costPerWon: number | null;
  /** Revenue won per dollar spent, two decimals. */
  revenuePerDollar: number | null;
  smallSample: boolean;
};

/** Spine spend per flow channel for the days in `range` (§9). */
export function spendByFlowChannel(
  facts: ReadonlyArray<{ day: string; channel: string; spend?: number | null }>,
  range: DayRange,
): Map<FlowChannelKey, number> {
  const out = new Map<FlowChannelKey, number>();
  for (const fact of facts) {
    if (!fact.spend || !inRange(fact.day, range)) continue;
    const key = flowChannelForSpine(fact.channel);
    out.set(key, (out.get(key) ?? 0) + fact.spend);
  }
  return out;
}

const per = (n: number, d: number | null) =>
  d !== null && d > 0 ? Math.round(n / d) : null;

export function buildChannelValue(
  flow: ChannelFlow,
  spend: ReadonlyMap<FlowChannelKey, number>,
): ChannelValueRow[] {
  const bands = new Map(flow.bands.map((b) => [b.key, b]));
  const rows = FLOW_CHANNELS.map((c): ChannelValueRow => {
    const band = bands.get(c.key);
    const [, booked, showed, , won] = band?.values ?? [0, 0, 0, 0, 0];
    const revenue = band?.revenue ?? 0;
    const paid = (spend.get(c.key) ?? 0) > 0 ? spend.get(c.key)! : null;
    return {
      key: c.key,
      label: c.label,
      spend: paid === null ? null : Math.round(paid),
      booked,
      showed,
      won,
      revenue,
      showRate: stageRate(showed, booked),
      closeRate: stageRate(won, booked),
      costPerBooked: paid === null ? null : per(paid, booked),
      costPerWon: paid === null ? null : per(paid, won),
      revenuePerDollar:
        paid === null ? null : Math.round((revenue / paid) * 100) / 100,
      smallSample: booked < SMALL_SAMPLE,
    };
  }).filter((r) => r.spend !== null || r.booked > 0);
  // Paid channels first, best return first; then the rest by revenue, with
  // "Other and not recorded" last because it is a remainder, not a channel.
  return rows.sort(
    (a, b) =>
      Number(a.spend === null) - Number(b.spend === null) ||
      (b.revenuePerDollar ?? 0) - (a.revenuePerDollar ?? 0) ||
      Number(a.key === "other") - Number(b.key === "other") ||
      b.revenue - a.revenue ||
      b.booked - a.booked,
  );
}
