import { describe, expect, it } from "vitest";
import {
  buildPace,
  daysBetween,
  monthPeriod,
  workdaysBetween,
} from "./goal-pace";

const october = monthPeriod("2026-10");

describe("periods", () => {
  it("knows the shape of a month", () => {
    expect(october).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthPeriod("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(31);
    // October 2026 starts on a Thursday: 22 weekdays.
    expect(workdaysBetween("2026-10-01", "2026-10-31")).toBe(22);
  });
});

describe("buildPace", () => {
  it("expects the elapsed share of the target and calls the gap", () => {
    // Ten of thirty-one days elapsed: 32.3% of 310 is 100.
    const pace = buildPace({
      target: 310,
      actual: 120,
      period: october,
      today: "2026-10-10",
    });
    expect(pace.expected).toBe(100);
    expect(pace.variance).toBe(20);
    expect(pace.variancePct).toBe(20);
    expect(pace.status).toBe("ahead");
    expect(pace.projected).toBe(372);
    expect(pace.weeklyTarget).toBe(70);
    // 190 more calls over the remaining 21 days = 63 a week.
    expect(pace.neededPerWeek).toBe(63);
  });

  it("is on pace within the tolerance and behind outside it", () => {
    const base = { target: 310, period: october, today: "2026-10-10" };
    expect(buildPace({ ...base, actual: 103 }).status).toBe("on pace");
    expect(buildPace({ ...base, actual: 90 }).status).toBe("behind");
  });

  it("paces Lane 2 on workdays", () => {
    // Oct 1 (Thu) through Oct 9 (Fri) is 7 workdays of 22.
    const pace = buildPace({
      target: 330,
      actual: 105,
      period: october,
      today: "2026-10-09",
      workdays: true,
    });
    expect(pace.expected).toBe(105);
    expect(pace.status).toBe("on pace");
    expect(pace.weeklyTarget).toBe(75);
  });

  it("never invents a number it cannot have", () => {
    expect(
      buildPace({
        target: null,
        actual: 12,
        period: october,
        today: "2026-10-10",
      }),
    ).toMatchObject({ status: "no target", expected: null, projected: 37 });
    expect(
      buildPace({
        target: 100,
        actual: null,
        period: october,
        today: "2026-10-10",
      }),
    ).toMatchObject({ status: "not measured", variance: null });
    const early = buildPace({
      target: 100,
      actual: 0,
      period: october,
      today: "2026-09-13",
    });
    expect(early).toMatchObject({
      status: "not started",
      elapsedShare: 0,
      projected: null,
    });
  });

  it("caps a finished period at its full target", () => {
    const pace = buildPace({
      target: 100,
      actual: 90,
      period: october,
      today: "2026-11-15",
    });
    expect(pace.elapsedShare).toBe(1);
    expect(pace.expected).toBe(100);
    expect(pace.neededPerWeek).toBeNull();
    expect(pace.status).toBe("behind");
  });
});
