import { describe, expect, it } from "vitest";
import {
  createEditablePageContent,
  createPageBlock,
  duplicatePageBlock,
  ensureEditablePageContent,
  moveItem,
  moveItemToIndex,
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
    expect(moveItem(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], -1, "down")).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 3, "up")).toEqual(["a", "b", "c"]);
  });

  it("duplicates a block with a fresh id without weakening the schema", () => {
    const block = createPageBlock("card_grid", "block_a");
    const duplicate = duplicatePageBlock(block, "block_b");

    expect(duplicate).toEqual({
      ...block,
      id: "block_b",
    });
    expect(
      pageContentSchema
        .parse({
          version: 1,
          sections: [
            {
              id: "section_a",
              preset: "standard",
              background: "default",
              spacing: "standard",
              columns: [
                {
                  id: "column_a",
                  width: "1/1",
                  blocks: [block, duplicate],
                },
              ],
            },
          ],
        })
        .sections[0]?.columns[0]?.blocks.map((item) => item.id),
    ).toEqual(["block_a", "block_b"]);
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

  it("moves an item to an explicit target index", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(moveItemToIndex(items, 0, 2)).toEqual([
      { id: "b" },
      { id: "c" },
      { id: "a" },
    ]);
    expect(moveItemToIndex(items, 2, 0)).toEqual([
      { id: "c" },
      { id: "a" },
      { id: "b" },
    ]);
    expect(moveItemToIndex(items, 1, 1)).toBe(items);
  });

  it("keeps the original array for out-of-range index moves", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(moveItemToIndex(items, -1, 1)).toBe(items);
    expect(moveItemToIndex(items, 3, 1)).toBe(items);
    expect(moveItemToIndex(items, 1, -1)).toBe(items);
    expect(moveItemToIndex(items, 1, 3)).toBe(items);
  });

  it("keeps the original array when reorder IDs are unchanged or missing", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(reorderItemsById(items, "b", "b")).toBe(items);
    expect(reorderItemsById(items, "missing", "b")).toBe(items);
    expect(reorderItemsById(items, "b", "missing")).toBe(items);
    expect(reorderItemsById(items, "b", "c")).toEqual([
      { id: "a" },
      { id: "c" },
      { id: "b" },
    ]);
  });
});
