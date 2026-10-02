/**
 * One place for admin timestamps. The site reports in Pacific time, so a call
 * at 6pm Pacific must read as that day, not as tomorrow in UTC (what a Vercel
 * server renders) or as whatever the viewer's browser says (a hydration
 * mismatch in a client component). Display only: nothing here changes which
 * day a count belongs to.
 */
const TIME_ZONE = "America/Los_Angeles";

const STAMP = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const STAMP_SHORT = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
});

const DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

// A bare calendar date ("2026-09-30") parses as UTC midnight, which is the
// evening before in Pacific. It has no time of day, so it is shown as is.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parse(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date =
    typeof value === "string" && DATE_ONLY.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Sep 30, 2026, 6:30 AM PT", or null when the value is missing or invalid. */
export function formatPacificStamp(
  value: string | Date | null | undefined,
): string | null {
  const date = parse(value);
  return date ? `${STAMP.format(date)} PT` : null;
}

/** "Sep 30, 6:30 AM PT" for tight rows. */
export function formatPacificStampShort(
  value: string | Date | null | undefined,
): string | null {
  const date = parse(value);
  return date ? `${STAMP_SHORT.format(date)} PT` : null;
}

/** "Sep 30", or "Sep 30, 2026" with `year`, as the Pacific calendar day. */
export function formatPacificDay(
  value: string | Date | null | undefined,
  options: { year?: boolean } = {},
): string | null {
  const date = parse(value);
  if (!date) return null;
  return (options.year ? DAY_YEAR : DAY).format(date);
}

/** Today's calendar day (YYYY-MM-DD) on the Pacific calendar. */
export function pacificToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}
