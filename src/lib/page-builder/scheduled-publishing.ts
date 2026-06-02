export const SCHEDULED_PUBLISH_TIME_ZONE = "America/Los_Angeles";
export const SCHEDULED_PUBLISH_TIME_ZONE_LABEL = "Pacific Time";
export const SCHEDULED_PUBLISH_MAX_ATTEMPTS = 3;
export const SCHEDULED_PUBLISH_STALE_LOCK_MINUTES = 15;

const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function zonedDateTimeLocalToUtcIso(
  value: string,
  timeZone = SCHEDULED_PUBLISH_TIME_ZONE,
) {
  const match = value.trim().match(dateTimeLocalPattern);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const localUtcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const guessedDate = new Date(localUtcGuess);
  if (Number.isNaN(guessedDate.getTime())) return null;

  const firstOffset = getTimeZoneOffsetMs(guessedDate, timeZone);
  const firstUtc = new Date(localUtcGuess - firstOffset);
  const secondOffset = getTimeZoneOffsetMs(firstUtc, timeZone);
  const utc = new Date(localUtcGuess - secondOffset);
  if (Number.isNaN(utc.getTime())) return null;

  const expected = `${year}-${month}-${day}T${hour}:${minute}`;
  const roundTripped = formatDateTimeLocalInTimeZone(utc.toISOString(), timeZone);
  return roundTripped === expected ? utc.toISOString() : null;
}

export function formatDateTimeLocalInTimeZone(
  iso: string | null | undefined,
  timeZone = SCHEDULED_PUBLISH_TIME_ZONE,
) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatScheduledPublishDisplay(
  iso: string | null | undefined,
  timeZone = SCHEDULED_PUBLISH_TIME_ZONE,
) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return zonedAsUtc - date.getTime();
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}
