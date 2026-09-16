import { describe, expect, it } from "vitest";
import {
  preCallOperators,
  preCallOperatorTiers,
} from "@/lib/content/pre-call-resources";

// The grouped operator section is only honest if every tier actually renders
// and every story lands in exactly one of them. A typo in a `tier` value
// silently drops a member off the page, and the tier most likely to be dropped
// is the one the section exists for.
describe("pre-call operator tiers", () => {
  const tierIds = preCallOperatorTiers.map((tier) => tier.id);

  it("assigns every operator to a declared tier", () => {
    for (const operator of preCallOperators.items) {
      expect(tierIds).toContain(operator.tier);
    }
  });

  it("leaves no tier empty", () => {
    for (const id of tierIds) {
      expect(
        preCallOperators.items.filter((operator) => operator.tier === id),
      ).not.toHaveLength(0);
    }
  });

  it("gives every operator either a video or a linked, quoted article", () => {
    for (const operator of preCallOperators.items) {
      const hasVideo = "embedId" in operator;
      const hasArticle = "href" in operator && "quote" in operator;
      expect(hasVideo || hasArticle).toBe(true);
    }
  });
});
