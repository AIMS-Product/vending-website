import { describe, expect, it } from "vitest";
import { chunk, ID_BATCH } from "./batch";

describe("chunk", () => {
  // The Video tab's 90-day range hung because every booking's id went into one
  // PostgREST `in` list, which builds a URL the request never returns from.
  it("splits a list into batches of at most the given size", () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const batches = chunk(ids, ID_BATCH);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(ID_BATCH);
    expect(batches[2]).toHaveLength(450 - ID_BATCH * 2);
    expect(batches.flat()).toEqual(ids);
  });

  it("returns nothing for an empty list", () => {
    expect(chunk([], ID_BATCH)).toEqual([]);
  });

  it("refuses a size that would loop forever", () => {
    expect(() => chunk(["a"], 0)).toThrow();
  });
});
