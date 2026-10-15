/**
 * Marketing MTD: Jess's marketing view of the month so far (her
 * `marketing-mtd-dashboard.html`, 2026-10-15), against the same dates last
 * month. Pure and client-safe. Field-based, one row per lead:
 *
 *   - Booked: leads whose "First Sales Call Booked Date" is in the range, in
 *     the row of their current Funnel Name, leaving out leads now "Canceled
 *     (by Lead)" or "Outside the US", other company brands (TLG, PPA),
 *     Reactivation Scrapers, and leads whose owner is off the MTD dashboard's
 *     Lane 1 roster. LTF Quiz counts; a blank funnel is "Unknown (Needs
 *     Review)". Who booked the call does not matter: this is source credit.
 *   - Open: booked leads not marked shown with a verified upcoming first-call
 *     meeting (the loader decides; see `marketing-mtd-data.ts`).
 *   - Show rate is shown over every booked lead, future bookings included.
 *     Qualified is nested: shown AND qualified, over shown. A lead marked
 *     qualified with no logged show is a conflict, listed, never re-flagged.
 *   - Won is its own population (deals won in the range, whenever booked):
 *     same lead rules, no roster, minus the MTD dashboard's five closers,
 *     filed under the deal's Funnel Name.
 *   - Sales cycle: Pacific day won minus Pacific day the lead was created.
 *   - Spend: the channel spine's spend, on the one source row its band maps
 *     to (Webinar -> Internal Webinar, Google Ads, Meta Ads); spend a band
 *     spreads over several sources is in the total only.
 *
 * The main dashboard and the Q4 scorecard tab count booked calls the same way
 * (`keptCalls`). Dom's meeting rule (`booked_calls.v2.2`) lives on only in
 * the Months V2 panel.
 */

import { pacificToday } from "@/lib/admin/format-time";
import {
  FLOW_CHANNELS,
  flowChannelForSpine,
} from "@/lib/analytics/channel-flow";
import { resolveOrigin } from "@/lib/booked-calls-v2/sources";
import {
  countsAsBooked,
  isScraperFunnel,
  MTD_EXCLUDED_CLOSER_IDS,
} from "@/lib/services/close-mtd-funnel";
import { isExcludedLead, type CloseCall } from "@/lib/services/close-week-view";
import type { CloseDeal } from "@/lib/services/close-wins";
import { daysBetween, workdaysBetween } from "@/lib/services/goal-pace";

/** Booked leads and won deals with a blank Funnel Name. */
export const UNKNOWN_CHANNEL = "Unknown (Needs Review)";
/** Jess's goal: 125 booked calls a week, planned over Monday to Friday. */
export const WEEKLY_BOOKED_GOAL = 125;
export const DAILY_BOOKED_GOAL = WEEKLY_BOOKED_GOAL / 5;

export type Range = { from: string; to: string };

export type ConflictLead = { leadId: string; name: string | null };

/** A lead's first sales call from the Close mirror, one row per lead. */
export type MtdBooking = CloseCall & {
  name?: string | null;
  /** Not shown, with a verified upcoming first-call meeting. */
  open?: boolean;
};

/** One spine row's spend. */
export type SpendFact = {
  day: string;
  channel: string | null;
  spend: number | null;
};

export type MarketingFigures = {
  booked: number;
  /** Booked leads not shown with a verified upcoming first call. */
  open: number;
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
  spend: number;
};

/** A booked lead the page counted this month, for drill-down and audit. */
export type MtdLead = {
  leadId: string;
  name: string | null;
  bookedDate: string;
  channel: string;
  shown: boolean;
  qualified: boolean;
  open: boolean;
};

/** A won deal the page counted this month. */
export type MtdWin = {
  leadId: string;
  dateWon: string;
  value: number | null;
  channel: string;
  closer: string | null;
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
  /** This month's counted booked leads. */
  leads: MtdLead[];
  /** This month's counted won deals. */
  wins: MtdWin[];
};

