import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { RichTextBlock } from "./RichTextBlock";

type RichTextBlockType = Extract<PageBlock, { type: "rich_text" }>;

function buildRichTextBlock(
  variant: RichTextBlockType["variant"],
  listStyle: "bullet" | "numbered",
): RichTextBlockType {
  return {
    id: "test-rich-text",
    type: "rich_text",
    variant,
    props: {
      eyebrow: "",
      heading: "",
      body: {
        version: 1,
        nodes: [
          {
            type: "list",
            style: listStyle,
            items: ["First item", "Second item"],
          },
        ],
      },
    },
  };
}

function extractListClass(html: string, tag: "ul" | "ol"): string {
  const match = html.match(new RegExp(`<${tag} class="([^"]*)"`));
  expect(match, `expected <${tag}> with a class attribute`).not.toBeNull();
  return match![1];
}

describe("RichTextBlock list styling", () => {
  it("renders bullet lists as <ul> with list-disc", () => {
    const html = renderToStaticMarkup(
      <RichTextBlock
        block={buildRichTextBlock("default", "bullet")}
        renderMode="public"
        linkMode="live"
      />,
    );

    const listClass = extractListClass(html, "ul");
    expect(listClass).toContain("list-disc");
    expect(listClass).toContain("ml-5");
    expect(listClass).toContain("space-y-2");
  });

  it("renders numbered lists as <ol> with list-decimal", () => {
    const html = renderToStaticMarkup(
      <RichTextBlock
        block={buildRichTextBlock("default", "numbered")}
        renderMode="public"
        linkMode="live"
      />,
    );

    const listClass = extractListClass(html, "ol");
    expect(listClass).toContain("list-decimal");
    expect(listClass).toContain("ml-5");
    expect(listClass).toContain("space-y-2");
  });

  it("keeps the checklist variant on list-none with no markers", () => {
    const html = renderToStaticMarkup(
      <RichTextBlock
        block={buildRichTextBlock("checklist", "bullet")}
        renderMode="public"
        linkMode="live"
      />,
    );

    const listClass = extractListClass(html, "ul");
    expect(listClass).toBe("ml-0 list-none space-y-3");
  });
});
