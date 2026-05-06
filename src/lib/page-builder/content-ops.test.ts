import { describe, expect, it } from "vitest";
import {
  createEditablePageContent,
  createPageBlock,
  ensureEditablePageContent,
  moveItem,
  reorderItemsById,
} from "./content-ops";
import { flattenBlocks, pageContentSchema, type PageContent } from "./blocks";

describe("page builder content operations", () => {
  it("creates an editable starter tree without weakening the draft schema", () => {
    const content = ensureEditablePageContent({ version: 1, sections: [] });

    expect(pageContentSchema.parse(content)).toMatchObject({
      version: 1,
      sections: [
        {
          id: "section_1",
          columns: [{ id: "column_1", blocks: [] }],
        },
      ],
    });
  });

  it("reorders items by stable IDs", () => {
    const sections = [
      { id: "section_a" },
      { id: "section_b" },
      { id: "section_c" },
    ];

    expect(reorderItemsById(sections, "section_c", "section_a")).toEqual([
      { id: "section_c" },
      { id: "section_a" },
      { id: "section_b" },
    ]);
  });

  it("moves items with keyboard-style direction commands", () => {
    expect(moveItem(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, "up")).toEqual(["a", "b", "c"]);
  });

  it("preserves saved section, column, and block order for publish rendering", () => {
    const ctaA = createPageBlock("cta", "block_a");
    const ctaB = createPageBlock("cta", "block_b");
    const ctaC = createPageBlock("cta", "block_c");
    const content: PageContent = {
      ...createEditablePageContent(),
      sections: [
        {
          id: "section_a",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            { id: "column_a", width: "1/1", blocks: [ctaA] },
            { id: "column_b", width: "1/1", blocks: [ctaB] },
          ],
        },
        {
          id: "section_b",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [{ id: "column_c", width: "1/1", blocks: [ctaC] }],
        },
      ],
    };

    const reorderedSections = reorderItemsById(
      content.sections,
      "section_b",
      "section_a",
    );
    const reorderedColumns = reorderItemsById(
      content.sections[0]?.columns ?? [],
      "column_b",
      "column_a",
    );
    const nextContent = pageContentSchema.parse({
      ...content,
      sections: [
        { ...reorderedSections[0], columns: reorderedSections[0]?.columns },
        { ...reorderedSections[1], columns: reorderedColumns },
      ],
    });

    expect(flattenBlocks(nextContent).map((block) => block.id)).toEqual([
      "block_c",
      "block_b",
      "block_a",
    ]);
  });
});
