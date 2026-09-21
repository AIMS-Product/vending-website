import { describe, expect, it } from "vitest";
import {
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
