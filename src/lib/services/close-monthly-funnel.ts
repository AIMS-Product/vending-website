/**
 * The funnel by source, month over month, in the shape of the sheet the sales
 * floor reads, on Dom's booked-call rule (`booked_calls.v2.2`, since
 * 2026-10-14). The calls come from `getV2Calls` through `byBooker`:
 *
 *   - Booked   = Dom's counted meetings, by the Pacific day each was booked.
 *     Lane 2 and Social DMs rows hold what those setters booked; every other
 *     row is a Marketing booking under the lead's source on Dom's map.
 *   - Show %   = "First Call Show Up (Opp)" = Yes, read onto a call only when
 *     it is the lead's first call (never `call_disposition`, which mostly
 *     describes a later follow-up). A repeat credit reads unlogged.
 *   - Qual %   = "Qualified (Opp)" = Yes, same reading.
 *   - CW %     = deals won that month (by date won) over booked that month: a
 *     period ratio. A lead can hold more than one counted call, so a win read
 *     off the lead's row would count once per call.
 *   - Revenue  = those won deals' value.
 *
 * Show %, Qual % and CW % are all over booked, never over each other.
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
import type { CloseDeal } from "@/lib/services/close-wins";

/**
 * Close's show-up and qualification logging only became consistent in January
 * 2026. Earlier months hold real bookings against almost no logged outcomes,
 * which reads as a collapse in performance rather than a gap in the records.
 */
export const MONTHLY_FUNNEL_START = "2026-01";

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
 * Rows the sales floor booked: Dom's Lane 2 and Social DMs buckets (`byBooker`
 * files their calls under these labels), and the scraper funnel a won deal
 * can still carry. "Sales Reactivation" is a marketing source on Dom's map.
 */
const OUTBOUND_FUNNELS = new Set(
  ["Lane 2", "Social DMs", "Reactivation Scrapers"].map((name) =>
    name.toLowerCase(),
  ),
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
  totals: MonthlyCell;
  /** Per-group subtotals, so marketing never has to be worked out by hand. */
  byGroup: Record<FunnelGroup, MonthlyCell>;
  /** Won deals that carry no value in Close: in won, absent from revenue. */
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
  /** Close deals won since the first month, credited by date won. */
  deals: readonly CloseDeal[];
}): CloseMonthlyFunnel {
  const monthKeys = monthsFrom(
    input.start ?? MONTHLY_FUNNEL_START,
    input.today,
  );
  const { periods } = buildClosePeriods({
    calls: input.calls,
    deals: input.deals,
    periods: monthKeys,
    periodOf: monthOf,
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

  // A funnel's leads can arrive in a month it booked no call, and then there is
  // no call cell to carry them: August 2026's 7 Newsletter leads showed
  // nowhere. Give those leads a cell of their own, and a row if the funnel has
  // never booked at all.
  for (const key of input.leads?.keys() ?? []) {
    const [month, label] = key.split("|");
    if (!monthKeys.includes(month)) continue;
    const existing = byLabel.get(label) ?? {
      label,
      group: groupOf(label),
      byMonth: {},
      total: EMPTY,
    };
    if (existing.byMonth[month]) continue;
    const cell: MonthlyCell = { ...EMPTY, leads: leadsFor(month, label) };
    if (cell.leads === null) continue;
    byLabel.set(label, {
      ...existing,
      byMonth: { ...existing.byMonth, [month]: cell },
      total: add(existing.total, cell),
    });
  }

  const rows = [...byLabel.values()].sort(
    (a, b) =>
      b.total.booked - a.total.booked ||
      b.total.revenue - a.total.revenue ||
      a.label.localeCompare(b.label),
  );

  const months: MonthlyMonth[] = periods.map((period) => {
    const end = monthEnd(period.key, input.today);
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
      totals,
      byGroup,
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
