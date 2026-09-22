/**
 * The funnel by source, month over month, in the shape of the sheet the sales
 * floor already reads and none of its arithmetic.
 *
 * Every cell is counted from `close_lead_funnel`, our hourly copy of Close,
 * and all five read off one lead row so the columns describe one population:
 *
 *   - Booked   = the lead's FIRST sales call, by "First Sales Call Booked
 *     Date", one row per lead. The sheet counts meeting activities instead,
 *     so a lead who rescheduled twice appears in it three times and its
 *     totals run about 1.7x these across every source. `close_lead_funnel`
 *     carries no meeting-owner field, so that population cannot be
 *     reproduced here; the difference is stated on screen, not reconciled.
 *   - Show %   = "First Call Show Up (Opp)" = Yes, the outcome field for THAT
 *     meeting. Deliberately not `call_disposition`: only 3,802 of 6,663
 *     dispositions name the first call at all, the rest describe a later
 *     follow-up or reschedule, so it disagrees with the first-call flag on
 *     970 calls and would mix two populations in one column.
 *   - Qual %   = "Qualified (Opp)" = Yes, the rep's judgement after the call.
 *   - CW %     = the lead's own stage being "Closed / Won".
 *   - Revenue  = the Close deal value carried by those same won leads.
 *
 * Show %, Qual % and CW % are all over booked, never over each other. Calls
 * get logged qualified with no logged show often enough that nesting them
 * would print rates above 100% for some sources.
 *
 * Because the win is read off the lead row, it lands in the month that lead's
 * call was BOOKED, not the month the deal closed. The newest months therefore
 * understate, so each month carries whether it is mature enough to read.
 *
 * Leads is the one column that does not come from Close. Close only holds
 * people who booked, so form fills come from our own `lead_submissions` and
 * exist only from 2026-07-06. Before that, and for any funnel with no form
 * behind it, the cell is null — not observed, never zero.
 */

import {
  buildClosePeriods,
  labelOf,
  NO_SOURCE_LABEL,
  type CloseCall,
  type CloseWeekRow,
} from "@/lib/services/close-week-view";
import { GOAL_CHANNELS } from "@/lib/services/channel-targets";

/**
 * Close's show-up and qualification logging only became consistent in January
 * 2026. Earlier months hold real bookings against almost no logged outcomes,
 * which reads as a collapse in performance rather than a gap in the records.
 */
export const MONTHLY_FUNNEL_START = "2026-01";

/**
 * Days after a first call before its month is treated as closed out. Deals are
 * signed weeks after the call, so a month younger than this reports a
 * closed-won rate that is still climbing.
 */
export const MATURE_AFTER_DAYS = 45;

/** Where a source sits on the page. Derived from the label, not a fixed list. */
export type FunnelGroup = "marketing" | "outbound" | "review";

export const FUNNEL_GROUPS: ReadonlyArray<{
  key: FunnelGroup;
  label: string;
  subtotal: string;
  note: string;
}> = [
  {
    key: "marketing",
    label: "Marketing sources",
    subtotal: "Marketing total",
    note: "Calls booked off something we published or paid for.",
  },
  {
    key: "outbound",
    label: "Sales reactivation",
    subtotal: "Sales reactivation total",
    note: "The sales floor rebooking its own list. Lane 2 in the plan.",
  },
  {
    key: "review",
    label: "Needs review",
    subtotal: "Needs review total",
    note: "Calls whose source Close never recorded. Not a channel, a gap in the CRM.",
  },
];

/**
 * The funnels the sales floor books off its own list.
 *
 * Read from the plan's own Lane 2 rather than retyped, so the split here and
 * the split the goals page measures against target can never disagree.
 * "Reactivation Email" is deliberately NOT in here: the plan counts it as
 * Marketing Reactivation, a marketing channel with its own target.
 */
const OUTBOUND_FUNNELS = new Set(
  (
    GOAL_CHANNELS.find((channel) => channel.key === "lane-2")?.funnels ?? []
  ).map((name) => name.toLowerCase()),
);

const REVIEW_LABELS = new Set(
  [NO_SOURCE_LABEL, "Unknown (Needs Review)", "No Attribution"].map((name) =>
    name.toLowerCase(),
  ),
);

