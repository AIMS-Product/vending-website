"use client";

import {
  resourceColumnGridClass,
  resourceSectionClass,
} from "@/components/sections/resource-page-content-classes";
import {
  type PageBlock,
  type PageColumn,
  type PageSection,
} from "@/lib/page-builder/blocks";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import type { MoveDirection } from "@/lib/page-builder/editor-state";
import {
  BuilderTooltip,
  MoreActions,
  MovePositionMenu,
} from "@/components/admin/seo-page-editor/BuilderEditorUi";
import { BlockPicker } from "@/components/admin/seo-page-editor/BlockPicker";
import { BlockEditor } from "@/components/admin/seo-page-editor/BlockInlineEditor";
import {
  dangerButtonClass,
  smallButtonClass,
} from "@/components/admin/seo-page-editor/editor-styles";
import { editorCanvasDividerClass } from "@/components/admin/seo-page-editor/editor-utils";

export function SortableSectionEditor({
  section,
  sectionIndex,
  sectionCount,
  blockOrdinalById,
  onSectionMove,
  onSectionMoveToIndex,
  onSectionRemove,
  onAddColumn,
  onColumnMove,
  onColumnMoveToIndex,
  onColumnRemove,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockMoveToIndex,
  onBlockDuplicate,
  onBlockRemove,
  onSelectBlock,
  onEditBlockSettings,
}: {
  section: PageSection;
  sectionIndex: number;
  sectionCount: number;
  blockOrdinalById: Map<string, number>;
  onSectionMove: (direction: MoveDirection) => void;
  onSectionMoveToIndex: (targetIndex: number) => void;
  onSectionRemove: () => void;
  onAddColumn: () => void;
  onColumnMove: (columnId: string, direction: MoveDirection) => void;
  onColumnMoveToIndex: (columnId: string, targetIndex: number) => void;
  onColumnRemove: (columnId: string) => void;
  onAddBlock: (
    columnId: string,
    type: PageBlock["type"],
    variant?: BlockVariant,
  ) => void;
  onBlockChange: (columnId: string, blockId: string, next: PageBlock) => void;
  onBlockMove: (
    columnId: string,
    blockId: string,
    direction: MoveDirection,
  ) => void;
  onBlockMoveToIndex: (
    columnId: string,
    blockId: string,
    targetIndex: number,
  ) => void;
  onBlockDuplicate: (columnId: string, blockId: string) => void;
  onBlockRemove: (columnId: string, blockId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onEditBlockSettings: (blockId: string) => void;
}) {
  return (
    <section
      className={`group/section relative rounded-[12px] border border-transparent transition-all ${editorSectionClass(
        section.background,
        section.spacing,
      )} hover:border-slate-300`}
    >
      <header className="absolute -top-5 right-3 left-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-2 opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100">
        <div className="flex items-center gap-3">
          <BuilderTooltip
            label={`Page section ${sectionIndex + 1}`}
            detail={`This section contains ${section.columns.length} ${
              section.columns.length === 1 ? "column" : "columns"
            }`}
          >
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                Page section {sectionIndex + 1}
              </h3>
              <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 ring-inset">
                {section.columns.length}{" "}
                {section.columns.length === 1 ? "column" : "columns"}
              </span>
            </div>
          </BuilderTooltip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <MovePositionMenu
              label={`Page section ${sectionIndex + 1}`}
              currentIndex={sectionIndex}
              itemCount={sectionCount}
              onMove={onSectionMove}
              onMoveToIndex={onSectionMoveToIndex}
              upLabel="Move up one"
              downLabel="Move down one"
              align="end"
            />
          </div>
          <BuilderTooltip
            label="Add column"
            detail={
              section.columns.length >= 4
                ? "Each section supports up to 4 columns"
                : `Add another content column to page section ${sectionIndex + 1}`
            }
          >
            <button
              type="button"
              className={`${smallButtonClass} inline-flex items-center gap-2`}
              disabled={section.columns.length >= 4}
              onClick={onAddColumn}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
              Add column
            </button>
          </BuilderTooltip>
          <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <MoreActions
              label="Section actions"
              detail="Remove this page section"
              align="end"
            >
              <button
                type="button"
                className={dangerButtonClass}
                onClick={onSectionRemove}
              >
                Remove page section
              </button>
            </MoreActions>
          </div>
        </div>
      </header>

      <div className={columnGridClass(section.columns.length)}>
        {section.columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center transition-colors hover:border-slate-400 hover:bg-slate-50">
            <div className="mb-3 rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-slate-900">No columns</h4>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Add a column before adding page content.
            </p>
            <button
              type="button"
              onClick={onAddColumn}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add column
            </button>
          </div>
        ) : (
          section.columns.map((column, columnIndex) => (
            <SortableColumnEditor
              key={column.id}
              column={column}
              columnIndex={columnIndex}
              columnCount={section.columns.length}
              blockOrdinalById={blockOrdinalById}
              onColumnMove={(direction) => onColumnMove(column.id, direction)}
              onColumnMoveToIndex={(targetIndex) =>
                onColumnMoveToIndex(column.id, targetIndex)
              }
              onColumnRemove={() => onColumnRemove(column.id)}
              onAddBlock={(type, variant) =>
                onAddBlock(column.id, type, variant)
              }
              onBlockChange={(blockId, next) =>
                onBlockChange(column.id, blockId, next)
              }
              onBlockMove={(blockId, direction) =>
                onBlockMove(column.id, blockId, direction)
              }
              onBlockMoveToIndex={(blockId, targetIndex) =>
                onBlockMoveToIndex(column.id, blockId, targetIndex)
              }
              onBlockDuplicate={(blockId) =>
                onBlockDuplicate(column.id, blockId)
              }
              onBlockRemove={(blockId) => onBlockRemove(column.id, blockId)}
              onSelectBlock={onSelectBlock}
              onEditBlockSettings={onEditBlockSettings}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function SimpleBlockStackEditor({
  column,
  blockOrdinalById,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockMoveToIndex,
  onBlockDuplicate,
  onBlockRemove,
  onSelectBlock,
  onEditBlockSettings,
}: {
  column: PageColumn;
  blockOrdinalById: Map<string, number>;
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
  onBlockChange: (blockId: string, next: PageBlock) => void;
  onBlockMove: (blockId: string, direction: MoveDirection) => void;
  onBlockMoveToIndex: (blockId: string, targetIndex: number) => void;
  onBlockDuplicate: (blockId: string) => void;
  onBlockRemove: (blockId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onEditBlockSettings: (blockId: string) => void;
}) {
  return (
    <div>
      {column.blocks.length === 0 ? (
        <div
          id="builder-canvas-add-block"
          className="flex scroll-mt-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="mb-4 rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Start building this page
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Add your first block below: a hero or text section to introduce the
            page. A CTA or lead-form block is required before you can publish.
          </p>
          <div className="mt-6 w-full max-w-md text-left">
            <BlockPicker onAddBlock={onAddBlock} />
          </div>
        </div>
      ) : (
        <>
          {column.blocks.map((block, blockIndex) => (
            <div
              key={block.id}
              className={editorCanvasDividerClass(blockIndex > 0, 14)}
              onFocusCapture={() => onSelectBlock(block.id)}
              onPointerDownCapture={() => onSelectBlock(block.id)}
            >
              <BlockEditor
                block={block}
                blockIndex={blockIndex}
                blockNumber={(blockOrdinalById.get(block.id) ?? blockIndex) + 1}
                blockCount={column.blocks.length}
                onChange={(next) => onBlockChange(block.id, next)}
                onMove={(direction) => onBlockMove(block.id, direction)}
                onMoveToIndex={(targetIndex) =>
                  onBlockMoveToIndex(block.id, targetIndex)
                }
                onDuplicate={() => onBlockDuplicate(block.id)}
                onRemove={() => onBlockRemove(block.id)}
                onEditSettings={() => onEditBlockSettings(block.id)}
              />
            </div>
          ))}
          <div className="pt-14">
            <BlockPicker onAddBlock={onAddBlock} />
          </div>
        </>
      )}
    </div>
  );
}

function SortableColumnEditor({
  column,
  columnIndex,
  columnCount,
  blockOrdinalById,
  onColumnMove,
  onColumnMoveToIndex,
  onColumnRemove,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockMoveToIndex,
  onBlockDuplicate,
  onBlockRemove,
  onSelectBlock,
  onEditBlockSettings,
}: {
  column: PageColumn;
  columnIndex: number;
  columnCount: number;
  blockOrdinalById: Map<string, number>;
  onColumnMove: (direction: MoveDirection) => void;
  onColumnMoveToIndex: (targetIndex: number) => void;
  onColumnRemove: () => void;
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
  onBlockChange: (blockId: string, next: PageBlock) => void;
  onBlockMove: (blockId: string, direction: MoveDirection) => void;
  onBlockMoveToIndex: (blockId: string, targetIndex: number) => void;
  onBlockDuplicate: (blockId: string) => void;
  onBlockRemove: (blockId: string) => void;
  onSelectBlock: (blockId: string) => void;
  onEditBlockSettings: (blockId: string) => void;
}) {
  return (
    <div className="group/column relative flex flex-col rounded-[12px] border border-dashed border-transparent bg-transparent transition-all hover:border-slate-300 hover:bg-white/50">
      <header className="absolute -top-5 right-2 left-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 opacity-0 shadow-sm ring-1 ring-black/5 transition-opacity group-focus-within/column:opacity-100 group-hover/column:opacity-100">
        <div className="flex items-center gap-2">
          <BuilderTooltip
            label={`Column ${columnIndex + 1}`}
            detail={`Content column ${columnIndex + 1} in this page section`}
          >
            <h4 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Column {columnIndex + 1}
            </h4>
          </BuilderTooltip>
        </div>
        <div className="flex items-center gap-1">
          <div className="rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
            <MovePositionMenu
              label={`Column ${columnIndex + 1}`}
              currentIndex={columnIndex}
              itemCount={columnCount}
              onMove={onColumnMove}
              onMoveToIndex={onColumnMoveToIndex}
              upLabel="Move left one"
              downLabel="Move right one"
              align="end"
            />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
            <MoreActions
              label="Column actions"
              detail="Remove this column from the section"
              align="end"
            >
              <button
                type="button"
                className={dangerButtonClass}
                onClick={onColumnRemove}
              >
                Remove column
              </button>
            </MoreActions>
          </div>
        </div>
      </header>

      <div className="flex-1">
        <div>
          {column.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
              <div className="mb-3 rounded-full bg-white p-2 shadow-sm ring-1 ring-slate-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                Empty column
              </p>
              <p className="mt-1 mb-4 text-xs text-slate-500">
                Add page content below
              </p>
              <div className="w-full text-left">
                <BlockPicker onAddBlock={onAddBlock} />
              </div>
            </div>
          ) : (
            <>
              {column.blocks.map((block, blockIndex) => (
                <div
                  key={block.id}
                  className={editorCanvasDividerClass(blockIndex > 0, 10)}
                  onFocusCapture={() => onSelectBlock(block.id)}
                  onPointerDownCapture={() => onSelectBlock(block.id)}
                >
                  <BlockEditor
                    block={block}
                    blockIndex={blockIndex}
                    blockNumber={
                      (blockOrdinalById.get(block.id) ?? blockIndex) + 1
                    }
                    blockCount={column.blocks.length}
                    onChange={(next) => onBlockChange(block.id, next)}
                    onMove={(direction) => onBlockMove(block.id, direction)}
                    onMoveToIndex={(targetIndex) =>
                      onBlockMoveToIndex(block.id, targetIndex)
                    }
                    onDuplicate={() => onBlockDuplicate(block.id)}
                    onRemove={() => onBlockRemove(block.id)}
                    onEditSettings={() => onEditBlockSettings(block.id)}
                  />
                </div>
              ))}
              <div className="pt-10">
                <BlockPicker onAddBlock={onAddBlock} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function editorSectionClass(
  background: PageSection["background"],
  spacing: PageSection["spacing"],
) {
  return resourceSectionClass(background, spacing);
}

function columnGridClass(count: number) {
  return resourceColumnGridClass(count);
}
