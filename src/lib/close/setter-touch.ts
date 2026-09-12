/**
 * The setter who worked a lead right before they booked themselves.
 *
 * Most booked calls carry no tag: somebody texted the lead a Calendly link and
 * the lead booked it, which records nothing about who sent it. Asking setters
 * to use tagged links or fill a Close field does not work — that is exactly
 * what left the field empty on nearly every lead. What they DO reliably is
 * call and text from Close, and Close stamps every one of those with a user
 * and a time.
 *
 * So: the last setter to call or text the lead before the booking gets the
 * credit, within a window. This is INFERENCE, and the ledger says so and shows
 * the gap ("Connor called them 2h before they booked") rather than stating it
 * as fact. It ranks below everything Calendly or a tag can prove.
 *
 * Two rules keep it honest:
 *
 * - Only people on the setter roster count. Closers call leads too, and a
 *   closer's call before a rebooking is not a set. Anyone not classified as a
 *   setter is skipped rather than guessed at.
 * - Only calls and SMS count, and only before the booking. A note, an email
 *   blast or a call logged afterwards is not the work that set the call.
 */

export type CloseActivity = {
  _type?: string | null;
  user_name?: string | null;
  date_created?: string | null;
  direction?: string | null;
};

export type SetterTouch = {
  name: string;
  at: string;
  /** Minutes between the touch and the booking, for the evidence line. */
  minutesBefore: number;
};

/**
 * How long before a booking a setter's call still counts as having set it.
 *
 * 48 hours: long enough for "he called me yesterday and I booked this morning",
 * short enough that a call a week earlier does not claim a booking that came
 * from somewhere else entirely.
 */
export const SETTER_TOUCH_WINDOW_HOURS = 48;

const TOUCH_TYPES = new Set(["call", "sms"]);

export function resolveSetterTouch(
  activities: CloseActivity[],
  bookedAt: string | null,
  isSetter: (name: string) => boolean,
  windowHours: number = SETTER_TOUCH_WINDOW_HOURS,
): SetterTouch | null {
  const bookedAtMs = bookedAt ? Date.parse(bookedAt) : NaN;
  if (!Number.isFinite(bookedAtMs)) return null;
  const earliestMs = bookedAtMs - windowHours * 3_600_000;

  let best: SetterTouch | null = null;
  for (const activity of activities) {
    const type = activity._type?.trim().toLowerCase();
    if (!type || !TOUCH_TYPES.has(type)) continue;

    const name = activity.user_name?.trim();
    if (!name || !isSetter(name)) continue;

    const atMs = activity.date_created
      ? Date.parse(activity.date_created)
      : NaN;
    if (!Number.isFinite(atMs)) continue;
    // Strictly before the booking: an activity logged after it is follow-up,
    // and one logged in the same second is more likely the booking's own
    // confirmation than the work that caused it.
    if (atMs >= bookedAtMs || atMs < earliestMs) continue;

    if (best && Date.parse(best.at) >= atMs) continue;
    best = {
      name,
      at: new Date(atMs).toISOString(),
      minutesBefore: Math.round((bookedAtMs - atMs) / 60_000),
    };
  }
  return best;
}

/** "2h before they booked", "35m before they booked", "3d before they booked". */
export function describeTouchGap(minutesBefore: number): string {
  if (minutesBefore < 60) return `${minutesBefore}m before they booked`;
  if (minutesBefore < 60 * 24) {
    return `${Math.round(minutesBefore / 60)}h before they booked`;
  }
  return `${Math.round(minutesBefore / (60 * 24))}d before they booked`;
}
