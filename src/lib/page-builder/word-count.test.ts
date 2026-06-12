import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import { countContentWords, countWordsInValue } from "./word-count";

function content(blocks: Array<Record<string, unknown>>): PageContent {
  return {
    version: 1,
    sections: [
      {
        id: "s1",
        preset: "standard",
        background: "default",
        spacing: "standard",
        columns: [
          {
            id: "c1",
            width: "1/1",
            blocks: blocks.map((props, i) => ({
              id: `b${i}`,
              type: "rich_text",
              variant: "default",
              props,
            })),
          },
        ],
      },
    ],
  } as unknown as PageContent;
}

describe("countWordsInValue", () => {
  it("counts whitespace-separated words in a string leaf", () => {
    expect(countWordsInValue("one two   three")).toBe(3);
  });

  it("treats empty and whitespace-only strings as zero words", () => {
    expect(countWordsInValue("")).toBe(0);
    expect(countWordsInValue("   \n\t ")).toBe(0);
  });

  it("sums words across arrays and nested objects", () => {
    expect(
      countWordsInValue({
        heading: "one two",
        items: [{ text: "three" }, { text: "four five" }],
      }),
    ).toBe(5);
  });

  it("ignores non-string scalars and structure", () => {
    expect(countWordsInValue(42)).toBe(0);
    expect(countWordsInValue(true)).toBe(0);
    expect(countWordsInValue(null)).toBe(0);
    expect(countWordsInValue(undefined)).toBe(0);
    expect(countWordsInValue({ count: 7, enabled: false })).toBe(0);
  });
});

describe("countContentWords", () => {
  it("counts words over every block's props", () => {
    expect(
      countContentWords(
        content([{ heading: "Two words" }, { body: "and three more" }]),
      ),
    ).toBe(5);
  });

  it("counts nested string leaves inside block props", () => {
    expect(
      countContentWords(
        content([{ items: [{ text: "one two" }, { text: "three" }] }]),
      ),
    ).toBe(3);
  });

  it("returns zero for a page with no blocks", () => {
    expect(countContentWords(content([]))).toBe(0);
  });
});
