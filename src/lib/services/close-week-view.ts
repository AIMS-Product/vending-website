/**
 * The Close view: the week as the sales floor and SteelTrap count it.
 *
 * Not the site funnel. This answers "what did every channel put on the
 * closers' calendar this week, and what came of it", for every Close first
 * call, including people who never filled a site form (reactivation scrapers,
 * webinar registrants). Rules, all read from Close fields as reps log them:
 *
 *   - First calls: leads whose "First Sales Call Booked Date" falls in the
 *     week. That field is the day the call is scheduled for.
 *   - Showed: of those, "First Call Show Up (Opp)" = Yes. Unlogged is not shown.
 *   - Qualified (rep): of those, "Qualified (Opp)" = Yes. A rep's call after the
 *     meeting, not the site's online questions ("Qs done").
 *   - Won / revenue: Close opportunities won in the week, by date won.
 *
 * Every row is the lead's "Funnel Name DEAL (Opp)" as written in Close. A lead
 * with no funnel is "No source", never dropped. Weeks run Friday to Thursday.
 */

import type { CloseDeal } from "@/lib/services/close-wins";

export const NO_SOURCE_LABEL = "No source";

export const CLOSE_VIEW_SOURCE =
  'Close: first calls by "First Sales Call Booked Date"; showed = "First Call Show Up (Opp)" Yes; qualified = "Qualified (Opp)" Yes; won and revenue by the day the deal was won. Rows are "Funnel Name DEAL (Opp)".';

export type CloseCall = {
  funnel: string | null;
  bookedDate: string;
  showUp: string | null;
  qualified: string | null;
};

export type CloseWeekRow = {
  label: string;
  booked: number;
  showed: number;
  qualified: number;
  won: number;
  revenue: number;
};

export type CloseWeek = {
  /** The Friday the week starts on, YYYY-MM-DD. */
  key: string;
  /** The Thursday it ends on. */
  end: string;
  /** False while the week is still running. */
  complete: boolean;
  totals: Omit<CloseWeekRow, "label">;
  rows: CloseWeekRow[];
  /** Won deals with no value in Close: counted in won, not in revenue. */
  unvalued: number;
};

const DAY_MS = 86_400_000;

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The Friday on or before `day` (Adam's weeks run Friday to Thursday). */
export function weekStartOf(day: string): string {
  const ms = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
  const dow = new Date(ms).getUTCDay(); // Sun 0 .. Sat 6, Fri 5
  return toDay(ms - ((dow + 2) % 7) * DAY_MS);
}

export function weekEndOf(start: string): string {
  return toDay(Date.parse(`${start}T00:00:00Z`) + 6 * DAY_MS);
}

/** `count` week starts, newest first, ending with the week holding `today`. */
export function recentWeeks(today: string, count: number): string[] {
  const newest = Date.parse(`${weekStartOf(today)}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    toDay(newest - index * 7 * DAY_MS),
  );
}

function isYes(value: string | null): boolean {
  return value?.trim().toLowerCase() === "yes";
}

function labelOf(funnel: string | null): string {
  return funnel?.trim() || NO_SOURCE_LABEL;
}

const EMPTY = { booked: 0, showed: 0, qualified: 0, won: 0, revenue: 0 };

export function buildCloseWeeks(input: {
  calls: readonly CloseCall[];
  deals: readonly CloseDeal[];
  weeks: readonly string[];
  today: string;
}): CloseWeek[] {
  const wanted = new Set(input.weeks);
  const byWeek = new Map<string, Map<string, CloseWeekRow>>();
  const unvalued = new Map<string, number>();

  const bump = (
    week: string,
    funnel: string | null,
    add: Partial<Omit<CloseWeekRow, "label">>,
  ) => {
    if (!wanted.has(week)) return;
    const rows = byWeek.get(week) ?? new Map<string, CloseWeekRow>();
    const label = labelOf(funnel);
    const row = rows.get(label) ?? { label, ...EMPTY };
    rows.set(label, {
      ...row,
      booked: row.booked + (add.booked ?? 0),
      showed: row.showed + (add.showed ?? 0),
      qualified: row.qualified + (add.qualified ?? 0),
      won: row.won + (add.won ?? 0),
      revenue: row.revenue + (add.revenue ?? 0),
    });
    byWeek.set(week, rows);
  };

  for (const call of input.calls) {
    bump(weekStartOf(call.bookedDate), call.funnel, {
      booked: 1,
      showed: isYes(call.showUp) ? 1 : 0,
      qualified: isYes(call.qualified) ? 1 : 0,
    });
  }
  for (const deal of input.deals) {
    const week = weekStartOf(deal.dateWon);
    bump(week, deal.funnel, { won: 1, revenue: deal.value ?? 0 });
    if (deal.value === null && wanted.has(week)) {
      unvalued.set(week, (unvalued.get(week) ?? 0) + 1);
    }
  }

  return input.weeks.map((key) => {
    const end = weekEndOf(key);
    const rows = [...(byWeek.get(key)?.values() ?? [])].sort(
      (a, b) =>
        b.booked - a.booked ||
        b.revenue - a.revenue ||
        a.label.localeCompare(b.label),
    );
    const totals = rows.reduce(
      (sum, row) => ({
        booked: sum.booked + row.booked,
        showed: sum.showed + row.showed,
        qualified: sum.qualified + row.qualified,
        won: sum.won + row.won,
        revenue: sum.revenue + row.revenue,
      }),
      EMPTY,
    );
    return {
      key,
      end,
      complete: end < input.today,
      totals,
      rows,
      unvalued: unvalued.get(key) ?? 0,
    };
  });
}
