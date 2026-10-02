import { describe, expect, it } from "vitest";
import {
  formatPacificDay,
  formatPacificStamp,
  formatPacificStampShort,
} from "./format-time";

describe("admin time formatting", () => {
  it("labels the Pacific time of a 5:30am audit instead of printing UTC", () => {
    expect(formatPacificStamp("2026-09-30T12:30:00Z")).toBe(
      "Sep 30, 2026, 5:30 AM PT",
    );
    expect(formatPacificStampShort("2026-09-30T12:30:00Z")).toBe(
      "Sep 30, 5:30 AM PT",
    );
  });

  it("keeps an evening Pacific call on its own day", () => {
    // 6pm PDT on Sep 30 is 01:00 UTC on Oct 1.
    expect(formatPacificDay("2026-10-01T01:00:00Z")).toBe("Sep 30");
    expect(formatPacificDay("2026-10-01T01:00:00Z", { year: true })).toBe(
      "Sep 30, 2026",
    );
  });

  it("does not shift a bare calendar date back a day", () => {
    expect(formatPacificDay("2026-09-30")).toBe("Sep 30");
  });

  it("returns null for missing or invalid input", () => {
    expect(formatPacificDay(null)).toBeNull();
    expect(formatPacificDay("")).toBeNull();
    expect(formatPacificStamp("not a date")).toBeNull();
  });
});
