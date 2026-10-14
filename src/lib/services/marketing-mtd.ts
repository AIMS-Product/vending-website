/**
 * Marketing MTD: Jess's marketing view of the month so far (handoff of
 * 2026-10-14, `.claude/specs/2026-10-14-marketing-mtd.md`). Pure and
 * client-safe.
 *
 * Field-based, one row per lead, not Dom's meeting rule (booked calls V2):
 *
 *   - Booked: leads whose "First Sales Call Booked Date" is in the range,
 *     leaving out leads now "Canceled (by Lead)" or "Outside the US", other
 *     company brands (TLG, PPA), Reactivation Scrapers, and leads whose owner
 *     is off the MTD dashboard's Lane 1 roster. The LTF Quiz funnel counts.
 *   - Qualified is nested: shown AND qualified, over shown. A lead marked
 *     qualified with no logged show is a conflict, listed, never re-flagged.
 *   - Won is its own population (deals won in the range, whenever booked):
 *     same lead rules, no roster, minus the MTD dashboard's five closers.
 *   - Sales cycle: Pacific day won minus Pacific day the lead was created.
 *
 * Sep 1-14 reproduces Jess's 154 / 95 / 66 / 15 / $103,290 / 10 days exactly
 * (`scripts/marketing-mtd-validate.ts`).
 */

import { pacificToday } from "@/lib/admin/format-time";
import {
  MTD_BOOKING_OWNERS,
  MTD_EXCLUDED_CLOSER_IDS,
  SCRAPER_FUNNEL,
} from "@/lib/services/close-mtd-funnel";
import { isExcludedLead, type CloseCall } from "@/lib/services/close-week-view";
import type { CloseDeal } from "@/lib/services/close-wins";
import { daysBetween, workdaysBetween } from "@/lib/services/goal-pace";

export const UNKNOWN_CHANNEL = "Unknown (Needs Review)";
/** Jess's goal: 125 booked calls a week, planned over Monday to Friday. */
export const WEEKLY_BOOKED_GOAL = 125;
export const DAILY_BOOKED_GOAL = WEEKLY_BOOKED_GOAL / 5;

/** Close stores some funnel names in a spelling the page should not repeat. */
const DISPLAY_LABELS: Record<string, string> = { linkedin: "LinkedIn" };

export type Range = { from: string; to: string };

export type ConflictLead = { leadId: string; name: string | null };

export type MarketingFigures = {
  booked: number;
  shown: number;
  /** Shown and qualified. */
  qualified: number;
  /** Qualified flags with no logged show: not in `qualified`. */
  conflicts: ConflictLead[];
  won: number;
  revenue: number;
  /** Won deals with no value in Close: counted in won, absent from revenue. */
  unvalued: number;
  /** Lead-to-win days of every won deal that has both dates, unsorted. */
  cycleDays: number[];
  /** Stored Funnel Name spellings behind this row, for audit. */
  rawValues: string[];
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
};

const yes = (value: string | null | undefined) =>
  ["yes", "true", "1"].includes((value ?? "").trim().toLowerCase());

export function channelLabel(funnel: string | null | undefined): string {
  const raw = (funnel ?? "").trim();
  if (!raw) return UNKNOWN_CHANNEL;
  return DISPLAY_LABELS[raw.toLowerCase()] ?? raw;
}

const isScraper = (funnel: string | null | undefined) =>
  (funnel ?? "").trim().toLowerCase() === SCRAPER_FUNNEL.toLowerCase();

const inRange = (day: string | null | undefined, range: Range) =>
  !!day && day.slice(0, 10) >= range.from && day.slice(0, 10) <= range.to;

/** A booked lead Jess's view counts. */
export function countsAsBooked(call: CloseCall): boolean {
  return (
    !isExcludedLead(call) &&
    !isScraper(call.funnel) &&
    MTD_BOOKING_OWNERS.has((call.leadOwner ?? "").trim())
  );
}

/** A won deal Jess's view counts. */
export function countsAsWon(deal: CloseDeal): boolean {
  return (
    !isExcludedLead(deal) &&
    !isScraper(deal.funnel) &&
    !MTD_EXCLUDED_CLOSER_IDS.has(deal.closerId ?? "")
  );
}

