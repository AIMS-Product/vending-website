import { describe, expect, it } from "vitest";
import { type PageContent } from "./blocks";
import {
  applyInternalLinkSuggestion,
  suggestInternalLinks,
  type InternalLinkSuggestionTarget,
} from "./internal-link-suggestions";

const currentContent: PageContent = {
  version: 1,
  sections: [
    {
      id: "section_1",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_1",
          width: "1/1",
          blocks: [
            {
              id: "block_intro",
              type: "rich_text",
              variant: "default",
              props: {
                eyebrow: "",
                heading: "Plan before buying machines",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "paragraph",
                      text: "Before you buy a vending machine, compare startup costs and route planning basics.",
                    },
                  ],
                },
              },
            },
            {
              id: "block_cta",
              type: "cta",
              variant: "primary",
              props: {
                label: "Apply now",
                href: "/apply",
                trackingName: "resource_apply_cta",
              },
            },
          ],
        },
      ],
    },
  ],
};

const targets: InternalLinkSuggestionTarget[] = [
  {
    pageId: "page_costs",
    path: "/resources/startup-costs",
    title: "Startup Costs",
    targetKeyword: "startup costs",
    headings: ["Vending machine startup costs"],
    summary: "Understand vending machine startup costs.",
    outgoingInternalLinks: [],
  },
  {
    pageId: "page_route",
    path: "/resources/route-planning",
    title: "Route Planning",
    targetKeyword: "route planning",
    headings: ["Route planning basics"],
    summary: "Plan a vending route.",
    outgoingInternalLinks: [],
  },
];

describe("suggestInternalLinks", () => {
  it("suggests approved internal links from visible anchor text", () => {
    const suggestions = suggestInternalLinks({
      content: currentContent,
      currentPageId: "page_current",
      currentPath: "/resources/current",
      targets,
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        targetPath: "/resources/startup-costs",
        anchorText: "startup costs",
        sourceBlockId: "block_intro",
        reason:
          "The visible copy mentions the target keyword for Startup Costs.",
      }),
      expect.objectContaining({
        targetPath: "/resources/route-planning",
        anchorText: "route planning",
        sourceBlockId: "block_intro",
      }),
    ]);
  });

  it("does not suggest destinations already linked from the page", () => {
    const content: PageContent = {
      ...currentContent,
      sections: [
        {
          ...currentContent.sections[0],
          columns: [
            {
              ...currentContent.sections[0].columns[0],
              blocks: currentContent.sections[0].columns[0].blocks.map(
                (block) =>
                  block.type === "cta"
                    ? {
                        ...block,
                        props: {
                          ...block.props,
                          href: "/resources/startup-costs",
                        },
                      }
                    : block,
              ),
            },
          ],
        },
      ],
    };

    const suggestions = suggestInternalLinks({
      content,
      currentPath: "/resources/current",
      targets,
    });

    expect(suggestions.map((suggestion) => suggestion.targetPath)).toEqual([
      "/resources/route-planning",
    ]);
  });

  it("does not suggest links to the current page", () => {
    const suggestions = suggestInternalLinks({
      content: currentContent,
      currentPageId: "page_costs",
      currentPath: "/resources/startup-costs",
      targets,
    });

    expect(suggestions.map((suggestion) => suggestion.targetPath)).toEqual([
      "/resources/route-planning",
    ]);
  });

  it("enforces a stable max suggestions limit", () => {
    const suggestions = suggestInternalLinks({
      content: currentContent,
      currentPath: "/resources/current",
      targets,
      maxSuggestions: 1,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.targetPath).toBe("/resources/startup-costs");
  });

  it("applies a suggestion to the intended rich text paragraph", () => {
    const [suggestion] = suggestInternalLinks({
      content: currentContent,
      currentPath: "/resources/current",
      targets,
      maxSuggestions: 1,
    });
    if (!suggestion) throw new Error("Expected suggestion.");

    const result = applyInternalLinkSuggestion(currentContent, suggestion);

    expect(result.applied).toBe(true);
    const block = result.content.sections[0]?.columns[0]?.blocks[0];
    if (!block || block.type !== "rich_text") {
      throw new Error("Expected rich text block.");
    }
    expect(block.props.body.nodes[0]).toEqual({
      type: "paragraph",
      spans: [
        { text: "Before you buy a vending machine, compare " },
        { text: "startup costs", href: "/resources/startup-costs" },
        { text: " and route planning basics." },
      ],
    });
  });

  it("does not apply a stale suggestion to changed text", () => {
    const result = applyInternalLinkSuggestion(currentContent, {
      id: "stale",
      targetPageId: "page_costs",
      targetPath: "/resources/startup-costs",
      targetTitle: "Startup Costs",
      anchorText: "missing phrase",
      sourceBlockId: "block_intro",
      sourceNodeIndex: 0,
      reason: "Stale suggestion",
      confidence: 0.95,
    });

    expect(result).toEqual({
      applied: false,
      content: currentContent,
      reason: "The suggested anchor text is no longer present.",
    });
  });
});
