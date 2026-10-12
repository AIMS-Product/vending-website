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

export type FocusLine = {
  tone: "double-down" | "watch";
  label: string;
  costPerBooked: number | null;
  revenuePerDollar: number;
};

/**
 * At most three lines for the top of the dashboard: paid channels with a
 * real sample, "Double down" where a dollar of spend has won a dollar or
 * more (best first), "Watch" where it has not (worst first).
 */
export function focusLines(rows: readonly ChannelValueRow[]): FocusLine[] {
  const priced = rows.filter(
    (r): r is ChannelValueRow & { revenuePerDollar: number } =>
      r.spend !== null && !r.smallSample && r.revenuePerDollar !== null,
  );
  const line = (tone: FocusLine["tone"]) => (r: (typeof priced)[number]) => ({
    tone,
    label: r.label,
    costPerBooked: r.costPerBooked,
    revenuePerDollar: r.revenuePerDollar,
  });
  const up = priced
    .filter((r) => r.revenuePerDollar >= 1)
    .sort((a, b) => b.revenuePerDollar - a.revenuePerDollar)
    .map(line("double-down"));
  const down = priced
    .filter((r) => r.revenuePerDollar < 1)
    .sort((a, b) => a.revenuePerDollar - b.revenuePerDollar)
    .map(line("watch"));
  // Keep a slot for the worst channel whenever there is one.
  return [...up.slice(0, down.length ? 2 : 3), ...down].slice(0, 3);
}

/** The two paid networks, as the spine's `source` names their ad rows. */
export const PAID_NETWORKS = [
  {
    key: "google",
    label: "Google Ads",
    source: "google",
    bands: ["google-ads"],
  },
  // Meta buys the webinar registrations, so the Webinar band is Meta's too.
  {
    key: "meta",
    label: "Meta",
    source: "meta_ads",
    bands: ["meta-ads", "webinar"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  source: string;
  bands: readonly FlowChannelKey[];
}>;

export type PaidRow = {
  key: string;
  label: string;
  spend: number;
  clicks: number;
  /** Sign-ups or leads; null where the network does not split them this way. */
  signUps: number | null;
  booked: number | null;
  won: number | null;
  costPerBooked: number | null;
};

type PaidFact = {
  day: string;
  source: string | null;
  content?: string | null;
  spend?: number | null;
  clicks?: number | null;
  leads?: number | null;
  contacts?: number | null;
};

/** Google and Meta side by side: spine spend, clicks and sign-ups; the flow's booked and won. */
export function paidByNetwork(
  facts: readonly PaidFact[],
  flow: ChannelFlow,
  range: DayRange,
): PaidRow[] {
  const bands = new Map(flow.bands.map((b) => [b.key, b]));
  return PAID_NETWORKS.map((n) => {
    const mine = facts.filter(
      (f) => f.source === n.source && inRange(f.day, range),
    );
    const sum = (pick: (f: PaidFact) => number | null | undefined) =>
      mine.reduce((s, f) => s + (pick(f) ?? 0), 0);
    const of = (stage: 1 | 4) =>
      n.bands.reduce((s, k) => s + (bands.get(k)?.values[stage] ?? 0), 0);
    const spend = sum((f) => f.spend);
    const booked = of(1);
    return {
      key: n.key,
      label: n.label,
      spend: Math.round(spend),
      clicks: sum((f) => f.clicks),
      signUps: sum((f) => f.leads) + sum((f) => f.contacts),
      booked,
      won: of(4),
      costPerBooked: spend > 0 ? per(spend, booked) : null,
    };
  });
}

/**
 * Meta campaigns by name (the spine's `content` on ad rows), spend first.
 * Registrations are stored per webinar week, not per campaign, so only spend
 * and clicks split by campaign.
 */
export function metaCampaigns(
  facts: readonly PaidFact[],
  range: DayRange,
): PaidRow[] {
  const by = new Map<string, PaidRow>();
  for (const f of facts) {
    if (f.source !== "meta_ads" || !f.spend || !inRange(f.day, range)) continue;
    const name = f.content?.trim() || "(unnamed campaign)";
    const row = by.get(name) ?? {
      key: name,
      label: name,
      spend: 0,
      clicks: 0,
      signUps: null,
      booked: null,
      won: null,
      costPerBooked: null,
    };
    by.set(name, {
      ...row,
      spend: row.spend + f.spend,
      clicks: row.clicks + (f.clicks ?? 0),
    });
  }
  return [...by.values()]
    .map((r) => ({ ...r, spend: Math.round(r.spend) }))
    .sort((a, b) => b.spend - a.spend);
}
