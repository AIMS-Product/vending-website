import { describe, expect, it } from "vitest";
import { heroV2 } from "./home-v2";

describe("home hero", () => {
  it("sends the free roadmap CTA to the roadmap download page", () => {
    // Jess, 2026-09-22: it pointed at /vending-route-blueprint, which has no roadmap.
    expect(heroV2.secondaryCta.href).toBe("/resources/roadmap");
  });
});
