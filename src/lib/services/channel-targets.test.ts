import { describe, expect, it } from "vitest";
import {
  GOAL_CHANNELS,
  channelKeyForFunnel,
  hasTargets,
  monthsFrom,
  targetForMonth,
  targetOver,
  totalTargetOver,
} from "./channel-targets";

function channel(key: string) {
  const found = GOAL_CHANNELS.find((entry) => entry.key === key);
  if (!found) throw new Error(`No channel ${key}`);
  return found;
}

describe("targetForMonth", () => {
  it("compounds 10% a month from the August a channel actually booked", () => {
    const lane2 = channel("lane-2"); // 291 in August
    expect(targetForMonth(lane2, "2026-09")).toBe(320);
    expect(targetForMonth(lane2, "2026-10")).toBe(352);
    expect(targetForMonth(lane2, "2026-11")).toBe(387);
    expect(targetForMonth(lane2, "2026-12")).toBe(426);
  });

  it("gives every priority channel its own curve", () => {
    expect(targetForMonth(channel("webinar"), "2026-10")).toBe(87);
    expect(targetForMonth(channel("youtube"), "2026-10")).toBe(77);
    expect(targetForMonth(channel("instagram"), "2026-10")).toBe(62);
    expect(targetForMonth(channel("website"), "2026-10")).toBe(54);
  });

  it("holds Marketing Reactivation flat rather than growing zero", () => {
    const fixed = channel("marketing-reactivation");
    expect(targetForMonth(fixed, "2026-09")).toBe(44);
    expect(targetForMonth(fixed, "2026-12")).toBe(44);
  });

  it("sets no target for a channel with no baseline", () => {
    expect(targetForMonth(channel("newsletter"), "2026-10")).toBeNull();
  });

  it("sets no target before the plan starts", () => {
    expect(hasTargets("2026-08")).toBe(false);
    expect(targetForMonth(channel("lane-2"), "2026-08")).toBeNull();
    expect(
      targetForMonth(channel("marketing-reactivation"), "2026-06"),
    ).toBeNull();
  });
});

describe("targetOver", () => {
  it("sums a quarter's own months instead of multiplying one of them", () => {
    const lane2 = channel("lane-2");
    // The point of a compounding plan: October, November and December differ.
    expect(targetOver(lane2, "2026-10", 3)).toBe(352 + 387 + 426);
    expect(targetOver(lane2, "2026-10", 3)).not.toBe(
      (targetForMonth(lane2, "2026-10") ?? 0) * 3,
    );
  });

  it("stays null for a channel the plan sets no number for", () => {
    expect(targetOver(channel("newsletter"), "2026-10", 3)).toBeNull();
  });
});

describe("totalTargetOver", () => {
  it("adds every channel's month", () => {
    // 320 + 79 + 70 + 56 + 44 + 50, Newsletter excluded.
    expect(totalTargetOver("2026-09", 1)).toBe(619);
    expect(totalTargetOver("2026-10", 1)).toBe(676);
    expect(totalTargetOver("2026-11", 1)).toBe(740);
    expect(totalTargetOver("2026-12", 1)).toBe(810);
  });

  it("makes Q4 the sum of October, November and December", () => {
    expect(totalTargetOver("2026-10", 3)).toBe(676 + 740 + 810);
  });

  it("has no target before the plan starts", () => {
    expect(totalTargetOver("2026-08", 1)).toBeNull();
  });
});

describe("monthsFrom", () => {
  it("walks forward and rolls the year", () => {
    expect(monthsFrom("2026-10", 3)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(monthsFrom("2026-12", 2)).toEqual(["2026-12", "2027-01"]);
  });
});

describe("channelKeyForFunnel", () => {
  it("maps the plan's funnels, exactly as the workbook's attribution rules do", () => {
    expect(channelKeyForFunnel("Reactivation Scrapers")).toBe("lane-2");
    expect(channelKeyForFunnel("Sales Reactivation")).toBe("lane-2");
    expect(channelKeyForFunnel("Internal Webinar")).toBe("webinar");
    expect(channelKeyForFunnel("Anthony IG")).toBe("instagram");
    expect(channelKeyForFunnel("Reactivation Email")).toBe(
      "marketing-reactivation",
    );
  });

  it("puts a funnel the plan does not name in Other, and a blank one nowhere", () => {
    expect(channelKeyForFunnel("Meta Ads")).toBe("other");
    expect(channelKeyForFunnel(null)).toBeNull();
    expect(channelKeyForFunnel("  ")).toBeNull();
  });
});
