import { describe, expect, it } from "vitest";
import { compactTeaserText } from "./ChatLauncher";

describe("compactTeaserText", () => {
  it("keeps the greeting up to its first question", () => {
    expect(
      compactTeaserText(
        "Hey! Looking into starting a vending business? Ask me anything, happy to point you in the right direction.",
      ),
    ).toBe("Hey! Looking into starting a vending business?");
  });

  it("leaves text without a question untouched", () => {
    expect(compactTeaserText("Ask me anything.")).toBe("Ask me anything.");
  });
});
