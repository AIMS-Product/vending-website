import { describe, expect, it } from "vitest";
import { conversionPValue } from "@/lib/ltf/report";

describe("conversionPValue", () => {
  it("refuses to judge before 30 buyers per version", () => {
    expect(
      conversionPValue(
        { buyers: 29, visitors: 500 },
        { buyers: 60, visitors: 500 },
      ),
    ).toBeNull();
    expect(
      conversionPValue(
        { buyers: 40, visitors: 0 },
        { buyers: 60, visitors: 500 },
      ),
    ).toBeNull();
  });

  it("finds no difference between identical versions", () => {
    expect(
      conversionPValue(
        { buyers: 50, visitors: 1000 },
        { buyers: 50, visitors: 1000 },
      ),
    ).toBeCloseTo(1, 6);
  });

  it("matches a textbook z-test (5% vs 7.5% on 1,000 each, p ~ 0.02)", () => {
    const p = conversionPValue(
      { buyers: 50, visitors: 1000 },
      { buyers: 75, visitors: 1000 },
    )!;
    expect(p).toBeGreaterThan(0.015);
    expect(p).toBeLessThan(0.025);
  });
});
