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
    selectedBlockEntry,
    selectBlockEntry,
    updateChromeSettings,
  } = editor;

  return (
    <section
      aria-labelledby="builder-blocks-panel-title"
      className="fixed top-32 bottom-4 left-4 z-[60] order-2 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:bottom-auto xl:left-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none"
    >
      <div className="flex shrink-0 items-start border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Blocks
          </p>
          <h2
            id="builder-blocks-panel-title"
            className="mt-1 text-base font-semibold text-slate-950"
          >
            Page structure
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
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
        />
      </div>
      <div className="shrink-0 border-t border-slate-200 px-4 py-3">
        <PageChromeControls
          settings={chromeSettings}
          onChange={updateChromeSettings}
        />
      </div>
      <div className="shrink-0 border-t border-slate-200 p-4">
        <Link
          href="/admin/pages"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
        >
          <ChevronIcon direction="left" />
          Go back to dashboard
        </Link>
      </div>
    </section>
  );
}