export function groupOf(label: string): FunnelGroup {
  const bare = label.trim().toLowerCase();
  if (REVIEW_LABELS.has(bare)) return "review";
  if (OUTBOUND_FUNNELS.has(bare)) return "outbound";
  return "marketing";
}

/** A lead's stage in Close being the won one. */
export function isWonCall(call: CloseCall): boolean {
  return /closed\s*\/\s*won/i.test(call.status ?? "");
}

export type MonthlyCell = Omit<CloseWeekRow, "label"> & {
  /**
   * Form fills this source produced that month, from our own tables. Null
   * before lead capture existed, and for any funnel with no form behind it.
   * Never zero for "we did not look".
   */
  leads: number | null;
};

export type MonthlyFunnelRow = {
  label: string;
  group: FunnelGroup;
  /** One cell per month key. A month this source sent nothing in is absent. */
  byMonth: Record<string, MonthlyCell>;
  /** Across every month shown, for ordering and the row total column. */
  total: MonthlyCell;
};

export type MonthlyMonth = {
  /** `YYYY-MM`. */
  key: string;
  /** "January 2026", or "September 2026 (MTD)" while it is running. */
  label: string;
  /** False while the month is still running. */
  complete: boolean;
  /**
   * False while this month's calls are younger than `MATURE_AFTER_DAYS`, so
   * its closed-won column is still filling in.
   */
  mature: boolean;
  totals: MonthlyCell;
  /** Per-group subtotals, so marketing never has to be worked out by hand. */
  byGroup: Record<FunnelGroup, MonthlyCell>;
  /** First calls the SteelTrap rule drops, so the gap is not hidden. */
  excluded: number;
  /** Leads Close calls won that carry no deal value: in won, absent from revenue. */
  unvalued: number;
};

export type CloseMonthlyFunnel = {
  months: MonthlyMonth[];
  rows: MonthlyFunnelRow[];
  /** Every month summed, per group and overall, for the subtotal rows. */
  grandTotal: MonthlyCell;
  grandByGroup: Record<FunnelGroup, MonthlyCell>;
  /** The first day form fills exist for. Months before it show a dash. */
  leadsFrom: string | null;
};

const EMPTY: MonthlyCell = {
  booked: 0,
  showed: 0,
  qualified: 0,
  won: 0,
  revenue: 0,
  leads: null,
};

const MONTH_MS = 86_400_000;

