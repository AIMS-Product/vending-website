"use client";

import Link from "next/link";
import {
  BuilderBlockSidebar,
  ChevronIcon,
  PageChromeControls,
} from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

function openCanvasPicker() {
  document
    .querySelector<HTMLButtonElement>("#builder-canvas-add-block button")
    ?.click();
}

export function BuilderBlocksPanel({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const {
    addBlock,
    builderBlockEntries,
    chromeSettings,
    editBlockEntry,
    moveBlock,
    qualificationSettings,
    selectedBlockEntry,
    selectBlockEntry,
    updateChromeSettings,
    updateQualificationSettings,
  } = editor;

  return (
    <section
      aria-labelledby="builder-blocks-panel-title"
      data-builder-walkthrough="blocks"
      className="border-ui-line rounded-ui-lg bg-ui-surface shadow-ui-raised fixed top-32 bottom-4 left-4 z-[60] order-2 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden border xl:sticky xl:top-4 xl:bottom-auto xl:left-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none"
    >
      <div className="border-ui-line flex shrink-0 items-start border-b px-5 py-4">
        <div>
          <p className="text-ui-text-subtle text-xs font-semibold tracking-wider uppercase">
            Blocks
          </p>
          <h2
            id="builder-blocks-panel-title"
            className="text-ui-text mt-1 text-base font-semibold"
          >
            Page structure
          </h2>
          <p className="text-ui-text-subtle mt-1 text-xs font-medium">
            {builderBlockEntries.length}{" "}
            {builderBlockEntries.length === 1 ? "block" : "blocks"}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <BuilderBlockSidebar
          entries={builderBlockEntries}
          selectedEntry={selectedBlockEntry}
          onSelectBlock={selectBlockEntry}
          onEditBlock={editBlockEntry}
          onCreateBlock={openCanvasPicker}
          onCreateBlockAfter={(entry, type, variant) =>
            addBlock(
              entry.sectionId,
              entry.columnId,
              type,
              variant,
              entry.blockIndex + 1,
            )
          }
          onMoveBlock={(entry, direction) =>
            moveBlock(
              entry.sectionId,
              entry.columnId,
              entry.block.id,
              direction,
            )
          }
        />
      </div>
      <div className="border-ui-line shrink-0 border-t px-4 py-3">
        <PageChromeControls
          settings={chromeSettings}
          onChange={updateChromeSettings}
          qualificationSettings={qualificationSettings}
          onQualificationChange={updateQualificationSettings}
        />
      </div>
      <div className="border-ui-line shrink-0 border-t p-4">
        <Link
          href="/admin/pages"
          className="border-ui-line text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 rounded-ui-lg bg-ui-surface shadow-ui inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none"
        >
          <ChevronIcon direction="left" />
          Go back to dashboard
        </Link>
      </div>
    </section>
  );
}
