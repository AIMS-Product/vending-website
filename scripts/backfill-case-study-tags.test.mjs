import { describe, expect, it } from "vitest";
import { diffTags } from "./backfill-case-study-tags.mjs";

describe("diffTags", () => {
  it("reports nothing to do when the two sides already match", () => {
    expect(diffTags(["a", "b"], ["b", "a"]).changed).toBe(false);
  });

  it("reports a removal, not just an addition", () => {
    // The four corrected stories only differ by a REMOVED tag. If this
    // collapsed to an additions-only diff those fixes would never ship.
    expect(diffTags(["a"], ["a", "route-acquisition"])).toEqual({
      added: [],
      removed: ["route-acquisition"],
      changed: true,
    });
  });

  it("treats an empty remote as every tag being new", () => {
    expect(diffTags(["a", "b"], []).added).toEqual(["a", "b"]);
  });
});
