/**
 * The analytics dashboard's date windows. Pure and client-safe, so the range
 * control and the loaders resolve a key the same way.
 *
 * Every day here is a calendar day in the reporting time zone
 * (`REPORTING_TIME_ZONE`, America/New_York, METRICS.md §1). A window is
 * inclusive at both ends and always has a prior window of the same length to
 * compare against.
 */

export const REPORTING_TIME_ZONE = "America/New_York";

export const DASHBOARD_WINDOW_PRESETS = [
  "today",
  "7d",
  "30d",
  "mtd",
  "qtd",
] as const;

export type DashboardWindowPreset = (typeof DASHBOARD_WINDOW_PRESETS)[number];
export type DashboardWindowKey = DashboardWindowPreset | `custom:${string}`;

const DEFAULT_DASHBOARD_WINDOW: DashboardWindowPreset = "30d";

export const DASHBOARD_WINDOW_LABELS: Record<DashboardWindowPreset, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  mtd: "Month to date",
  qtd: "Quarter to date",
};

/** Widest custom window. A typo like 1900-01-01 must not scan every table. */
const MAX_CUSTOM_DAYS = 1096;
const DAY_MS = 86_400_000;

export type DayRange = { startDay: string; endDay: string };

export type DashboardWindow = DayRange & {
  key: DashboardWindowKey;
  label: string;
  /** Inclusive width in days. */
  days: number;
  prior: DayRange;
  /** Today in the reporting time zone. */
  today: string;
};

/** The calendar day an instant falls on in the reporting time zone. */
export function reportingDay(at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: REPORTING_TIME_ZONE });
}

export function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(range: DayRange): string[] {
  const out: string[] = [];
  for (let day = range.startDay; day <= range.endDay; day = addDays(day, 1)) {
    out.push(day);
  }
  return out;
}

function width(range: DayRange): number {
  return (
    Math.round(
      (Date.parse(`${range.endDay}T00:00:00Z`) -
        Date.parse(`${range.startDay}T00:00:00Z`)) /
        DAY_MS,
    ) + 1
  );
}

function isRealDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 forward; a rolled day is not the day asked for.
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

function parseCustom(value: string): DayRange | null {
  const [tag, startDay, endDay, ...rest] = value.split(":");
  if (tag !== "custom" || rest.length > 0 || !startDay || !endDay) return null;
  if (!isRealDay(startDay) || !isRealDay(endDay) || startDay > endDay) {
    return null;
  }
  return width({ startDay, endDay }) > MAX_CUSTOM_DAYS
    ? null
    : { startDay, endDay };
}

export function parseDashboardWindow(
  value: string | null | undefined,
): DashboardWindowKey {
  const trimmed = value?.trim() ?? "";
  if ((DASHBOARD_WINDOW_PRESETS as readonly string[]).includes(trimmed)) {
    return trimmed as DashboardWindowPreset;
  }
  return parseCustom(trimmed)
    ? (trimmed as DashboardWindowKey)
    : DEFAULT_DASHBOARD_WINDOW;
}

/** `from`/`to` from the custom-range form, as one key. Null when incomplete. */
export function customWindowKey(
  from: string | null | undefined,
  to: string | null | undefined,
): DashboardWindowKey | null {
  const key = `custom:${from?.trim() ?? ""}:${to?.trim() ?? ""}`;
  return parseCustom(key) ? (key as DashboardWindowKey) : null;
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function quarterStart(day: string): string {
  const month = Number(day.slice(5, 7));
  const first = month - ((month - 1) % 3);
  return `${day.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

function shiftMonths(firstOfMonth: string, months: number): string {
  const [year, month] = firstOfMonth.split("-").map(Number) as [number, number];
  const at = new Date(Date.UTC(year, month - 1 + months, 1));
  return at.toISOString().slice(0, 10);
}

/**
 * The same span of the previous period: Oct 1-12 compares with Sep 1-12,
 * clamped so a 31-day span never spills into the period after.
 */
function samePointLastPeriod(
  start: string,
  days: number,
  periodMonths: number,
): DayRange {
  const priorStart = shiftMonths(start, -periodMonths);
  const priorPeriodEnd = addDays(start, -1);
  const endDay = addDays(priorStart, days - 1);
  return {
    startDay: priorStart,
    endDay: endDay > priorPeriodEnd ? priorPeriodEnd : endDay,
  };
}

function trailing(today: string, days: number): DayRange & { prior: DayRange } {
  const startDay = addDays(today, -(days - 1));
  return {
    startDay,
    endDay: today,
    prior: {
      startDay: addDays(startDay, -days),
      endDay: addDays(startDay, -1),
    },
  };
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function resolveDashboardWindow(
  key: DashboardWindowKey,
  today: string,
): DashboardWindow {
  const custom = key.startsWith("custom:") ? parseCustom(key) : null;
  if (custom) {
    const days = width(custom);
    return {
      key,
      label: `${formatDay(custom.startDay)} – ${formatDay(custom.endDay)}`,
      ...custom,
      days,
      prior: {
        startDay: addDays(custom.startDay, -days),
        endDay: addDays(custom.startDay, -1),
      },
      today,
    };
  }
  const preset = (DASHBOARD_WINDOW_PRESETS as readonly string[]).includes(key)
    ? (key as DashboardWindowPreset)
    : DEFAULT_DASHBOARD_WINDOW;
  const label = DASHBOARD_WINDOW_LABELS[preset];
  if (preset === "mtd" || preset === "qtd") {
    const startDay = preset === "mtd" ? monthStart(today) : quarterStart(today);
    const days = width({ startDay, endDay: today });
    return {
      key: preset,
      label,
      startDay,
      endDay: today,
      days,
      prior: samePointLastPeriod(startDay, days, preset === "mtd" ? 1 : 3),
      today,
    };
  }
  const days = preset === "today" ? 1 : preset === "7d" ? 7 : 30;
  return { key: preset, label, ...trailing(today, days), days, today };
}
