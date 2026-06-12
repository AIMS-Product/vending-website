import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import { thinPageWarning } from "./SeoReadinessHelpers";

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

describe("thinPageWarning", () => {
  it("warns when the page has very little body copy", () => {
    const warning = thinPageWarning(content([{ heading: "Just a few words" }]));
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/very little content/i);
    expect(warning).toMatch(/can still publish/i);
  });

  it("does not warn when the page has substantial content", () => {
    const longText = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    expect(thinPageWarning(content([{ body: longText }]))).toBeNull();
  });

  it("counts words across nested string leaves", () => {
    const warning = thinPageWarning(
      content([{ items: [{ text: "one two" }, { text: "three" }] }]),
    );
    // 3 words total → under threshold → warns.
    expect(warning).toMatch(/about 3 words/);
  });

  it("treats an empty page as thin", () => {
    expect(thinPageWarning(content([]))).toMatch(/about 0 words/);
  });
});
