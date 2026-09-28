import { describe, expect, it } from "vitest";
import { cohortSeatsLeft } from "./cohort-banner";

const day = (d: number, m = 8) => new Date(2026, m, d);

describe("cohortSeatsLeft", () => {
  it("starts at 15 and drops one every other day", () => {
    expect(cohortSeatsLeft(day(1))).toBe(15);
    expect(cohortSeatsLeft(day(2))).toBe(15);
    expect(cohortSeatsLeft(day(3))).toBe(14);
    expect(cohortSeatsLeft(day(20))).toBe(6);
    expect(cohortSeatsLeft(day(30))).toBe(1);
  });

  it("never drops below 1 and resets on the 1st", () => {
    expect(cohortSeatsLeft(day(31, 9))).toBe(1);
    expect(cohortSeatsLeft(day(1, 10))).toBe(15);
  });
});
