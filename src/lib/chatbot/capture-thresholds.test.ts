import { describe, expect, it } from "vitest";
import { captureAggressivenessThreshold } from "@/lib/chatbot/capture-thresholds";

describe("captureAggressivenessThreshold", () => {
  it("maps eager/balanced/relaxed to 1/2/3 assistant replies", () => {
    expect(captureAggressivenessThreshold("eager")).toBe(1);
    expect(captureAggressivenessThreshold("balanced")).toBe(2);
    expect(captureAggressivenessThreshold("relaxed")).toBe(3);
  });

  it("defaults to balanced (2) for an unset value", () => {
    expect(captureAggressivenessThreshold(undefined)).toBe(2);
  });
});