/** Pacific day won minus Pacific day created, or null when unknown or negative. */
export function leadToWinDays(deal: CloseDeal): number | null {
  if (!deal.leadCreatedAt) return null;
  const created = pacificToday(new Date(deal.leadCreatedAt));
  const days = daysBetween(created, deal.dateWon.slice(0, 10)) - 1;
  return deal.dateWon.slice(0, 10) >= created ? days : null;
}

const empty = (): MarketingFigures => ({
  booked: 0,
  shown: 0,
  qualified: 0,
  conflicts: [],
  won: 0,
  revenue: 0,
  unvalued: 0,
  cycleDays: [],
  rawValues: [],
});

function figuresFor(
  calls: readonly (CloseCall & { name?: string | null })[],
  deals: readonly CloseDeal[],
  range: Range,
): Map<string, MarketingFigures> {
  const byLabel = new Map<string, MarketingFigures>();
  const rowOf = (funnel: string | null | undefined) => {
    const label = channelLabel(funnel);
    const row = byLabel.get(label) ?? empty();
    const raw = (funnel ?? "").trim();
    byLabel.set(label, {
      ...row,
      rawValues:
        raw && !row.rawValues.includes(raw)
          ? [...row.rawValues, raw]
          : row.rawValues,
    });
    return label;
  };
  const bump = (
    label: string,
    change: (row: MarketingFigures) => MarketingFigures,
  ) => byLabel.set(label, change(byLabel.get(label)!));

  const seenLeads = new Set<string>();
  for (const call of calls) {
    if (!inRange(call.bookedDate, range) || !countsAsBooked(call)) continue;
    if (seenLeads.has(call.leadId)) continue;
    seenLeads.add(call.leadId);
    const shown = yes(call.showUp);
    const qualified = yes(call.qualified);
    bump(rowOf(call.funnel), (row) => ({
      ...row,
      booked: row.booked + 1,
      shown: row.shown + (shown ? 1 : 0),
      qualified: row.qualified + (shown && qualified ? 1 : 0),
      conflicts:
        qualified && !shown
          ? [...row.conflicts, { leadId: call.leadId, name: call.name ?? null }]
          : row.conflicts,
    }));
  }

  const seenDeals = new Set<string>();
  for (const deal of deals) {
    if (!inRange(deal.dateWon, range) || !countsAsWon(deal)) continue;
    const key = deal.id ?? `${deal.leadId}:${deal.dateWon}:${deal.value}`;
    if (seenDeals.has(key)) continue;
    seenDeals.add(key);
    const days = leadToWinDays(deal);
    bump(rowOf(deal.funnel), (row) => ({
      ...row,
      won: row.won + 1,
      revenue: row.revenue + (deal.value ?? 0),
      unvalued: row.unvalued + (deal.value === null ? 1 : 0),
      cycleDays: days === null ? row.cycleDays : [...row.cycleDays, days],
    }));
  }
  return byLabel;
}

function sum(rows: readonly MarketingFigures[]): MarketingFigures {
  return rows.reduce(
    (total, row) => ({
      booked: total.booked + row.booked,
      shown: total.shown + row.shown,
      qualified: total.qualified + row.qualified,
      conflicts: [...total.conflicts, ...row.conflicts],
      won: total.won + row.won,
      revenue: total.revenue + row.revenue,
      unvalued: total.unvalued + row.unvalued,
      cycleDays: [...total.cycleDays, ...row.cycleDays],
      rawValues: [...total.rawValues, ...row.rawValues],
    }),
    empty(),
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
  calls: readonly (CloseCall & { name?: string | null })[];
  deals: readonly CloseDeal[];
  current: Range;
}): MarketingMtd {
  const prior = priorRange(input.current);
  const now = figuresFor(input.calls, input.deals, input.current);
  const then = figuresFor(input.calls, input.deals, prior);
  const labels = [...new Set([...now.keys(), ...then.keys()])];
  const rows = labels
    .map((label) => ({
      label,
      current: now.get(label) ?? empty(),
      prior: then.get(label) ?? empty(),
    }))
    .sort(
      (a, b) =>
        Number(a.label === UNKNOWN_CHANNEL) -
          Number(b.label === UNKNOWN_CHANNEL) ||
        b.current.booked - a.current.booked ||
        b.prior.booked - a.prior.booked ||
        a.label.localeCompare(b.label),
    );
  return {
    current: input.current,
    prior,
    rows,
    total: {
      current: sum(rows.map((row) => row.current)),
      prior: sum(rows.map((row) => row.prior)),
    },
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
