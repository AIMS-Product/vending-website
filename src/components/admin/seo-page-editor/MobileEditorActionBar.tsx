"use client";

import { getMobileActionBarState } from "@/components/admin/seo-page-editor/editor-responsive";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";
import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";

// I10 / N11: a viewport-fixed action bar for narrow widths. The editor's
// sticky top rail is trapped inside an `overflow-x-hidden` ancestor (which the
// CSS spec promotes to `overflow: auto`), so `position: sticky` sticks to that
// scroll container rather than the viewport and scrolls away on mobile. A
// `position: fixed` bar escapes that trap and keeps Save + the SEO/publish
// entry reachable without scrolling. Hidden on desktop (`xl:hidden`), so the
// top-rail layout is unchanged there.

export function MobileEditorActionBar({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const {
    autosave,
    isNarrowEditor,
    isSeoSidebarCollapsed,
    saveDraftLabel,
    toggleSeoSidebar,
  } = editor;

  const bar = getMobileActionBarState({
    isNarrowEditor,
    isSeoSidebarCollapsed,
  });
  if (!bar.visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.45)] backdrop-blur xl:hidden"
      role="region"
      aria-label="Editor actions"
    >
      {autosave?.status === "saved" && (
        <p className="mb-1.5 text-center text-xs font-medium text-slate-500">
          Saved automatically · {formatPacificDateTime(autosave.savedAt)}
        </p>
      )}
      {autosave?.status === "error" && (
        <p className="mb-1.5 text-center text-xs font-medium text-red-600">
          {autosave.message}
        </p>
      )}
      <div className="mx-auto flex max-w-[1500px] items-center justify-center gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
        >
          {saveDraftLabel}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[#0b63f6]/20 bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
          aria-expanded={bar.seoPanelOpen}
          onClick={toggleSeoSidebar}
        >
          {bar.seoButtonLabel}
        </button>
      </div>
    </div>
  );
}
