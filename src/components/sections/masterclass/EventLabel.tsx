/**
 * "at 7:30 PM CDT" at the end of the GHL date text, kept on one line so a
 * narrow card never leaves "at" dangling at the end of the date.
 */
export const TIME_AND_ZONE =
  /(?:at\s+)?\d{1,2}(?::\d{2})?\s*[AP]M(?:\s+[A-Z]{2,4})?\s*$/i;

const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "America/Chicago",
});

/** "Tuesday, " for the event's Central-time day, unless the label names one. */
function weekdayPrefix(label: string, startsAt: string | null | undefined) {
  if (!startsAt) return "";
  const time = Date.parse(startsAt);
  if (Number.isNaN(time)) return "";
  const weekday = WEEKDAY.format(time);
  return label.toLowerCase().includes(weekday.toLowerCase())
    ? ""
    : `${weekday}, `;
}

/**
 * The GHL date text, with its time and zone never split across lines. With
 * `startsAt` it leads with the weekday, as GHL's own pages do.
 */
export function EventLabel({
  label,
  startsAt,
}: {
  label: string;
  startsAt?: string | null;
}) {
  const text = `${weekdayPrefix(label, startsAt)}${label}`;
  const match = TIME_AND_ZONE.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match.index)}
      <span className="whitespace-nowrap">{match[0]}</span>
    </>
  );
}
