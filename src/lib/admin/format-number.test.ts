import { describe, expect, it } from "vitest";
import { formatCount, formatUsd } from "./format-number";

describe("formatUsd", () => {
  it("groups thousands", () => {
    expect(formatUsd(1250)).toBe("$1,250");
    expect(formatUsd(87134.4)).toBe("$87,134");
    expect(formatUsd(0)).toBe("$0");
  });

  it("puts the sign before the dollar sign", () => {
    expect(formatUsd(-500)).toBe("-$500");
    expect(formatUsd(-1250)).toBe("-$1,250");
  });

  it("never prints negative zero", () => {
    expect(formatUsd(-0.4)).toBe("$0");
  });
});

describe("formatCount", () => {
  it("groups thousands and rounds", () => {
    expect(formatCount(4276)).toBe("4,276");
    expect(formatCount(12.6)).toBe("13");
  });
});
