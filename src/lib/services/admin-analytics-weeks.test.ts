import { describe, expect, it } from "vitest";
import {
  recentWeekRanges,
  resolveAdminAnalyticsRange,
} from "./admin-analytics-range";

describe("recentWeekRanges", () => {
  it("offers whole Mon-Sun weeks, newest first", () => {
    // 2026-09-21 is a Monday, so the newest complete week is Sept 14-20 —
    // the week the glossary measures at 1,308 captured.
    const weeks = recentWeekRanges("2026-09-21", 4);
    expect(weeks.map((w) => [w.startDay, w.endDay])).toEqual([
      ["2026-09-14", "2026-09-20"],
      ["2026-09-07", "2026-09-13"],
      ["2026-08-31", "2026-09-06"],
      ["2026-08-24", "2026-08-30"],
    ]);
  });

  it("excludes the current part-week whatever day it is asked on", () => {
    // Thursday. The week it falls in (Sept 14-20) must not be offered.
    const weeks = recentWeekRanges("2026-09-17", 2);
    expect(weeks[0]).toMatchObject({
      startDay: "2026-09-07",
      endDay: "2026-09-13",
    });
  });

  it("every key resolves back to a seven-day window", () => {
    for (const week of recentWeekRanges("2026-09-21", 12)) {
      const resolved = resolveAdminAnalyticsRange(week.key);
      expect(resolved.days).toBe(7);
      expect(resolved.startDay).toBe(week.startDay);
      expect(resolved.endDay).toBe(week.endDay);
    }
  });

  it("starts each week on a Monday and ends it on a Sunday", () => {
    for (const week of recentWeekRanges("2026-09-21", 12)) {
      expect(new Date(`${week.startDay}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${week.endDay}T00:00:00Z`).getUTCDay()).toBe(0);
    }
  });

  it("marks only the newest as last week", () => {
    const labelled = recentWeekRanges("2026-09-21", 5).filter((w) =>
      w.label.includes("last week"),
    );
    expect(labelled).toHaveLength(1);
  });
});
