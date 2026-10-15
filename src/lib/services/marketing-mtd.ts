/**
 * Marketing MTD: the marketing month so far on Dom's booked-call rule
 * (`booked_calls.v2.2`), against the same dates last month. Layout from Jess's
 * handoff of 2026-10-14 (`.claude/specs/2026-10-14-marketing-mtd.md`). Pure
 * and client-safe.
 *
 *   - Booked: Dom's counted meetings booked by Marketing, dated by the day the
 *     meeting was created (Pacific), in the row of the lead's original source
 *     (Dom's `sources.py`). The input is `v2DashboardCalls`, the same calls the
 *     main dashboard and the Months V2 panel count.
 *   - Lane 2 on marketing leads: Dom's counted meetings a Lane 2 setter booked,
 *     in the same source rows. Never added to Booked.
 *   - Open: booked calls scheduled after today. Show rate is shown over the
 *     calls that are due (booked minus open); qualified is shown AND qualified,
 *     over shown. Close keeps both flags for a lead's FIRST call only, so a
 *     repeat credit reads unlogged, never no-show.
 *   - Won is its own population (deals won in the range, whenever booked):
 *     Jess's lead rules, minus the MTD dashboard's five closers, filed under
 *     the source Dom's map gives the deal's Close funnel. Dom's rule says
 *     nothing about wins.
 *   - Sales cycle: Pacific day won minus Pacific day the lead was created.
 *   - Spend: the channel spine's spend, on the one source row its band maps
 *     to (Webinar -> Internal Webinar, Google Ads, Meta Ads); spend a band
 *     spreads over several sources is in the total only.
 */

import { pacificToday } from "@/lib/admin/format-time";
import {
  FLOW_CHANNELS,
  flowChannelForSpine,
} from "@/lib/analytics/channel-flow";
import { resolveOrigin } from "@/lib/booked-calls-v2/sources";
import {
  MTD_EXCLUDED_CLOSER_IDS,
  SCRAPER_FUNNEL,
} from "@/lib/services/close-mtd-funnel";
import { isExcludedLead, type CloseCall } from "@/lib/services/close-week-view";
import type { CloseDeal } from "@/lib/services/close-wins";
import { daysBetween, workdaysBetween } from "@/lib/services/goal-pace";

/** Lane 2 calls and won deals whose lead has no source on Dom's map. */
export const UNKNOWN_CHANNEL = "No marketing source";
/** Jess's goal: 125 booked calls a week, planned over Monday to Friday. */
export const WEEKLY_BOOKED_GOAL = 125;
export const DAILY_BOOKED_GOAL = WEEKLY_BOOKED_GOAL / 5;

export type Range = { from: string; to: string };

export type ConflictLead = { leadId: string; name: string | null };

/** A counted V2 meeting as `v2DashboardCalls` returns it. */
export type MtdCall = CloseCall & { name?: string | null };

/** One spine row's spend. */
export type SpendFact = {
  day: string;
  channel: string | null;
  spend: number | null;
};

export type MarketingFigures = {
  booked: number;
  /** Booked calls scheduled after today. */
  open: number;
  shown: number;
  /** Shown and qualified. */
  qualified: number;
  /** Qualified flags with no logged show: not in `qualified`. */
  conflicts: ConflictLead[];
  /** Counted calls a Lane 2 setter booked on this source's leads. */
  lane2: number;
  won: number;
  revenue: number;
  /** Won deals with no value in Close: counted in won, absent from revenue. */
  unvalued: number;
  /** Lead-to-win days of every won deal that has both dates, unsorted. */
  cycleDays: number[];
  spend: number;
};

export type MarketingRow = {
  label: string;
  current: MarketingFigures;
  prior: MarketingFigures;
};

export type MarketingMtd = {
  current: Range;
  prior: Range;
  rows: MarketingRow[];
  total: { current: MarketingFigures; prior: MarketingFigures };
  /** Counted calls Social DMs booked: in Dom's total, in no row. */
  socialDms: { current: number; prior: number };
};

