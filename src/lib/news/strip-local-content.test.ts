import { describe, expect, it } from "vitest";
import { stripLocalContent } from "./strip-local-content";

describe("stripLocalContent", () => {
  it("removes a local question with its answer, heading or not", () => {
    const body =
      "## FAQ\n\n### What permits do I need in Eugene, OR?\n\nA city license.\n\nWhat financing exists in Oregon?\n\nCredit unions.\n\n### Is it hard?\n\nSometimes.";
    expect(stripLocalContent(body)).toBe(
      "## FAQ\n\n### Is it hard?\n\nSometimes.",
    );
  });

  it("removes only the local sentence from an otherwise general paragraph", () => {
    expect(
      stripLocalContent(
        "Use telemetry. In Eugene, operators love it. Track weekly.",
      ),
    ).toBe("Use telemetry. Track weekly.");
  });

  it("drops a general question whose whole answer was local", () => {
    expect(
      stripLocalContent(
        "### How do I finance it?\n\nEugene credit unions offer lines.\n\n## Next",
      ),
    ).toBe("## Next");
  });

  it("removes a FAQ heading left with no questions", () => {
    expect(
      stripLocalContent(
        "Intro.\n\nFrequently Asked Questions\n\n### Is Eugene good?\n\nYes.",
      ),
    ).toBe("Intro.");
    const kept =
      "## Frequently Asked Questions\n\n### Is it hard?\n\nSometimes.";
    expect(stripLocalContent(kept)).toBe(kept);
  });

  it("keeps a general statement about Oregon law", () => {
    const text = "Oregon, for instance, has no state sales tax.";
    expect(stripLocalContent(text)).toBe(text);
  });
});
