"use client";

import {
  SimpleBlockStackEditor,
  SortableSectionEditor,
} from "@/components/admin/seo-page-editor/SeoPageEditorCanvas";
import {
  EditorPublicFooter,
  EditorPublicHeader,
} from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import {
  editorCanvasDividerClass,
  formatTime,
} from "@/components/admin/seo-page-editor/editor-utils";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

export function SeoPageEditorCanvasPanel({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const {
    addBlock,
    blockOrdinalById,
    chromeSettings,
    duplicateBlock,
    moveBlock,
    moveBlockToIndex,
    primaryColumn,
    primarySection,
    removeBlock,
    replaceBlock,
    setEditingBlockId,
    setSelectedBlockId,
    usesSimpleBlockStack,
  } = editor;

  return (
    <div className="order-1 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100 shadow-sm xl:order-none xl:h-[calc(100dvh-7rem)]">
      <EditorStatusBar editor={editor} />

      <div className="mx-auto max-w-[1500px] bg-[#f5fbff] shadow-sm">
        {chromeSettings.showHeader ? <EditorPublicHeader /> : null}
        <article className="bg-[#f5fbff]">
          <div className="group/page-body relative mx-auto max-w-5xl px-5 py-14 lg:px-10">
            {usesSimpleBlockStack && primarySection && primaryColumn ? (
              <SimpleBlockStackEditor
                column={primaryColumn}
                blockOrdinalById={blockOrdinalById}
                onAddBlock={(type, variant) =>
                  addBlock(primarySection.id, primaryColumn.id, type, variant)
                }
                onBlockChange={(blockId, next) =>
                  replaceBlock(
                    primarySection.id,
                    primaryColumn.id,
                    blockId,
                    next,
                  )
                }
                onBlockMove={(blockId, direction) =>
                  moveBlock(
                    primarySection.id,
                    primaryColumn.id,
                    blockId,
                    direction,
                  )
                }
                onBlockMoveToIndex={(blockId, targetIndex) =>
                  moveBlockToIndex(
                    primarySection.id,
                    primaryColumn.id,
                    blockId,
                    targetIndex,
                  )
                }
                onBlockDuplicate={(blockId) =>
                  duplicateBlock(primarySection.id, primaryColumn.id, blockId)
                }
                onBlockRemove={(blockId) =>
                  removeBlock(primarySection.id, primaryColumn.id, blockId)
                }
                onSelectBlock={setSelectedBlockId}
                onEditBlockSettings={(blockId) => {
                  setSelectedBlockId(blockId);
                  setEditingBlockId(blockId);
                }}
              />
            ) : (
              <StructuredSectionEditor editor={editor} />
            )}
          </div>
        </article>
        {chromeSettings.showFooter ? <EditorPublicFooter /> : null}
      </div>
    </div>
  );
}

function EditorStatusBar({ editor }: { editor: SeoPageEditorController }) {
  const { autosave, redirectError, saveMessage, savedFromRedirect, state } =
    editor;
  const hasStatus =
    state.status !== "idle" || savedFromRedirect || redirectError || autosave;

  if (!hasStatus) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
        {(state.status !== "idle" || savedFromRedirect || redirectError) && (
          <p
            className={
              state.status === "error" || redirectError
                ? "text-red-700"
                : "text-emerald-700"
            }
          >
            {saveMessage}
          </p>
        )}
        {autosave && (
          <p
            className={
              autosave.status === "error" ? "text-red-700" : "text-slate-500"
            }
          >
            {autosave.status === "saved"
              ? `Autosaved ${formatTime(autosave.savedAt)}`
              : autosave.message}
          </p>
        )}
      </div>
    </div>
  );
}

function StructuredSectionEditor({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const {
    addBlock,
    addColumn,
    addSuggestedBlock,
    blockOrdinalById,
    content,
    duplicateBlock,
    moveBlock,
    moveBlockToIndex,
    moveColumn,
    moveColumnToIndex,
    moveSection,
    moveSectionToIndex,
    removeBlock,
    removeColumn,
    removeSection,
    replaceBlock,
    setEditingBlockId,
    setSelectedBlockId,
  } = editor;

  if (content.sections.length === 0) {
    return (
      <BlankCanvasState onAddContent={() => addSuggestedBlock("rich_text")} />
    );
  }

  return (
    <div>
      {content.sections.map((section, index) => (
        <div
          key={section.id}
          className={editorCanvasDividerClass(index > 0, 14)}
        >
          <SortableSectionEditor
            section={section}
            sectionIndex={index}
            sectionCount={content.sections.length}
            blockOrdinalById={blockOrdinalById}
            onSectionMove={(direction) => moveSection(section.id, direction)}
            onSectionMoveToIndex={(targetIndex) =>
              moveSectionToIndex(section.id, targetIndex)
            }
            onSectionRemove={() => removeSection(section.id)}
            onAddColumn={() => addColumn(section.id)}
            onColumnMove={(columnId, direction) =>
              moveColumn(section.id, columnId, direction)
            }
            onColumnMoveToIndex={(columnId, targetIndex) =>
              moveColumnToIndex(section.id, columnId, targetIndex)
            }
            onColumnRemove={(columnId) => removeColumn(section.id, columnId)}
            onAddBlock={(columnId, type, variant) =>
              addBlock(section.id, columnId, type, variant)
            }
            onBlockChange={(columnId, blockId, next) =>
              replaceBlock(section.id, columnId, blockId, next)
            }
            onBlockMove={(columnId, blockId, direction) =>
              moveBlock(section.id, columnId, blockId, direction)
            }
            onBlockMoveToIndex={(columnId, blockId, targetIndex) =>
              moveBlockToIndex(section.id, columnId, blockId, targetIndex)
            }
            onBlockDuplicate={(columnId, blockId) =>
              duplicateBlock(section.id, columnId, blockId)
            }
            onBlockRemove={(columnId, blockId) =>
              removeBlock(section.id, columnId, blockId)
            }
            onSelectBlock={setSelectedBlockId}
            onEditBlockSettings={(blockId) => {
              setSelectedBlockId(blockId);
              setEditingBlockId(blockId);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function BlankCanvasState({ onAddContent }: { onAddContent: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center transition-colors hover:border-slate-300 hover:bg-slate-50">
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
      <h3 className="text-sm font-semibold text-slate-900">Blank page body</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Add content to start writing this page.
      </p>
      <button
        type="button"
        onClick={onAddContent}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
      >
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
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        Add page content
      </button>
    </div>
  );
}
