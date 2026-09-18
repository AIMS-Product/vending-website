/**
 * The Close view: the week as the sales floor and SteelTrap count it.
 *
 * Not the site funnel. This answers "what did every channel put on the
 * closers' calendar this week, and what came of it", for every Close first
 * call, including people who never filled a site form (reactivation scrapers,
 * webinar registrants). Rules, all read from Close fields as reps log them:
 *
 *   - First calls: leads whose "First Sales Call Booked Date" falls in the
 *     week. That field is the day the call is scheduled for. Leads whose
 *     current status is "Canceled (by Lead)" or "Outside the US", and the
 *     "LTF - Quiz Funnel" funnel, are left out, as SteelTrap leaves them out
 *     (crm_silver_to_gold_lakebase.py, DEFAULT_MEETING_BOOKED_EXCLUDED_*).
 *     They are counted in `excluded` so the gap is shown, not hidden.
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
  'Close: first calls by "First Sales Call Booked Date", leaving out leads now "Canceled (by Lead)" or "Outside the US" and the "LTF - Quiz Funnel" funnel (the SteelTrap rule); showed = "First Call Show Up (Opp)" Yes; qualified = "Qualified (Opp)" Yes; won and revenue by the day the deal was won. Rows are "Funnel Name DEAL (Opp)".';

/** Close lead statuses SteelTrap leaves out of booked, matched without emoji. */
const EXCLUDED_STATUSES = new Set(["canceled (by lead)", "outside the us"]);
const EXCLUDED_FUNNELS = new Set(["ltf - quiz funnel"]);

export type CloseCall = {
  funnel: string | null;
  /** Close lead status label, e.g. "🔻 Canceled (by Lead)". */
  status: string | null;
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
  /** First calls left out: lead now canceled by lead, outside the US, or quiz funnel. */
  excluded: number;
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

/** Drops a leading emoji and spacing so "🔻 Canceled (by Lead)" matches. */
function bareStatus(status: string | null): string {
  return (status ?? "")
    .replace(/^[^\p{L}\p{N}(]+/u, "")
    .trim()
    .toLowerCase();
}

export function isExcludedCall(call: CloseCall): boolean {
  return (
    EXCLUDED_STATUSES.has(bareStatus(call.status)) ||
    EXCLUDED_FUNNELS.has((call.funnel ?? "").trim().toLowerCase())
  );
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

  const excluded = new Map<string, number>();
  for (const call of input.calls) {
    if (isExcludedCall(call)) {
      const week = weekStartOf(call.bookedDate);
      if (wanted.has(week)) excluded.set(week, (excluded.get(week) ?? 0) + 1);
      continue;
    }
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
      excluded: excluded.get(key) ?? 0,
    };
  });
}
