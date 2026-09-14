import { describe, expect, it } from "vitest";
import { stripChatbotFormatting } from "./strip-formatting";

// Naturalness pass: markdown links must survive so ChatTranscript can render
// real anchors, while every other markdown construct keeps getting stripped.
describe("stripChatbotFormatting", () => {
  it("preserves a markdown link untouched", () => {
    expect(
      stripChatbotFormatting(
        "we've got a free [90-day roadmap](/resources/roadmap) that walks through it",
      ),
    ).toBe(
      "we've got a free [90-day roadmap](/resources/roadmap) that walks through it",
    );
  });

  it("preserves multiple links in one message", () => {
    const input =
      "grab a time [here](/book-now) or read the [roadmap](/resources/roadmap) first";
    expect(stripChatbotFormatting(input)).toBe(input);
  });

  it("still strips bold/italic/headers/bullets around a preserved link", () => {
    expect(
      stripChatbotFormatting(
        "# Heads up\n**check this**: [roadmap](/resources/roadmap)\n- go now",
      ),
    ).toBe("Heads up\ncheck this: [roadmap](/resources/roadmap)\ngo now");
  });

  it("still strips markdown when there is no link", () => {
    expect(stripChatbotFormatting("**bold** and _italic_ and `code`")).toBe(
      "bold and italic and code",
    );
  });

  it("still converts em/en dashes to commas outside of links", () => {
    expect(stripChatbotFormatting("side income — not a job")).toBe(
      "side income, not a job",
    );
  });

  // 33d96433: "2–4 machines" reached a visitor as "2, 4 machines".
  it("turns a dash between numbers into a range, not a comma", () => {
    expect(stripChatbotFormatting("most start with 2–4 machines")).toBe(
      "most start with 2 to 4 machines",
    );
    expect(stripChatbotFormatting("Tuesday at 10 — 10:45 am")).toBe(
      "Tuesday at 10 to 10:45 am",
    );
  });

  it("does not treat an absolute https link as line-leading bullet punctuation", () => {
    const input = "[book a call](https://www.vendingpreneurs.com/book-now)";
    expect(stripChatbotFormatting(input)).toBe(input);
  });
});
