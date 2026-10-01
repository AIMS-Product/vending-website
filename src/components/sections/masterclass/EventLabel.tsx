/** "7:30 PM CDT" at the end of the GHL date text, kept on one line. */
const TIME_AND_ZONE = /\d{1,2}(?::\d{2})?\s*[AP]M(?:\s+[A-Z]{2,4})?\s*$/i;

/** The GHL date text, with its time and zone never split across lines. */
export function EventLabel({ label }: { label: string }) {
  const match = TIME_AND_ZONE.exec(label);
  if (!match) return <>{label}</>;
  return (
    <>
      {label.slice(0, match.index)}
      <span className="whitespace-nowrap">{match[0]}</span>
    </>
  );
}