const yes = (value: string | null | undefined) =>
  ["yes", "true", "1"].includes((value ?? "").trim().toLowerCase());

const inRange = (day: string | null | undefined, range: Range) =>
  !!day && day.slice(0, 10) >= range.from && day.slice(0, 10) <= range.to;

/** A won deal the view counts. */
export function countsAsWon(deal: CloseDeal): boolean {
  return (
    !isExcludedLead(deal) &&
    (deal.funnel ?? "").trim().toLowerCase() !== SCRAPER_FUNNEL.toLowerCase() &&
    !MTD_EXCLUDED_CLOSER_IDS.has(deal.closerId ?? "")
  );
}

/** The deal's Close funnel on Dom's source map, or the unknown row. */
export const dealChannel = (deal: CloseDeal) =>
  resolveOrigin({ funnel: deal.funnel, contactUtms: [], resourceTag: null })
    .source ?? UNKNOWN_CHANNEL;

/** Pacific day won minus Pacific day created, or null when unknown or negative. */
export function leadToWinDays(deal: CloseDeal): number | null {
  if (!deal.leadCreatedAt) return null;
  const created = pacificToday(new Date(deal.leadCreatedAt));
  const days = daysBetween(created, deal.dateWon.slice(0, 10)) - 1;
  return deal.dateWon.slice(0, 10) >= created ? days : null;
}

/**
 * The source row a spend band lands on: the band's only Close funnel, on
 * Dom's map. Null for a band spread over several sources.
 */
export function spendChannel(spineChannel: string | null): string | null {
  const band = FLOW_CHANNELS.find(
    (c) => c.key === flowChannelForSpine(spineChannel ?? ""),
  );
  if (band?.funnels.length !== 1) return null;
  return (
    resolveOrigin({
      funnel: band.funnels[0]!,
      contactUtms: [],
      resourceTag: null,
    }).source ?? null
  );
}

export const emptyFigures = (): MarketingFigures => ({
  booked: 0,
  open: 0,
  shown: 0,
  qualified: 0,
  conflicts: [],
  lane2: 0,
  won: 0,
  revenue: 0,
  unvalued: 0,
  cycleDays: [],
  spend: 0,
});

type Period = {
  rows: Map<string, MarketingFigures>;
  socialDms: number;
  unallocatedSpend: number;
};

function figuresFor(
  input: {
    calls: readonly MtdCall[];
    deals: readonly CloseDeal[];
    spend: readonly SpendFact[];
    today: string;
  },
  range: Range,
): Period {
  const rows = new Map<string, MarketingFigures>();
  const bump = (
    label: string,
    change: (row: MarketingFigures) => Partial<MarketingFigures>,
  ) => {
    const row = rows.get(label) ?? emptyFigures();
    rows.set(label, { ...row, ...change(row) });
  };

  let socialDms = 0;
  for (const call of input.calls) {
    if (!inRange(call.bookedDate, range)) continue;
    const label = call.funnel ?? UNKNOWN_CHANNEL;
    if (call.bookedBy === "Social DMs") socialDms += 1;
    else if (call.bookedBy === "Lane 2")
      bump(label, (row) => ({ lane2: row.lane2 + 1 }));
    else {
      const shown = yes(call.showUp);
      const qualified = yes(call.qualified);
      const open = !!call.callDay && call.callDay > input.today;
      bump(label, (row) => ({
        booked: row.booked + 1,
        open: row.open + (open ? 1 : 0),
        shown: row.shown + (shown ? 1 : 0),
        qualified: row.qualified + (shown && qualified ? 1 : 0),
        conflicts:
          qualified && !shown
            ? [
                ...row.conflicts,
                { leadId: call.leadId, name: call.name ?? null },
              ]
            : row.conflicts,
      }));
    }
  }

  const seenDeals = new Set<string>();
  for (const deal of input.deals) {
    if (!inRange(deal.dateWon, range) || !countsAsWon(deal)) continue;
    const key = deal.id ?? `${deal.leadId}:${deal.dateWon}:${deal.value}`;
    if (seenDeals.has(key)) continue;
    seenDeals.add(key);
    const days = leadToWinDays(deal);
    bump(dealChannel(deal), (row) => ({
      won: row.won + 1,
      revenue: row.revenue + (deal.value ?? 0),
      unvalued: row.unvalued + (deal.value === null ? 1 : 0),
      cycleDays: days === null ? row.cycleDays : [...row.cycleDays, days],
    }));
  }

  let unallocatedSpend = 0;
  for (const fact of input.spend) {
    if (!fact.spend || !inRange(fact.day, range)) continue;
    const label = spendChannel(fact.channel);
    if (label) bump(label, (row) => ({ spend: row.spend + fact.spend! }));
    else unallocatedSpend += fact.spend;
  }
  return { rows, socialDms, unallocatedSpend };
}

