import { describe, expect, it } from "vitest";
import { REPORTING_TIME_ZONE as BOOKED_METRICS_TIME_ZONE } from "@/lib/services/booked-metrics";
import {
  REPORTING_TIME_ZONE,
  customWindowKey,
  daysBetween,
  parseDashboardWindow,
  reportingDay,
  resolveDashboardWindow,
} from "./dashboard-window";

describe("dashboard windows", () => {
  it("uses the booked-call measures' reporting time zone", () => {
    expect(REPORTING_TIME_ZONE).toBe(BOOKED_METRICS_TIME_ZONE);
  });

  it("dates today in New York, not UTC", () => {
    // 03:00 UTC on Oct 2 is still Oct 1 in New York.
    expect(reportingDay(new Date("2026-10-02T03:00:00Z"))).toBe("2026-10-01");
  });

  it("compares a trailing window with the same length before it", () => {
    const w = resolveDashboardWindow("7d", "2026-10-02");
    expect(w).toMatchObject({
      startDay: "2026-09-26",
      endDay: "2026-10-02",
      days: 7,
      prior: { startDay: "2026-09-19", endDay: "2026-09-25" },
    });
    expect(daysBetween(w)).toHaveLength(7);
  });

  it("compares today with yesterday", () => {
    const w = resolveDashboardWindow("today", "2026-10-02");
    expect(w.prior).toEqual({ startDay: "2026-10-01", endDay: "2026-10-01" });
  });

  it("compares month to date with the same days last month, clamped", () => {
    expect(resolveDashboardWindow("mtd", "2026-10-12").prior).toEqual({
      startDay: "2026-09-01",
      endDay: "2026-09-12",
    });
    // March 31 compares with all of February, never March 1-3.
    expect(resolveDashboardWindow("mtd", "2026-03-31").prior).toEqual({
      startDay: "2026-02-01",
      endDay: "2026-02-28",
    });
  });

  it("starts quarter to date on the quarter's first day", () => {
    const w = resolveDashboardWindow("qtd", "2026-11-15");
    expect(w.startDay).toBe("2026-10-01");
    expect(w.prior).toEqual({ startDay: "2026-07-01", endDay: "2026-08-15" });
  });

  it("accepts a real custom range and rejects nonsense", () => {
    expect(customWindowKey("2026-09-01", "2026-09-30")).toBe(
      "custom:2026-09-01:2026-09-30",
    );
    expect(customWindowKey("2026-09-30", "2026-09-01")).toBeNull();
    expect(customWindowKey("2026-02-30", "2026-03-01")).toBeNull();
    expect(parseDashboardWindow("custom:1900-01-01:2026-01-01")).toBe("30d");
    expect(parseDashboardWindow("bogus")).toBe("30d");
    const w = resolveDashboardWindow(
      "custom:2026-09-01:2026-09-30",
      "2026-10-02",
    );
    expect(w.prior).toEqual({ startDay: "2026-08-02", endDay: "2026-08-31" });
  });
});
