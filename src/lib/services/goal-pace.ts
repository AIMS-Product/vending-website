/**
 * Ahead or behind, and by how much. Pure and client-safe.
 *
 * A target is for a period; part of the period has elapsed; the share of the
 * target that should be booked by now is the same share of the period that
 * has passed. Everything else on the goals page is derived from that one
 * idea, here, so the headline and every row say the same thing.
 */

export type Period = {
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Inclusive, YYYY-MM-DD. */
  end: string;
};

export type PaceStatus =
  "ahead" | "on pace" | "behind" | "not started" | "no target" | "not measured";

export type Pace = {
  target: number | null;
  actual: number | null;
  /** Share of the period elapsed through today, 0 to 1. */
  elapsedShare: number;
  /** Target multiplied by the elapsed share. */
  expected: number | null;
  /** Actual minus expected, in calls. Positive is ahead. */
  variance: number | null;
  variancePct: number | null;
  /** Where the period lands if the current rate holds. */
  projected: number | null;
  /** Target spread over a seven-day week (five workdays when workdays pace). */
  weeklyTarget: number | null;
  /** Booked calls per week needed from today to still hit the target. */
  neededPerWeek: number | null;
  status: PaceStatus;
};

/** Within this share of expected, a channel is on pace rather than ahead or behind. */
export const ON_PACE_TOLERANCE_PCT = 5;

export function buildPace(input: {
  target: number | null;
  actual: number | null;
  period: Period;
  today: string;
  workdays?: boolean;
}): Pace {
  const { target, actual, period, today } = input;
  const countDays = input.workdays ? workdaysBetween : daysBetween;
  const total = countDays(period.start, period.end);
  const elapsedEnd = today < period.start ? null : minDay(today, period.end);
  const elapsed = elapsedEnd ? countDays(period.start, elapsedEnd) : 0;
  const elapsedShare = total > 0 ? Math.min(1, elapsed / total) : 0;
  const remaining = Math.max(0, total - elapsed);
  const perWeek = input.workdays ? 5 : 7;

  const expected =
    target == null ? null : Math.round(target * elapsedShare * 10) / 10;
  const variance =
    actual == null || expected == null
      ? null
      : Math.round((actual - expected) * 10) / 10;
  const variancePct =
    variance == null || expected == null || expected <= 0
      ? null
      : Math.round((variance / expected) * 100);
  const projected =
    actual == null || elapsedShare <= 0
      ? null
      : Math.round(actual / elapsedShare);
  const weeklyTarget =
    target == null || total <= 0
      ? null
      : Math.round((target * perWeek) / total);
  const neededPerWeek =
    target == null || actual == null
      ? null
      : remaining <= 0
        ? null
        : Math.round(((target - actual) * perWeek) / remaining);

  return {
    target,
    actual,
    elapsedShare,
    expected,
    variance,
    variancePct,
    projected,
    weeklyTarget,
    neededPerWeek,
    status: status({ target, actual, elapsedShare, variance, expected }),
  };
}

function status(input: {
  target: number | null;
  actual: number | null;
  elapsedShare: number;
  variance: number | null;
  expected: number | null;
}): PaceStatus {
  if (input.target == null) return "no target";
  if (input.actual == null) return "not measured";
  if (input.elapsedShare <= 0) return "not started";
  if (input.variance == null || input.expected == null) return "not measured";
  const tolerance = (input.expected * ON_PACE_TOLERANCE_PCT) / 100;
  if (input.variance > tolerance) return "ahead";
  if (input.variance < -tolerance) return "behind";
  return "on pace";
}

/** Calendar days from start through end, both inclusive. */
export function daysBetween(start: string, end: string): number {
  const diff = utc(end) - utc(start);
  return diff < 0 ? 0 : Math.round(diff / 86_400_000) + 1;
}

/** Monday to Friday days from start through end, both inclusive. */
export function workdaysBetween(start: string, end: string): number {
  let count = 0;
  for (let t = utc(start); t <= utc(end); t += 86_400_000) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export function monthPeriod(month: string): Period {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(last).padStart(2, "0")}`,
  };
}

export function monthKey(day: string): string {
  return day.slice(0, 7);
}

function utc(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

function minDay(a: string, b: string): string {
  return a < b ? a : b;
}