export function sumFigures(
  rows: readonly MarketingFigures[],
): MarketingFigures {
  return rows.reduce(
    (total, row) => ({
      booked: total.booked + row.booked,
      open: total.open + row.open,
      shown: total.shown + row.shown,
      qualified: total.qualified + row.qualified,
      conflicts: [...total.conflicts, ...row.conflicts],
      lane2: total.lane2 + row.lane2,
      won: total.won + row.won,
      revenue: total.revenue + row.revenue,
      unvalued: total.unvalued + row.unvalued,
      cycleDays: [...total.cycleDays, ...row.cycleDays],
      spend: total.spend + row.spend,
    }),
    emptyFigures(),
  );
}

/** Same dates last month, the end day clamped to that month's length. */
export function priorRange(current: Range): Range {
  const [year, month] = current.from.split("-").map(Number) as [number, number];
  const priorYear = month === 1 ? year - 1 : year;
  const priorMonth = month === 1 ? 12 : month - 1;
  const lastDay = new Date(Date.UTC(priorYear, priorMonth, 0)).getUTCDate();
  const day = Math.min(Number(current.to.slice(8, 10)), lastDay);
  const key = `${priorYear}-${String(priorMonth).padStart(2, "0")}`;
  return { from: `${key}-01`, to: `${key}-${String(day).padStart(2, "0")}` };
}

export function buildMarketingMtd(input: {
  calls: readonly MtdCall[];
  deals: readonly CloseDeal[];
  spend: readonly SpendFact[];
  current: Range;
}): MarketingMtd {
  const prior = priorRange(input.current);
  const today = input.current.to;
  const now = figuresFor({ ...input, today }, input.current);
  const then = figuresFor({ ...input, today }, prior);
  const labels = [...new Set([...now.rows.keys(), ...then.rows.keys()])];
  const rows = labels
    .map((label) => ({
      label,
      current: now.rows.get(label) ?? emptyFigures(),
      prior: then.rows.get(label) ?? emptyFigures(),
    }))
    .sort(
      (a, b) =>
        Number(a.label === UNKNOWN_CHANNEL) -
          Number(b.label === UNKNOWN_CHANNEL) ||
        b.current.booked - a.current.booked ||
        b.prior.booked - a.prior.booked ||
        a.label.localeCompare(b.label),
    );
  const total = (
    pick: (row: MarketingRow) => MarketingFigures,
    spare: number,
  ) => {
    const sum = sumFigures(rows.map(pick));
    return { ...sum, spend: sum.spend + spare };
  };
  return {
    current: input.current,
    prior,
    rows,
    total: {
      current: total((row) => row.current, now.unallocatedSpend),
      prior: total((row) => row.prior, then.unallocatedSpend),
    },
    socialDms: { current: now.socialDms, prior: then.socialDms },
  };
}

// --- Rates and changes -------------------------------------------------------

