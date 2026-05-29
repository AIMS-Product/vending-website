import {
  pageChromeSettings,
  type PageBlock,
  type PageChromeSettings,
  type PageContent,
} from "@/lib/page-builder/blocks";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import {
  createPageColumn,
  createPageSection,
  duplicatePageBlock,
  ensureEditablePageContent,
  moveItem,
  moveItemToIndex,
  type MoveDirection,
} from "@/lib/page-builder/content-ops";
import {
  createPageBlockWithVariant,
  updateColumn,
  updateSection,
} from "@/lib/page-builder/editor-helpers";

export type PageEditorContentAction =
  | { type: "replaceContent"; content: PageContent }
  | { type: "updateChromeSettings"; settings: Partial<PageChromeSettings> }
  | {
      type: "addBlock";
      sectionId: string;
      columnId: string;
      blockType: PageBlock["type"];
      blockId: string;
      variant?: BlockVariant;
    }
  | { type: "addColumn"; sectionId: string; columnId: string }
  | {
      type: "addSuggestedBlock";
      blockType: PageBlock["type"];
      blockId: string;
      sectionId: string;
      columnId: string;
    }
  | {
      type: "replaceBlock";
      sectionId: string;
      columnId: string;
      blockId: string;
      block: PageBlock;
    }
  | { type: "moveSection"; sectionId: string; direction: MoveDirection }
  | {
      type: "moveColumn";
      sectionId: string;
      columnId: string;
      direction: MoveDirection;
    }
  | {
      type: "moveBlock";
      sectionId: string;
      columnId: string;
      blockId: string;
      direction: MoveDirection;
    }
  | {
      type: "moveBlockToIndex";
      sectionId: string;
      columnId: string;
      blockId: string;
      targetIndex: number;
    }
  | {
      type: "duplicateBlock";
      sectionId: string;
      columnId: string;
      blockId: string;
      nextBlockId: string;
    }
  | { type: "removeSection"; sectionId: string }
  | { type: "removeColumn"; sectionId: string; columnId: string }
  | {
      type: "removeBlock";
      sectionId: string;
      columnId: string;
      blockId: string;
    }
  | { type: "moveSectionToIndex"; sectionId: string; targetIndex: number }
  | {
      type: "moveColumnToIndex";
      sectionId: string;
      columnId: string;
      targetIndex: number;
    };

export function createInitialEditorContentState(
  content: PageContent,
): PageContent {
  return ensureEditablePageContent(content);
}

export function pageEditorContentReducer(
  content: PageContent,
  action: PageEditorContentAction,
): PageContent {
  if (action.type === "replaceContent") {
    return ensureEditablePageContent(action.content);
  }

  if (action.type === "updateChromeSettings") {
    return {
      ...content,
      chrome: { ...pageChromeSettings(content), ...action.settings },
    };
  }

  if (action.type === "addBlock") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => ({
        ...column,
        blocks: [
          ...column.blocks,
          createPageBlockWithVariant(
            action.blockType,
            action.blockId,
            action.variant,
          ),
        ],
      }),
    );
  }

  if (action.type === "addColumn") {
    return {
      ...content,
      sections: content.sections.map((section) => {
        if (section.id !== action.sectionId || section.columns.length >= 4) {
          return section;
        }
        return {
          ...section,
          columns: [...section.columns, createPageColumn(action.columnId)],
        };
      }),
    };
  }

  if (action.type === "addSuggestedBlock") {
    const nextBlock = createPageBlockWithVariant(
      action.blockType,
      action.blockId,
    );
    const firstSection = content.sections[0];
    const firstColumn = firstSection?.columns[0];

    if (!firstSection) {
      return {
        ...content,
        sections: [
          {
            ...createPageSection(action.sectionId, action.columnId),
            columns: [
              {
                ...createPageColumn(action.columnId),
                blocks: [nextBlock],
              },
            ],
          },
        ],
      };
    }

    if (!firstColumn) {
      return {
        ...content,
        sections: content.sections.map((section, index) =>
          index === 0
            ? {
                ...section,
                columns: [
                  {
                    ...createPageColumn(action.columnId),
                    blocks: [nextBlock],
                  },
                ],
              }
            : section,
        ),
      };
    }

    return updateColumn(content, firstSection.id, firstColumn.id, (column) => ({
      ...column,
      blocks: [...column.blocks, nextBlock],
    }));
  }

  if (action.type === "replaceBlock") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === action.blockId ? action.block : block,
        ),
      }),
    );
  }

  if (action.type === "moveSection") {
    const index = content.sections.findIndex(
      (section) => section.id === action.sectionId,
    );
    return {
      ...content,
      sections: moveItem(content.sections, index, action.direction),
    };
  }

  if (action.type === "moveColumn") {
    return updateSection(content, action.sectionId, (section) => {
      const index = section.columns.findIndex(
        (column) => column.id === action.columnId,
      );
      return {
        ...section,
        columns: moveItem(section.columns, index, action.direction),
      };
    });
  }

  if (action.type === "moveBlock") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => {
        const index = column.blocks.findIndex(
          (block) => block.id === action.blockId,
        );
        return {
          ...column,
          blocks: moveItem(column.blocks, index, action.direction),
        };
      },
    );
  }

  if (action.type === "moveBlockToIndex") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => {
        const index = column.blocks.findIndex(
          (block) => block.id === action.blockId,
        );
        return {
          ...column,
          blocks: moveItemToIndex(column.blocks, index, action.targetIndex),
        };
      },
    );
  }

  if (action.type === "duplicateBlock") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => {
        if (column.blocks.length >= 30) return column;
        const index = column.blocks.findIndex(
          (block) => block.id === action.blockId,
        );
        const block = column.blocks[index];
        if (!block) return column;

        const blocks = [...column.blocks];
        blocks.splice(
          index + 1,
          0,
          duplicatePageBlock(block, action.nextBlockId),
        );
        return { ...column, blocks };
      },
    );
  }

  if (action.type === "removeSection") {
    return {
      ...content,
      sections: content.sections.filter(
        (section) => section.id !== action.sectionId,
      ),
    };
  }

  if (action.type === "removeColumn") {
    return updateSection(content, action.sectionId, (section) => ({
      ...section,
      columns: section.columns.filter(
        (column) => column.id !== action.columnId,
      ),
    }));
  }

  if (action.type === "removeBlock") {
    return updateColumn(
      content,
      action.sectionId,
      action.columnId,
      (column) => ({
        ...column,
        blocks: column.blocks.filter((block) => block.id !== action.blockId),
      }),
    );
  }

  if (action.type === "moveSectionToIndex") {
    const index = content.sections.findIndex(
      (section) => section.id === action.sectionId,
    );
    return {
      ...content,
      sections: moveItemToIndex(content.sections, index, action.targetIndex),
    };
  }

  if (action.type === "moveColumnToIndex") {
    return updateSection(content, action.sectionId, (section) => {
      const index = section.columns.findIndex(
        (column) => column.id === action.columnId,
      );
      return {
        ...section,
        columns: moveItemToIndex(section.columns, index, action.targetIndex),
      };
    });
  }

  return content;
}

export type { MoveDirection };
