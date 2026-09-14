/**
 * The booked-call cohort: booked -> held -> won, anchored on the date the call
 * was booked, with later outcomes joined back to that date.
 *
 * This exists because the Channels tab and the funnel map divide stages that
 * were summed over the same calendar days. A call booked in January that is
 * won in March puts its win in March's numerator over March's denominator, and
 * the resulting "close rate" is not a close rate of anything -- it is the ratio
 * of two unrelated populations that happen to share a month. The fix is not a
 * different data source; `close_lead_funnel` is already one row per lead with
 * the booked date on it. The fix is to count it cohort-wise.
 *
 * Everything here is pure. The reader passes rows in, this decides nothing
 * about where they came from, and no value is ever defaulted to zero: a stage
 * nobody logged comes back null so the page can say so.
 */

import { outcomeFromLabel } from "@/lib/services/close-booking-reconcile";

/** The fields of the mirror this module reads. */
export type CohortRow = {
  funnel: string | null;
  first_sales_call_booked_date: string | null;
  first_call_show_up: string | null;
  status_label: string | null;
};

export type DayWindow = { start: string; end: string };

/**
 * When a booked call is old enough to judge.
 *
 * NOT CONFIRMED BY THE BUSINESS. Jess's spec leaves both intervals open
 * (open confirmation 1 and 2) and says not to invent them silently, so they
 * are named here, printed on the page beside the numbers, and changed in one
 * place. `SHOW_GRACE_DAYS` is a day of slack for a rep logging yesterday's
 * call this morning. `CLOSE_MATURITY_DAYS` is how long a held call gets to
 * become a win before its absence counts against the close rate.
 */
export const SHOW_GRACE_DAYS = 1;
export const CLOSE_MATURITY_DAYS = 30;

export const MATURITY_RULE = `A booked call enters the show rate ${SHOW_GRACE_DAYS} day after its booked date, and the close rate ${CLOSE_MATURITY_DAYS} days after. Both intervals are provisional and need Dom or Adam to confirm them.`;

export type CohortStatus = "immature" | "partial" | "mature";

export type Cohort = {
  window: DayWindow;
  /** Null for the all-funnels roll-up. */
  funnel: string | null;
  /** Everyone whose first sales call was booked inside the window. */
  booked: number;
  /** Of those, the ones old enough to have an answer. The show-rate denominator. */
  showable: number;
  /** Booked but not yet old enough to judge. Never a no-show. */
  pendingShow: number;
  held: number;
  noShow: number;
  /** Mature, in the window, and still carrying no show-up answer at all. */
  showUnlogged: number;
  /** Held calls old enough to have closed. The close-rate denominator. */
  closeable: number;
  won: number;
  /**
   * Always null. The mirror carries no deal value, so a cohort revenue figure
   * would have to come from `channel_daily`, which dates revenue by the day it
   * landed rather than the day the call was booked -- the exact mismatch this
   * module exists to remove. Unavailable is the honest answer until Close's
   * opportunity value is mirrored too.
   */
  revenue: null;
  rates: {
    /** held / showable. Null when nobody is mature yet. */
    showPct: number | null;
    /** won / closeable. Null when no held call is old enough. */
    closePct: number | null;
  };
  /** Share of the cohort carrying the field each rate needs. */
  coverage: { showUp: Coverage; outcome: Coverage };
  status: CohortStatus;
};

export type Coverage = { known: number; total: number; pct: number | null };

export function buildCohort(
  rows: CohortRow[],
  window: DayWindow,
  now: Date,
  funnel: string | null = null,
): Cohort {
  const today = dayKey(now);
  const mine = rows.filter(
    (row) =>
      within(row.first_sales_call_booked_date, window) &&
      (funnel === null || row.funnel === funnel),
  );

  const showCutoff = shiftDays(today, -SHOW_GRACE_DAYS);
  const closeCutoff = shiftDays(today, -CLOSE_MATURITY_DAYS);

  const mature = mine.filter(
    (row) => (row.first_sales_call_booked_date ?? "") <= showCutoff,
  );
  const held = mature.filter((row) => showedUp(row) === true);
  const noShow = mature.filter((row) => showedUp(row) === false);
  // A mature call nobody logged is not a no-show. It leaves the denominator
  // entirely, and the coverage figure below is what says how much was dropped.
  const showable = held.length + noShow.length;

  const closeable = held.filter(
    (row) => (row.first_sales_call_booked_date ?? "") <= closeCutoff,
  );
  const won = closeable.filter(
    (row) => outcomeFromLabel(row.status_label) === "won",
  );

  return {
    window,
    funnel,
    booked: mine.length,
    showable,
    pendingShow: mine.length - mature.length,
    held: held.length,
    noShow: noShow.length,
    showUnlogged: mature.length - showable,
    closeable: closeable.length,
    won: won.length,
    revenue: null,
    rates: {
      showPct: ratio(held.length, showable),
      closePct: ratio(won.length, closeable.length),
    },
    coverage: {
      showUp: coverage(showable, mine.length),
      outcome: coverage(
        closeable.filter((row) => row.status_label != null).length,
        closeable.length,
      ),
    },
    status: maturity(mine.length, mature.length, closeable.length),
  };
}

/** Close writes Yes/No; anything else is nobody having answered. */
function showedUp(row: CohortRow): boolean | null {
  const value = row.first_call_show_up?.trim().toLowerCase();
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function maturity(
  booked: number,
  mature: number,
  closeable: number,
): CohortStatus {
  if (booked === 0 || mature === 0) return "immature";
  if (mature < booked || closeable === 0) return "partial";
  return "mature";
}

/** Null, never zero, when the denominator is empty. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function coverage(known: number, total: number): Coverage {
  return { known, total, pct: ratio(known, total) };
}

function within(day: string | null, window: DayWindow): boolean {
  if (!day) return false;
  return day >= window.start && day <= window.end;
}

function shiftDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
