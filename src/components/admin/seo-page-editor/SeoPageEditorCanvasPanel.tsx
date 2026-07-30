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
    <div className="border-ui-line bg-ui-line rounded-ui-lg shadow-ui order-1 min-w-0 overflow-y-auto border xl:order-none xl:h-[calc(100dvh-7rem)]">
      <EditorStatusBar editor={editor} />

      {/* N19 / I20 item 9: orient the user that the canvas mirrors the public
          page (the header/footer chrome below is an inert preview, de-tabbed in
          N17) so the rendered site chrome is not mistaken for editable admin UI. */}
      <p className="bg-ui-line text-ui-text-muted px-4 pt-3 text-center text-[11px] font-medium tracking-wide uppercase">
        Preview of the public page — edit the content blocks below
      </p>

      <div className="shadow-ui mx-auto max-w-[1500px] bg-[#f5fbff]">
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
    <div className="border-ui-line bg-ui-surface/90 shadow-ui sticky top-0 z-30 border-b px-5 py-3 text-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
        {(state.status !== "idle" || savedFromRedirect || redirectError) && (
          <p
            className={
              state.status === "error" || redirectError
                ? "text-ui-bad-ink"
                : "text-ui-ok-ink"
            }
          >
            {saveMessage}
          </p>
        )}
        {autosave && (
          <p
            className={
              autosave.status === "error"
                ? "text-ui-bad-ink"
                : "text-ui-text-subtle"
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
    <div className="border-ui-line bg-ui-canvas/50 hover:border-ui-line-strong hover:bg-ui-canvas rounded-ui-lg flex flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition-colors">
      <div className="bg-ui-surface shadow-ui ring-ui-line mb-4 rounded-full p-3 ring-1">
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
          className="text-ui-text-subtle"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      </div>
      <h3 className="text-ui-text text-sm font-semibold">Blank page body</h3>
      <p className="text-ui-text-subtle mt-1 max-w-sm text-sm">
        Add content to start writing this page.
      </p>
      <button
        type="button"
        onClick={onAddContent}
        className="text-ui-text-muted hover:bg-ui-canvas rounded-ui bg-ui-surface shadow-ui ring-ui-line-strong mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ring-1 ring-inset"
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