/** Share in [0, 1], or null for a zero denominator. */
export const rate = (part: number, whole: number) =>
  whole > 0 ? part / whole : null;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type Change =
  | { kind: "pct"; value: number }
  | { kind: "pp"; value: number }
  | { kind: "new" }
  | { kind: "none" }
  | { kind: "na" };

/** Counts, revenue, days: percent change. Prior 0 reads New, not infinity. */
export function countChange(
  current: number | null,
  prior: number | null,
): Change {
  if (current === null || prior === null) return { kind: "na" };
  if (prior === 0) return current === 0 ? { kind: "none" } : { kind: "new" };
  return { kind: "pct", value: ((current - prior) / prior) * 100 };
}

/** Rates: the difference in percentage points. */
export function rateChange(
  current: number | null,
  prior: number | null,
): Change {
  if (current === null || prior === null) return { kind: "na" };
  return { kind: "pp", value: (current - prior) * 100 };
}

// --- Weekly goal and catch-up ------------------------------------------------

export type GoalSegment = {
  from: string;
  to: string;
  workdays: number;
  /** Calls to book in this segment, rounded up. */
  calls: number;
  /** Month-to-date total once this segment is booked. */
  milestone: number;
};

export type GoalPlan = {
  weeklyGoal: number;
  dailyGoal: number;
  workdaysElapsed: number;
  workdaysLeft: number;
  mtdTarget: number;
  mtdGap: number;
  /** Booked over the MTD target, 0 to 1+, or null before the first workday. */
  attainment: number | null;
  /** Booked per five-workday week so far. */
  weeklyAverage: number | null;
  monthGoal: number;
  needed: number;
  requiredDaily: number | null;
  /** A full five-day week at the required daily pace, rounded up. */
  requiredWeek: number | null;
  segments: GoalSegment[];
};

const addDay = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * 25 a workday, no holiday adjustment; actuals include weekend bookings. Today
 * counts as elapsed (the gap is against today's full target while today is
 * still booking). Remaining workdays are split into Monday-Friday segments.
 */
export function buildGoalPlan(input: {
  booked: number;
  today: string;
}): GoalPlan {
  const { booked, today } = input;
  const monthStart = `${today.slice(0, 7)}-01`;
  const [year, month] = today.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

  const workdaysElapsed = workdaysBetween(monthStart, today);
  const workdaysLeft =
    today >= monthEnd ? 0 : workdaysBetween(addDay(today, 1), monthEnd);
  const mtdTarget = DAILY_BOOKED_GOAL * workdaysElapsed;
  const monthGoal = DAILY_BOOKED_GOAL * (workdaysElapsed + workdaysLeft);
  const needed = Math.max(0, monthGoal - booked);
  const requiredDaily = workdaysLeft > 0 ? needed / workdaysLeft : null;

  const segments: GoalSegment[] = [];
  let milestone = booked;
  let start: string | null = null;
  for (let day = addDay(today, 1); day <= monthEnd; day = addDay(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) start ??= day;
    const endOfSegment = weekday === 5 || day === monthEnd;
    if (start && endOfSegment && requiredDaily !== null) {
      const workdays = workdaysBetween(start, day);
      const calls = Math.ceil(requiredDaily * workdays);
      milestone += calls;
      segments.push({ from: start, to: day, workdays, calls, milestone });
      start = null;
    }
  }

  return {
    weeklyGoal: WEEKLY_BOOKED_GOAL,
    dailyGoal: DAILY_BOOKED_GOAL,
    workdaysElapsed,
    workdaysLeft,
    mtdTarget,
    mtdGap: booked - mtdTarget,
    attainment: mtdTarget > 0 ? booked / mtdTarget : null,
    weeklyAverage: workdaysElapsed > 0 ? (booked / workdaysElapsed) * 5 : null,
    monthGoal,
    needed,
    requiredDaily,
    requiredWeek: requiredDaily === null ? null : Math.ceil(requiredDaily * 5),
    segments,
  };
}
