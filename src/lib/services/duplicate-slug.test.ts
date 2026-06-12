import { describe, expect, it } from "vitest";
import { copyBaseSlug, deriveCopySlug } from "./duplicate-slug";

const free = async () => false;
const takenSet = (taken: string[]) => async (slug: string) =>
  taken.includes(slug);

describe("copyBaseSlug", () => {
  it("leaves a plain slug unchanged", () => {
    expect(copyBaseSlug("start-vending")).toBe("start-vending");
  });

  it("strips a trailing -copy", () => {
    expect(copyBaseSlug("start-vending-copy")).toBe("start-vending");
  });

  it("strips a trailing -copy-N", () => {
    expect(copyBaseSlug("start-vending-copy-3")).toBe("start-vending");
  });

  it("only strips the final copy marker", () => {
    expect(copyBaseSlug("start-copy-vending")).toBe("start-copy-vending");
  });
});

describe("deriveCopySlug", () => {
  it("appends -copy when the slot is free", async () => {
    expect(await deriveCopySlug("start-vending", free)).toBe(
      "start-vending-copy",
    );
  });

  it("increments to -copy-2 when -copy is taken", async () => {
    const isTaken = takenSet(["start-vending-copy"]);
    expect(await deriveCopySlug("start-vending", isTaken)).toBe(
      "start-vending-copy-2",
    );
  });

  it("keeps incrementing across a run of collisions", async () => {
    const isTaken = takenSet([
      "start-vending-copy",
      "start-vending-copy-2",
      "start-vending-copy-3",
    ]);
    expect(await deriveCopySlug("start-vending", isTaken)).toBe(
      "start-vending-copy-4",
    );
  });

  it("duplicates a duplicate as -copy-2, never -copy-copy", async () => {
    // Source already ends in -copy; its own -copy slot is taken (the source).
    const isTaken = takenSet(["start-vending-copy"]);
    expect(await deriveCopySlug("start-vending-copy", isTaken)).toBe(
      "start-vending-copy-2",
    );
  });

  it("duplicates a -copy-N source from the same base", async () => {
    const isTaken = takenSet(["start-vending-copy", "start-vending-copy-2"]);
    expect(await deriveCopySlug("start-vending-copy-2", isTaken)).toBe(
      "start-vending-copy-3",
    );
  });

  it("truncates a very long base so the slug stays within 120 chars", async () => {
    const longBase = "a".repeat(140);
    const result = await deriveCopySlug(longBase, free);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith("-copy")).toBe(true);
  });

  it("truncates without leaving a trailing hyphen before the suffix", async () => {
    // base of exactly the room length minus a hyphen boundary
    const base = `${"a".repeat(114)}-bbbbbbbbbb`; // 125 chars
    const result = await deriveCopySlug(base, free);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result).not.toContain("--");
    expect(result.endsWith("-copy")).toBe(true);
  });

  it("falls back to a timestamp suffix after exhausting sequential attempts", async () => {
    // Every -copy and -copy-2..-copy-50 is taken.
    const taken = new Set<string>(["start-copy"]);
    for (let n = 2; n <= 50; n++) taken.add(`start-copy-${n}`);
    const isTaken = async (slug: string) => taken.has(slug);
    const result = await deriveCopySlug("start", isTaken, {
      now: () => 1781080000000,
    });
    expect(result).toBe("start-copy-1781080000000");
  });

  it("respects the uniqueness predicate exactly (does not skip free slots)", async () => {
    const seen: string[] = [];
    const isTaken = async (slug: string) => {
      seen.push(slug);
      return slug === "x-copy";
    };
    const result = await deriveCopySlug("x", isTaken);
    expect(result).toBe("x-copy-2");
    expect(seen).toEqual(["x-copy", "x-copy-2"]);
  });
});
