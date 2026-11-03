import { describe, expect, it } from "vitest";
import { addInlineLink } from "./add-inline-link";

describe("addInlineLink", () => {
  it("links the first plain occurrence", () => {
    expect(addInlineLink("An LLC helps. An LLC costs.", "An LLC", "/llc")).toBe(
      "[An LLC](/llc) helps. An LLC costs.",
    );
  });

  it("skips headings and existing links", () => {
    const body = "## An LLC\n\n[An LLC](/x) and then An LLC again.";
    expect(addInlineLink(body, "An LLC", "/llc")).toBe(
      "## An LLC\n\n[An LLC](/x) and then [An LLC](/llc) again.",
    );
  });

  it("does nothing when already linked or the phrase is missing", () => {
    expect(
      addInlineLink("See [it](/llc). An LLC.", "An LLC", "/llc"),
    ).toBeNull();
    expect(addInlineLink("No match here.", "An LLC", "/llc")).toBeNull();
  });
});
