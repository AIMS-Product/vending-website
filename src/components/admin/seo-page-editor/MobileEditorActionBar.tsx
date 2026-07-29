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
      className="border-ui-line bg-ui-surface/95 fixed inset-x-0 bottom-0 z-[60] border-t px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.45)] backdrop-blur xl:hidden"
      role="region"
      aria-label="Editor actions"
    >
      {autosave?.status === "saved" && (
        <p className="text-ui-text-subtle mb-1.5 text-center text-xs font-medium">
          Saved automatically · {formatPacificDateTime(autosave.savedAt)}
        </p>
      )}
      {autosave?.status === "error" && (
        <p className="text-ui-bad mb-1.5 text-center text-xs font-medium">
          {autosave.message}
        </p>
      )}
      <div className="mx-auto flex max-w-[1500px] items-center justify-center gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          className="border-ui-line text-ui-text-muted hover:border-ui-line-strong hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 rounded-ui bg-ui-surface shadow-ui inline-flex min-h-11 flex-1 items-center justify-center border px-5 text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none"
        >
          {saveDraftLabel}
        </button>
        <button
          type="button"
          className="border-ui-accent/20 bg-ui-accent hover:bg-ui-accent-hover focus-visible:ring-ui-accent/20 rounded-ui shadow-ui inline-flex min-h-11 flex-1 items-center justify-center border px-5 text-sm font-semibold text-white transition focus-visible:ring-4 focus-visible:outline-none"
          aria-expanded={bar.seoPanelOpen}
          onClick={toggleSeoSidebar}
        >
          {bar.seoButtonLabel}
        </button>
      </div>
    </div>
  );
}
