/**
 * Date-range vocabulary shared by the analytics page, its URL, and the server
 * rollups. Client-safe (no server-only imports) so the range switcher can use
 * the same definitions the queries do.
 *
 * A range is either a preset ("30d") or an explicit window
 * ("custom:2026-01-01:2026-03-31"). Both resolve to the same `{ days, endsAt }`
 * pair, which is the only thing the rollups need: every one of them measures
 * `days` days back from an anchor instant, so a custom window is just a
 * different anchor and a different width.
 */

export const ADMIN_ANALYTICS_RANGE_KEYS = ["7d", "30d", "90d", "1y"] as const;

export type AdminAnalyticsRangePreset =
  (typeof ADMIN_ANALYTICS_RANGE_KEYS)[number];

export type AdminAnalyticsCustomRangeKey = `custom:${string}:${string}`;

export type AdminAnalyticsRangeKey =
  AdminAnalyticsRangePreset | AdminAnalyticsCustomRangeKey;

export const ADMIN_ANALYTICS_RANGES: Record<
  AdminAnalyticsRangePreset,
  { label: string; days: number }
> = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "1y": { label: "Last year", days: 365 },
};

export const DEFAULT_ADMIN_ANALYTICS_RANGE: AdminAnalyticsRangePreset = "30d";

const DAY_MS = 86_400_000;

/**
 * Widest custom window we will run. Without a ceiling a typo in the URL
 * ("1900-01-01") turns every tab into a full-table scan.
 */
const MAX_CUSTOM_DAYS = 1096;

export function parseAdminAnalyticsRange(
  value: string | null | undefined,
): AdminAnalyticsRangeKey {
  const trimmed = value?.trim();
  return isAdminAnalyticsRangeKey(trimmed)
    ? trimmed
    : DEFAULT_ADMIN_ANALYTICS_RANGE;
}

export function isAdminAnalyticsRangeKey(
  value: string | null | undefined,
): value is AdminAnalyticsRangeKey {
  if (value === null || value === undefined) return false;
  if ((ADMIN_ANALYTICS_RANGE_KEYS as readonly string[]).includes(value)) {
    return true;
  }
  return parseCustomRange(value) !== null;
}

/** `from`/`to` off a GET form become the canonical key the rest of the UI carries. */
export function toCustomRangeKey(
  from: string | null | undefined,
  to: string | null | undefined,
): string | null {
  const start = from?.trim();
  const end = to?.trim();
  return start && end ? `custom:${start}:${end}` : null;
}

export type ResolvedAdminAnalyticsRange = {
  key: AdminAnalyticsRangeKey;
  label: string;
  /** Inclusive width of the window in days. Also the width of the prior window. */
  days: number;
  /** Instant the window ends at: `now` for a preset, end-of-day for a custom range. */
  endsAt: Date;
  /** Set only for a custom range, so the picker can show what is applied. */
  startDay?: string;
  endDay?: string;
};

/**
 * The one place a range key becomes a window. Presets stay anchored on `now`,
 * so nothing about the existing tabs changes.
 */
export function resolveAdminAnalyticsRange(
  key: AdminAnalyticsRangeKey,
  now: Date = new Date(),
): ResolvedAdminAnalyticsRange {
  const custom = parseCustomRange(key);
  if (!custom) {
    const preset = isPreset(key) ? key : DEFAULT_ADMIN_ANALYTICS_RANGE;
    return { key: preset, ...ADMIN_ANALYTICS_RANGES[preset], endsAt: now };
  }
  return {
    key,
    label: `${formatDay(custom.startDay)} – ${formatDay(custom.endDay)}`,
    days: custom.days,
    // Last instant of the end day, so `dayKey(endsAt)` is the end day itself
    // and the day-keyed rollups need no other change.
    endsAt: new Date(`${custom.endDay}T23:59:59.999Z`),
    startDay: custom.startDay,
    endDay: custom.endDay,
  };
}

function isPreset(value: string): value is AdminAnalyticsRangePreset {
  return (ADMIN_ANALYTICS_RANGE_KEYS as readonly string[]).includes(value);
}

function parseCustomRange(
  value: string,
): { startDay: string; endDay: string; days: number } | null {
  const parts = value.split(":");
  if (parts.length !== 3 || parts[0] !== "custom") return null;
  const [, startDay, endDay] = parts;
  const start = parseDay(startDay);
  const end = parseDay(endDay);
  if (start === null || end === null || start > end) return null;
  const days = Math.round((end - start) / DAY_MS) + 1;
  return days > MAX_CUSTOM_DAYS ? null : { startDay, endDay, days };
}

/** Epoch ms of midnight UTC, or null when the text is not a real calendar day. */
function parseDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  // Date.parse accepts 2026-02-30 and rolls it forward, which would silently
  // report a window the user never asked for.
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The last `count` complete Mon-Sun weeks, newest first, as custom range keys.
 *
 * Mon-Sun is Stephen's convention and the one the MTD dashboard and Kody's
 * scorecard both report on. Comparing a Mon-Fri window to a Mon-Sun one moves
 * bookings by roughly 25 on its own (REPORTING.md section 8), so the selector
 * only ever offers whole weeks.
 *
 * The current, incomplete week is excluded: a part-week sitting in a list of
 * whole ones reads as a collapse in every rate on the page.
 */
export function recentWeekRanges(
  today: string,
  count = 12,
): {
  key: AdminAnalyticsCustomRangeKey;
  label: string;
  startDay: string;
  endDay: string;
}[] {
  const anchor = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(anchor)) return [];
  // getUTCDay: 0 = Sunday. Days back to the Monday of the week `today` is in.
  const sinceMonday = (new Date(anchor).getUTCDay() + 6) % 7;
  const thisMonday = anchor - sinceMonday * DAY_MS;

  const weeks = [];
  for (let index = 1; index <= count; index += 1) {
    const monday = thisMonday - index * 7 * DAY_MS;
    const startDay = new Date(monday).toISOString().slice(0, 10);
    const endDay = new Date(monday + 6 * DAY_MS).toISOString().slice(0, 10);
    weeks.push({
      key: `custom:${startDay}:${endDay}` as AdminAnalyticsCustomRangeKey,
      label: `${formatDay(startDay)} – ${formatDay(endDay)}${index === 1 ? " (last week)" : ""}`,
      startDay,
      endDay,
    });
  }
  return weeks;
}