/** `YYYY-MM` for a `YYYY-MM-DD` day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Every month key from `start` through the month holding `today`, oldest first. */
export function monthsFrom(start: string, today: string): string[] {
  const keys: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const end = monthOf(today);
  // Bounded so a bad `start` cannot spin: a decade of months is well past any
  // range this view will ever be asked for.
  for (let guard = 0; guard < 120; guard += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > end) break;
    keys.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

function monthLabel(key: string, today: string): string {
  const name = new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const running = key === monthOf(today);
  return `${name} ${key.slice(0, 4)}${running ? " (MTD)" : ""}`;
}

/** The last day of `key`'s month, or today when the month is still running. */
function monthEnd(key: string, today: string): string {
  const [year, month] = key.split("-").map(Number);
  const first = Date.UTC(
    month === 12 ? year + 1 : year,
    month === 12 ? 0 : month,
    1,
  );
  const last = new Date(first - MONTH_MS).toISOString().slice(0, 10);
  return last < today ? last : today;
}

/** Adds two cells. Leads stay null until at least one side observed them. */
function add(into: MonthlyCell, from: MonthlyCell): MonthlyCell {
  return {
    booked: into.booked + from.booked,
    showed: into.showed + from.showed,
    qualified: into.qualified + from.qualified,
    won: into.won + from.won,
    revenue: into.revenue + from.revenue,
    leads:
      into.leads === null && from.leads === null
        ? null
        : (into.leads ?? 0) + (from.leads ?? 0),
  };
}

function emptyByGroup(): Record<FunnelGroup, MonthlyCell> {
  return { marketing: EMPTY, outbound: EMPTY, review: EMPTY };
}

/**
 * Form fills per month per Close funnel, keyed `<month>|<funnel>`.
 *
 * Close holds only people who booked, so this is the one column that comes
 * from our own tables, joined on a small explicit map. A funnel absent from
 * the map has no cell rather than a zero: LTF and the reactivation lanes have
 * no form behind them at all, and printing 0 there would read as a channel
 * that stopped working.
 */
export type LeadsByFunnel = ReadonlyMap<string, number>;

export function leadsKey(month: string, funnel: string): string {
  return `${month}|${funnel}`;
}

export function buildCloseMonthlyFunnel(input: {
  calls: readonly CloseCall[];
  today: string;
  start?: string;
  /** Form fills by month and funnel. Absent means the column is not observed. */
  leads?: LeadsByFunnel;
  /** First day form fills exist for; months before it show a dash. */
  leadsFrom?: string | null;
  /** Won deal value per lead id, for the revenue carried by a won lead. */
  dealValueByLead?: ReadonlyMap<string, number>;
}): CloseMonthlyFunnel {
  const monthKeys = monthsFrom(
    input.start ?? MONTHLY_FUNNEL_START,
    input.today,
  );
  const values = input.dealValueByLead;
  const { periods } = buildClosePeriods({
    calls: input.calls,
    deals: [],
    periods: monthKeys,
    periodOf: monthOf,
    // The win is the lead's own stage, so it lands in the month that lead's
    // call was booked — the same cohort booked, showed and qualified describe.
    outcomeOf: (call) =>
      isWonCall(call)
        ? { won: 1, revenue: values?.get(call.leadId) ?? 0 }
        : { won: 0, revenue: 0 },
  });

  const leadsFrom = input.leadsFrom ?? null;
  const leadsFor = (month: string, funnel: string): number | null => {
    if (!input.leads) return null;
    // Before capture existed there is nothing to report, not zero fills.
    if (leadsFrom && `${month}-31` < leadsFrom) return null;
    return input.leads.get(leadsKey(month, funnel)) ?? null;
  };

  const byLabel = new Map<string, MonthlyFunnelRow>();
  for (const period of periods) {
    for (const row of period.rows) {
      const existing = byLabel.get(row.label) ?? {
        label: row.label,
        group: groupOf(row.label),
        byMonth: {},
        total: EMPTY,
      };
      // The label names the row; only the counts belong in the cell.
      const cell: MonthlyCell = {
        booked: row.booked,
        showed: row.showed,
        qualified: row.qualified,
        won: row.won,
        revenue: row.revenue,
        leads: leadsFor(period.key, row.label),
      };
      byLabel.set(row.label, {
        ...existing,
        byMonth: { ...existing.byMonth, [period.key]: cell },
        total: add(existing.total, cell),
      });
    }
  }

  const rows = [...byLabel.values()].sort(
    (a, b) =>
      b.total.booked - a.total.booked ||
      b.total.revenue - a.total.revenue ||
      a.label.localeCompare(b.label),
  );

  const todayMs = Date.parse(`${input.today}T00:00:00Z`);
  const months: MonthlyMonth[] = periods.map((period) => {
    const end = monthEnd(period.key, input.today);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    const byGroup = emptyByGroup();
    let totals = EMPTY;
    for (const row of rows) {
      const cell = row.byMonth[period.key];
      if (!cell) continue;
      byGroup[row.group] = add(byGroup[row.group], cell);
      totals = add(totals, cell);
    }
    return {
      key: period.key,
      label: monthLabel(period.key, input.today),
      complete: end < input.today,
      mature: (todayMs - endMs) / MONTH_MS >= MATURE_AFTER_DAYS,
      totals,
      byGroup,
      excluded: period.excluded,
      unvalued: period.unvalued,
    };
  });

  const grandByGroup = emptyByGroup();
  for (const row of rows)
    grandByGroup[row.group] = add(grandByGroup[row.group], row.total);

  return {
    months,
    rows,
    grandTotal: rows.reduce((sum, row) => add(sum, row.total), EMPTY),
    grandByGroup,
    leadsFrom,
  };
}

/** Share as a percentage to one decimal, or null when there is nothing to divide. */
export function pctOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export { labelOf };
