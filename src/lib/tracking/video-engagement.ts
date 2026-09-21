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
 * The quarters. Four per video, and a visitor who plays all fifteen videos
 * through to the end spends sixty events — exactly the per-minute budget the
 * attribution endpoint allows one IP. That visitor is the most engaged person
 * who will ever load the page, and losing their last beacon to a 429 cannot
 * change what a rep concludes, so the ceiling is left where it is.
 * ponytail: if this grows past four thresholds, coalesce per page and flush on
 * pagehide rather than raising the rate limit.
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
