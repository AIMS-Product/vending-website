import { describe, expect, it } from "vitest";
import { MOBILE_BATCH, nextMobileBatch } from "./StoriesToggle";

describe("nextMobileBatch", () => {
  it("opens six more cards per tap and offers the next batch", () => {
    expect(MOBILE_BATCH).toBe(6);
    expect(nextMobileBatch(4, 25)).toEqual({ visible: 10, nextCount: 6 });
    expect(nextMobileBatch(10, 25)).toEqual({ visible: 16, nextCount: 6 });
    expect(nextMobileBatch(16, 25)).toEqual({ visible: 22, nextCount: 3 });
  });

  it("stops at the total and hides the button when none remain", () => {
    expect(nextMobileBatch(22, 25)).toEqual({ visible: 25, nextCount: 0 });
    expect(nextMobileBatch(24, 25, 6)).toEqual({ visible: 25, nextCount: 0 });
  });
});
