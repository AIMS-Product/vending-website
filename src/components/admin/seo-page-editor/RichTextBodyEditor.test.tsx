import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "@/lib/page-builder/blocks";
import { RichTextBodyEditor } from "./RichTextBodyEditor";

function renderEditor(document: RichTextDocument) {
  return renderToStaticMarkup(
    <RichTextBodyEditor
      document={document}
      onChange={() => undefined}
      variant="default"
    />,
  );
}

/** Returns the opening tag of the input matching the aria-label. */
function inputTag(html: string, ariaLabel: string): string | null {
  const tags = html.match(/<input\b[^>]*>/g) ?? [];
  return tags.find((tag) => tag.includes(`aria-label="${ariaLabel}"`)) ?? null;
}

describe("RichTextBodyEditor link controls", () => {
  it("renders a labelled Link text input alongside the manual link input", () => {
    const html = renderEditor({
      version: 1,
      nodes: [{ type: "paragraph", text: "Read our vending guide today." }],
    });

    expect(inputTag(html, "Manual link path 1")).not.toBeNull();
    expect(inputTag(html, "Link text 1")).not.toBeNull();
  });

  it("prefills the Link text input from a substring-linked paragraph", () => {
    const html = renderEditor({
      version: 1,
      nodes: [
        {
          type: "paragraph",
          spans: [
            { text: "Read our " },
            { text: "vending guide", href: "/resources/example" },
            { text: " today." },
          ],
        },
      ],
    });

    expect(inputTag(html, "Link text 1")).toContain('value="vending guide"');
    expect(inputTag(html, "Manual link path 1")).toContain(
      'value="/resources/example"',
    );
  });

  it("leaves the Link text input empty for a legacy whole-paragraph link", () => {
    const html = renderEditor({
      version: 1,
      nodes: [
        {
          type: "paragraph",
          spans: [
            {
              text: "Read our vending guide today.",
              href: "/resources/example",
            },
          ],
        },
      ],
    });

    expect(inputTag(html, "Link text 1")).toContain('value=""');
  });
});