const yes = (value: string | null | undefined) =>
  ["yes", "true", "1"].includes((value ?? "").trim().toLowerCase());

const inRange = (day: string | null | undefined, range: Range) =>
  !!day && day.slice(0, 10) >= range.from && day.slice(0, 10) <= range.to;

/** Close stores some funnel names in a spelling the page should not repeat. */
const DISPLAY_LABELS: Record<string, string> = { linkedin: "LinkedIn" };

/** The row for a Close Funnel Name: blank is the unknown row. */
export { countsAsBooked };

export function channelLabel(funnel: string | null | undefined): string {
  const raw = (funnel ?? "").trim();
  if (!raw) return UNKNOWN_CHANNEL;
  return DISPLAY_LABELS[raw.toLowerCase()] ?? raw;
}

/** A won deal the view counts. */
export function countsAsWon(deal: CloseDeal): boolean {
  return (
    !isExcludedLead(deal) &&
    !isScraperFunnel(deal.funnel) &&
    !MTD_EXCLUDED_CLOSER_IDS.has(deal.closerId ?? "")
  );
}

/**
 * A won deal any booked-call surface keeps: marketing wins as this view counts
 * them, plus Reactivation Scrapers wins by any closer (their own band).
 */
export function keptWinByMtdRule(deal: CloseDeal): boolean {
  return isScraperFunnel(deal.funnel)
    ? !isExcludedLead(deal)
    : countsAsWon(deal);
}

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
  won: 0,
  revenue: 0,
  unvalued: 0,
  cycleDays: [],
  spend: 0,
});

type Period = {
  rows: Map<string, MarketingFigures>;
  leads: MtdLead[];
  wins: MtdWin[];
  unallocatedSpend: number;
};

function figuresFor(
  input: {
    calls: readonly MtdBooking[];
    deals: readonly CloseDeal[];
    spend: readonly SpendFact[];
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

  const leads: MtdLead[] = [];
  for (const call of input.calls) {
    if (!inRange(call.bookedDate, range) || !countsAsBooked(call)) continue;
    if (leads.some((lead) => lead.leadId === call.leadId)) continue;
    const shown = yes(call.showUp);
    const qualified = yes(call.qualified);
    const channel = channelLabel(call.funnel);
    leads.push({
      leadId: call.leadId,
      name: call.name ?? null,
      bookedDate: call.bookedDate.slice(0, 10),
      channel,
      shown,
      qualified,
      open: !!call.open && !shown,
    });
    bump(channel, (row) => ({
      booked: row.booked + 1,
      open: row.open + (call.open && !shown ? 1 : 0),
      shown: row.shown + (shown ? 1 : 0),
      qualified: row.qualified + (shown && qualified ? 1 : 0),
      conflicts:
        qualified && !shown
          ? [...row.conflicts, { leadId: call.leadId, name: call.name ?? null }]
          : row.conflicts,
    }));
  }

  const wins: MtdWin[] = [];
  const seenDeals = new Set<string>();
  for (const deal of input.deals) {
    if (!inRange(deal.dateWon, range) || !countsAsWon(deal)) continue;
    const key = deal.id ?? `${deal.leadId}:${deal.dateWon}:${deal.value}`;
    if (seenDeals.has(key)) continue;
    seenDeals.add(key);
    const days = leadToWinDays(deal);
    const channel = channelLabel(deal.funnel);
    wins.push({
      leadId: deal.leadId,
      dateWon: deal.dateWon,
      value: deal.value,
      channel,
      closer: deal.closer,
    });
    bump(channel, (row) => ({
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
  return { rows, leads, wins, unallocatedSpend };
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
  calls: readonly MtdBooking[];
  deals: readonly CloseDeal[];
  spend: readonly SpendFact[];
  current: Range;
}): MarketingMtd {
  const prior = priorRange(input.current);
  const now = figuresFor(input, input.current);
  const then = figuresFor(input, prior);
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
    leads: now.leads,
    wins: now.wins,
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
