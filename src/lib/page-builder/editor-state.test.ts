import { describe, expect, it } from "vitest";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import {
  createInitialEditorContentState,
  pageEditorContentReducer,
} from "@/lib/page-builder/editor-state";
import type { PageContent } from "@/lib/page-builder/blocks";

describe("page builder editor content reducer", () => {
  it("ensures empty content is editable when initialized or replaced", () => {
    const emptyContent: PageContent = { version: 1, sections: [] };

    expect(createInitialEditorContentState(emptyContent).sections).toHaveLength(
      1,
    );
    expect(
      pageEditorContentReducer(singleBlockContent(), {
        type: "replaceContent",
        content: emptyContent,
      }).sections,
    ).toHaveLength(1);
  });

  it("updates chrome settings without dropping existing chrome defaults", () => {
    const next = pageEditorContentReducer(singleBlockContent(), {
      type: "updateChromeSettings",
      settings: { showHeader: false },
    });

    expect(next.chrome).toMatchObject({
      showHeader: false,
      showFooter: true,
    });
  });

  it("adds, replaces, duplicates, moves, and removes blocks immutably", () => {
    const original = singleBlockContent(createPageBlock("cta", "block_cta"));
    const withHero = pageEditorContentReducer(original, {
      type: "addBlock",
      sectionId: "section_1",
      columnId: "column_1",
      blockType: "hero",
      blockId: "block_hero",
    });
    const replaced = pageEditorContentReducer(withHero, {
      type: "replaceBlock",
      sectionId: "section_1",
      columnId: "column_1",
      blockId: "block_cta",
      block: createPageBlock("faq", "block_faq"),
    });
    const duplicated = pageEditorContentReducer(replaced, {
      type: "duplicateBlock",
      sectionId: "section_1",
      columnId: "column_1",
      blockId: "block_hero",
      nextBlockId: "block_hero_copy",
    });
    const moved = pageEditorContentReducer(duplicated, {
      type: "moveBlock",
      sectionId: "section_1",
      columnId: "column_1",
      blockId: "block_hero_copy",
      direction: "up",
    });
    const removed = pageEditorContentReducer(moved, {
      type: "removeBlock",
      sectionId: "section_1",
      columnId: "column_1",
      blockId: "block_faq",
    });

    expect(
      original.sections[0]?.columns[0]?.blocks.map((block) => block.id),
    ).toEqual(["block_cta"]);
    expect(
      removed.sections[0]?.columns[0]?.blocks.map((block) => block.id),
    ).toEqual(["block_hero_copy", "block_hero"]);
  });

  it("adds suggested blocks to missing or existing primary structure", () => {
    const emptyContent: PageContent = { version: 1, sections: [] };
    const fromEmpty = pageEditorContentReducer(emptyContent, {
      type: "addSuggestedBlock",
      blockType: "rich_text",
      blockId: "block_text",
      sectionId: "section_new",
      columnId: "column_new",
    });
    const fromExisting = pageEditorContentReducer(fromEmpty, {
      type: "addSuggestedBlock",
      blockType: "faq",
      blockId: "block_faq",
      sectionId: "unused_section",
      columnId: "unused_column",
    });

    expect(fromEmpty.sections[0]?.id).toBe("section_new");
    expect(fromEmpty.sections[0]?.columns[0]?.id).toBe("column_new");
    expect(
      fromExisting.sections[0]?.columns[0]?.blocks.map((block) => block.id),
    ).toEqual(["block_text", "block_faq"]);
  });

  it("adds and reorders columns while preserving the four-column cap", () => {
    let content = singleBlockContent();
    content = pageEditorContentReducer(content, {
      type: "addColumn",
      sectionId: "section_1",
      columnId: "column_2",
    });
    content = pageEditorContentReducer(content, {
      type: "addColumn",
      sectionId: "section_1",
      columnId: "column_3",
    });
    content = pageEditorContentReducer(content, {
      type: "addColumn",
      sectionId: "section_1",
      columnId: "column_4",
    });
    const atCap = pageEditorContentReducer(content, {
      type: "addColumn",
      sectionId: "section_1",
      columnId: "column_5",
    });
    const reordered = pageEditorContentReducer(atCap, {
      type: "moveColumnToIndex",
      sectionId: "section_1",
      columnId: "column_4",
      targetIndex: 0,
    });

    expect(atCap.sections[0]?.columns).toHaveLength(4);
    expect(reordered.sections[0]?.columns.map((column) => column.id)).toEqual([
      "column_4",
      "column_1",
      "column_2",
      "column_3",
    ]);
  });
});

function singleBlockContent(
  block = createPageBlock("cta", "block_cta"),
): PageContent {
  return {
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
            blocks: [block],
          },
        ],
      },
    ],
  };
}
