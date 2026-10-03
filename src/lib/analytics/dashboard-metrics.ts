/**
 * The analytics dashboard's arithmetic, pure. Every figure names its
 * METRICS.md section; nothing here reads a table.
 */

import {
  FLOW_CHANNELS,
  flowChannelForSpine,
  type FlowChannelKey,
} from "@/lib/analytics/channel-flow";
import {
  addDays,
  daysBetween,
  type DayRange,
} from "@/lib/analytics/dashboard-window";
import {
  GOAL_CHANNELS,
  channelKeyForFunnel,
  targetForMonth,
} from "@/lib/services/channel-targets";
import type { ChannelFact } from "@/lib/services/channel-report-rollup";
import {
  isExcludedCall,
  isYes,
  type CloseCall,
} from "@/lib/services/close-week-view";

/**
 * The first day site leads exist (`lead_submissions` starts here; AGENTS.md).
 * A window reaching earlier cannot count leads, so it shows none rather
 * than a zero.
 */
export const LEADS_RECORDED_FROM = "2026-07-06";

export const inRange = (day: string, range: DayRange) =>
  day >= range.startDay && day <= range.endDay;

/** Close first calls after the SteelTrap rule, one per lead (§3, §5). */
export function keptCalls<T extends CloseCall>(calls: readonly T[]): T[] {
  const seen = new Set<string>();
  return calls.filter((call) => {
    if (isExcludedCall(call) || seen.has(call.leadId)) return false;
    seen.add(call.leadId);
    return true;
  });
}

export function countInRange<T>(
  items: readonly T[],
  dayOf: (item: T) => string,
  range: DayRange,
): number {
  return items.filter((item) => inRange(dayOf(item), range)).length;
}

/** One count per day of the range, oldest first. */
export function dailyCounts<T>(
  items: readonly T[],
  dayOf: (item: T) => string,
  range: DayRange,
): Array<{ day: string; value: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const day = dayOf(item);
    if (inRange(day, range)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return daysBetween(range).map((day) => ({
    day,
    value: counts.get(day) ?? 0,
  }));
}

/**
 * Show rate over calls whose day has passed (§7 "Show rate, calls held").
 * A call later today or next week has had no chance to show; counting it
 * would read as a collapse every morning.
 */
export function showRateHeld(
  calls: readonly CloseCall[],
  range: DayRange,
  today: string,
): { showed: number; held: number; rate: number | null } {
  const held = keptCalls(calls).filter(
    (call) => inRange(call.bookedDate, range) && call.bookedDate < today,
  );
  const showed = held.filter((call) => isYes(call.showUp)).length;
  return {
    showed,
    held: held.length,
    rate: held.length ? Math.round((showed / held.length) * 1000) / 10 : null,
  };
}

/** Change against the prior window, whole percent. Null when there is no base. */
export function deltaPct(
  current: number | null,
  prior: number | null,
): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

/**
 * A daily series as at most ~30 points: days as they are, or summed into
 * weeks for a long window, so a quarter's sparkline is not 90 spikes.
 */
export function sparkPoints(daily: ReadonlyArray<{ value: number }>): number[] {
  if (daily.length <= 45) return daily.map((d) => d.value);
  const out: number[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    out.push(daily.slice(i, i + 7).reduce((sum, d) => sum + d.value, 0));
  }
  return out;
}

const PLAN_KEYS = new Set(GOAL_CHANNELS.map((channel) => channel.key));

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * The booking plan for an arbitrary window (§11 "Window target"): each
 * month's target times the share of that month's days inside the window,
 * plan channels only. Null when no month in the window has a target.
 */
/** True when at least one plan channel has a target for this `YYYY-MM`. */
export function monthHasPlan(month: string): boolean {
  return GOAL_CHANNELS.some(
    (channel) => targetForMonth(channel, month) !== null,
  );
}

export function windowPlanTarget(range: DayRange): number | null {
  const daysPerMonth = new Map<string, number>();
  for (const day of daysBetween(range)) {
    const month = day.slice(0, 7);
    daysPerMonth.set(month, (daysPerMonth.get(month) ?? 0) + 1);
  }
  let total = 0;
  let any = false;
  for (const [month, days] of daysPerMonth) {
    for (const channel of GOAL_CHANNELS) {
      const target = targetForMonth(channel, month);
      if (target === null) continue;
      any = true;
      total += (target * days) / daysInMonth(month);
    }
  }
  return any ? Math.round(total) : null;
}

/**
 * Actuals on the plan's own basis (§11): every first call in a plan channel,
 * cancellations included, no SteelTrap rule. Only days in a month with a
 * target count, so a window reaching back before the plan compares like
 * with like (Q3 counted July and August against September's target: 297%).
 */
export function planBooked(
  calls: readonly CloseCall[],
  range: DayRange,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const call of calls) {
    if (
      !inRange(call.bookedDate, range) ||
      !monthHasPlan(call.bookedDate.slice(0, 7)) ||
      seen.has(call.leadId)
    )
      continue;
    seen.add(call.leadId);
    if (PLAN_KEYS.has(channelKeyForFunnel(call.funnel) ?? "")) count += 1;
  }
  return count;
}

