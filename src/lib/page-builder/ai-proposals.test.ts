import { describe, expect, it } from "vitest";
import { validateAiPageProposal } from "@/lib/page-builder/ai-proposals";

function proposal(metaDescription: string) {
  return {
    version: 1,
    metadata: { metaDescription },
    blocks: [],
    warnings: [],
  };
}

describe("validateAiPageProposal meta description length", () => {
  it("rejects AI-written meta descriptions longer than 155 characters", () => {
    const result = validateAiPageProposal(proposal("m".repeat(156)));

    expect(result.success).toBe(false);
  });

  it("accepts AI-written meta descriptions at exactly 155 characters", () => {
    const result = validateAiPageProposal(proposal("m".repeat(155)));

    expect(result.success).toBe(true);
  });
});
