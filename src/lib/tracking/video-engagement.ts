/**
 * How far through a video someone got, quantised to the points worth telling a
 * rep about.
 *
 * Pure on purpose: the player listener that drives this (VideoEngagement) is a
 * thin shell around these two functions, so the part that decides what counts
 * as progress is unit-testable without a player, a DOM or a network.
 *
 * Why milestones rather than raw progress: `timeupdate` fires several times a
 * second per player, and there are fifteen players on /pre-call-resources.
 * Storing the furthest quarter reached answers "did they watch this" and "where
 * did they stop" — the two things a rep acts on — at four writes per video
 * instead of thousands.
 *
 * ponytail: 100 comes from the player's `ended` event, not from a 99% read,
 * because a tab-away near the end can stop `timeupdate` short. If completion
 * ever needs to survive a tab-away, flush on `pagehide` too.
 */

/**
 * The quarters.
 *
 * One event per crossing, carrying the furthest quarter reached — never one
 * per milestone. A scrub crosses several at once, storage keeps only the
 * maximum, and sending them separately made simultaneous writes race each
 * other for a number they all agreed on.
 */
export const VIDEO_MILESTONES = [25, 50, 75, 100] as const;

/**
 * Percent of the video watched, or null when the player cannot yet say.
 *
 * A duration of zero or NaN is the normal state for a player that has been
 * asked for its duration before metadata loaded, so it is a "not yet", not an
 * error. Progress past the end (seeking quirks, live edges) clamps to 100.
 */
export function percentWatched(
  currentTime: number,
  duration: number,
): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) return null;
  if (duration <= 0 || currentTime < 0) return null;
  return Math.min(100, Math.floor((currentTime / duration) * 100));
}

/**
 * Percent watched, counting only playback the visitor can hear.
 *
 * Vidalytics autoplays every player muted behind a "Click to unmute" card, so
 * a visitor who opens /pre-call-resources and walks away still runs fifteen
 * videos, the short ones to the end. Counting that told reps a prospect had
 * watched videos they never heard: 20 progress events in 75 seconds from a tab
 * nobody touched (live check, 2026-09-22). Clicking the card restarts the
 * video from 0:00 with sound, so gating on mute loses no real viewing.
 */
export function audiblePercentWatched(
  currentTime: number,
  duration: number,
  muted: boolean,
): number | null {
  if (muted) return null;
  return percentWatched(currentTime, duration);
}

/**
 * The milestones newly reached at `percent`, given those already reported.
 *
 * Returns every uncrossed milestone at or below the current position, not just
 * the nearest one: a visitor who drags the scrubber from the start to the end
 * has, as far as the furthest-point-reached record goes, reached all of them,
 * and reporting only 100 would lose the fact for anyone querying "reached 50".
 * The caller adds what it sends back into `reported`, so each fires once.
 */
export function milestonesReached(
  percent: number,
  reported: ReadonlySet<number>,
): number[] {
  return VIDEO_MILESTONES.filter(
    (milestone) => percent >= milestone && !reported.has(milestone),
  );
}
