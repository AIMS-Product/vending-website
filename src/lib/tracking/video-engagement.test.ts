import { describe, expect, it } from "vitest";
import {
  audiblePercentWatched,
  milestonesReached,
  percentWatched,
  VIDEO_MILESTONES,
} from "./video-engagement";

describe("percentWatched", () => {
  it("floors the fraction to whole percent", () => {
    expect(percentWatched(30, 120)).toBe(25);
    expect(percentWatched(29.9, 120)).toBe(24);
  });

  it("is null while the player cannot say how long the video is", () => {
    expect(percentWatched(5, 0)).toBeNull();
    expect(percentWatched(5, Number.NaN)).toBeNull();
    expect(percentWatched(Number.NaN, 120)).toBeNull();
  });

  it("clamps past the end rather than reporting over 100", () => {
    expect(percentWatched(130, 120)).toBe(100);
  });
});

describe("audiblePercentWatched", () => {
  it("counts nothing while the player is muted", () => {
    // Vidalytics autoplays muted: an untouched tab would otherwise log a
    // 90-second answer video as watched to the end.
    expect(audiblePercentWatched(90, 90, true)).toBeNull();
  });

  it("counts normally once the visitor unmutes", () => {
    expect(audiblePercentWatched(30, 120, false)).toBe(25);
  });
});

describe("milestonesReached", () => {
  it("reports a milestone once", () => {
    const reported = new Set<number>();
    expect(milestonesReached(26, reported)).toEqual([25]);
    reported.add(25);
    expect(milestonesReached(30, reported)).toEqual([]);
  });

  it("reports every milestone a scrub jumped over", () => {
    expect(milestonesReached(100, new Set())).toEqual([...VIDEO_MILESTONES]);
  });

  it("reports nothing below the first quarter", () => {
    expect(milestonesReached(24, new Set())).toEqual([]);
  });
});

describe("one event per crossing", () => {
  // The live-page defect: seeking to 60% crossed 25 and 50 at the same instant,
  // both were sent as separate beacons, and the writes raced — 25 won and the
  // stored progress was lower than what was actually watched.
  it("gives the caller the furthest milestone as the last element", () => {
    const crossed = milestonesReached(60, new Set());
    expect(crossed).toEqual([25, 50]);
    expect(crossed[crossed.length - 1]).toBe(50);
  });

  it("reports nothing once every crossed milestone is accounted for", () => {
    const reported = new Set<number>();
    const first = milestonesReached(60, reported);
    for (const m of first) reported.add(m);
    expect(milestonesReached(60, reported)).toEqual([]);
    expect(milestonesReached(76, reported)).toEqual([75]);
  });
});
