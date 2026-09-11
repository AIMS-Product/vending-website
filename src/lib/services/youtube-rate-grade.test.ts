import { describe, expect, it } from "vitest";
import { gradeRates } from "./youtube-rate-grade";

const big = (value: number | null) => ({ value, sample: 50 });

describe("gradeRates", () => {
  it("marks the clear winners and losers against the median", () => {
    // Median of 10, 10, 20, 4, 10 is 10. Good at >= 12.5, poor at <= 7.5.
    const grades = gradeRates([big(10), big(10), big(20), big(4), big(10)]);

    expect(grades).toEqual(["ok", "ok", "good", "poor", "ok"]);
  });

  /**
   * The whole point of the minimum. One booked call out of two is a 50% close
   * rate that means nothing, and painting it green is how a report talks
   * somebody into doubling down on noise.
   */
  it("refuses to judge a rate built on too few rows", () => {
    const grades = gradeRates([
      big(10),
      big(10),
      big(10),
      { value: 50, sample: 2 },
    ]);

    expect(grades[3]).toBeNull();
  });

  it("keeps a small-sample row out of the median as well", () => {
    // If the 200% outlier counted, the median would move and every real row
    // would be re-graded against a number nobody measured.
    const withOutlier = gradeRates([
      big(10),
      big(10),
      big(20),
      { value: 200, sample: 1 },
    ]);
    const without = gradeRates([big(10), big(10), big(20)]);

    expect(withOutlier.slice(0, 3)).toEqual(without);
  });

  it("grades nothing when too few videos are comparable", () => {
    expect(gradeRates([big(10), big(90)])).toEqual([null, null]);
  });

  it("grades nothing when every comparable rate is zero", () => {
    // A table of green zeroes would say these are all doing well.
    expect(gradeRates([big(0), big(0), big(0), big(0)])).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("leaves an unmeasured rate ungraded without dropping the row", () => {
    const grades = gradeRates([big(10), big(10), big(20), big(null)]);

    expect(grades).toHaveLength(4);
    expect(grades[3]).toBeNull();
    expect(grades[2]).toBe("good");
  });

  it("re-calibrates as the whole table improves", () => {
    // Same shape, ten times the rates: the grades must not move. An absolute
    // threshold would call the second table all-green and stop being useful.
    const low = gradeRates([big(1), big(1), big(2), big(0.4)]);
    const high = gradeRates([big(10), big(10), big(20), big(4)]);

    expect(low).toEqual(high);
  });
});
