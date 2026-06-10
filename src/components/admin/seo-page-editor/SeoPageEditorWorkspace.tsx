"use client";

import { BuilderEditorWalkthrough } from "@/components/admin/seo-page-editor/BuilderEditorWalkthrough";
import { AiBuilderAssistant } from "@/components/admin/seo-page-editor/AiBuilderAssistant";
import { BlockSettingsModal } from "@/components/admin/seo-page-editor/BlockSettingsModal";
import { BuilderBlocksPanel } from "@/components/admin/seo-page-editor/BuilderBlocksPanel";
import { SeoEditorManualSubmitToast } from "@/components/admin/seo-page-editor/SeoEditorManualSubmitToast";
import { MobileEditorActionBar } from "@/components/admin/seo-page-editor/MobileEditorActionBar";
import { SeoPageEditorCanvasPanel } from "@/components/admin/seo-page-editor/SeoPageEditorCanvasPanel";
import { SeoPageEditorHiddenFields } from "@/components/admin/seo-page-editor/SeoPageEditorHiddenFields";
import { SeoPageEditorTopRail } from "@/components/admin/seo-page-editor/SeoPageEditorTopRail";
import { SeoPublishPanel } from "@/components/admin/seo-page-editor/SeoPublishPanel";
import { useEditorKeyboardShortcuts } from "@/components/admin/seo-page-editor/useEditorKeyboardShortcuts";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

export function SeoPageEditorWorkspace({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  useEditorKeyboardShortcuts(editor);

  return (
    <>
      <SeoEditorManualSubmitToast toast={editor.manualSubmitToast} />
      {editor.effectivePageId && (
        <input type="hidden" name="id" value={editor.effectivePageId} />
      )}
      <input
        type="hidden"
        name="draftContent"
        value={editor.draftContentJson}
      />
      {editor.isSeoSidebarCollapsed && (
        <>
          <input type="hidden" name="slug" value={editor.visibleSlug} />
          <input type="hidden" name="routePrefix" value={editor.routePrefix} />
        </>
      )}

      <div className="relative min-h-[calc(100dvh-4rem)] overflow-x-hidden border border-slate-200 bg-slate-100 lg:min-h-screen">
        <SeoPageEditorTopRail editor={editor} />
        {editor.isNarrowEditor &&
          (!editor.isBlockSidebarCollapsed ||
            !editor.isSeoSidebarCollapsed) && (
            <button
              type="button"
              aria-label="Close editor side panel"
              className="fixed inset-x-0 top-28 bottom-0 z-[55] bg-slate-950/20 xl:hidden"
              onClick={() => editor.setMobileEditorPanel(null)}
            />
          )}
        {/* Bottom padding clears the fixed MobileEditorActionBar on narrow
            widths so it never covers the last panel content; desktop is
            unchanged (xl:pb-0). */}
        <div className="pb-24 xl:pb-0">
          <div className={editor.builderShellGridClass}>
            {!editor.isBlockSidebarCollapsed && (
              <BuilderBlocksPanel editor={editor} />
            )}
            <SeoPageEditorCanvasPanel editor={editor} />
            {!editor.isSeoSidebarCollapsed && (
              <SeoPublishPanel editor={editor} />
            )}
          </div>
        </div>
      </div>

      <MobileEditorActionBar editor={editor} />

      <BuilderEditorWalkthrough editor={editor} />
      <AiBuilderAssistant editor={editor} />

      {editor.editingBlockEntry && (
        <BlockSettingsModal
          entry={editor.editingBlockEntry}
          onClose={editor.closeBlockSettings}
          onChange={(next) =>
            editor.replaceBlock(
              editor.editingBlockEntry!.sectionId,
              editor.editingBlockEntry!.columnId,
              editor.editingBlockEntry!.block.id,
              next,
            )
          }
        />
      )}
      <SeoPageEditorHiddenFields editor={editor} />
    </>
  );
}