export const NO_SETTER = "No setter recorded";

/** Booked calls by Close's setter field (§12 rule 5), largest first. */
export function bySetter(
  calls: ReadonlyArray<CloseCall & { setter: string | null }>,
): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const call of keptCalls(calls)) {
    const label = call.setter?.trim() || NO_SETTER;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) =>
      a.label === NO_SETTER
        ? 1
        : b.label === NO_SETTER
          ? -1
          : b.value - a.value,
    );
}

/** Captures (leads + contacts, §4) per spine channel inside the range. */
export function capturedByChannel(
  facts: readonly ChannelFact[],
  range: DayRange,
): Array<{ channel: string; count: number }> {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    if (!inRange(fact.day, range)) continue;
    const n = (fact.leads ?? 0) + (fact.contacts ?? 0);
    if (n > 0) counts.set(fact.channel, (counts.get(fact.channel) ?? 0) + n);
  }
  return [...counts].map(([channel, count]) => ({ channel, count }));
}

export type CostRow = {
  key: FlowChannelKey | "blended";
  label: string;
  /** One per month, oldest first. Cost is null when booked is 0 or unobserved. */
  months: Array<{
    month: string;
    spend: number;
    booked: number;
    cost: number | null;
  }>;
};

/** Every month key from `first` through `last`. */
export function monthKeys(first: string, last: string): string[] {
  const out: string[] = [];
  for (
    let at = `${first.slice(0, 7)}-01`;
    at.slice(0, 7) <= last.slice(0, 7);
  ) {
    out.push(at.slice(0, 7));
    const [y, m] = at.split("-").map(Number) as [number, number];
    at = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Cost per booked call by month (§9): spine spend over spine bookings, per
 * channel that spent anything. A zero spend total is unobserved, not free.
 */
export function costPerBookedByMonth(
  facts: readonly ChannelFact[],
  months: readonly string[],
): CostRow[] {
  const cell = new Map<string, { spend: number; booked: number }>();
  for (const fact of facts) {
    const month = fact.day.slice(0, 7);
    if (!months.includes(month)) continue;
    const key = `${flowChannelForSpine(fact.channel)}|${month}`;
    const c = cell.get(key) ?? { spend: 0, booked: 0 };
    cell.set(key, {
      spend: c.spend + (fact.spend ?? 0),
      booked: c.booked + (fact.booked ?? 0),
    });
  }
  const row = (
    key: CostRow["key"],
    label: string,
    pick: (m: string) => { spend: number; booked: number },
  ) => ({
    key,
    label,
    months: months.map((month) => {
      const { spend, booked } = pick(month);
      return {
        month,
        spend: Math.round(spend),
        booked,
        cost: spend > 0 && booked > 0 ? Math.round(spend / booked) : null,
      };
    }),
  });
  const paid = FLOW_CHANNELS.filter((channel) =>
    months.some((m) => (cell.get(`${channel.key}|${m}`)?.spend ?? 0) > 0),
  );
  const empty = { spend: 0, booked: 0 };
  const rows: CostRow[] = paid.map((channel) =>
    row(
      channel.key,
      channel.label,
      (m) => cell.get(`${channel.key}|${m}`) ?? empty,
    ),
  );
  if (rows.length > 1) {
    rows.push(
      row("blended", "All paid channels", (m) =>
        paid.reduce(
          (acc, channel) => {
            const c = cell.get(`${channel.key}|${m}`) ?? empty;
            return {
              spend: acc.spend + c.spend,
              booked: acc.booked + c.booked,
            };
          },
          { spend: 0, booked: 0 },
        ),
      ),
    );
  }
  return rows;
}

/** The same weekday a week earlier. */
export const sameDayLastWeek = (day: string) => addDays(day, -7);
