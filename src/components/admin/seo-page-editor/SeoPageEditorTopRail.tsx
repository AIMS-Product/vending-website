"use client";

import { ChevronIcon } from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

// S6: labelled panel toggles with neutral styling (no status-coloured ring).
// These are the only way to open the Blocks / SEO panels on mobile + tablet,
// so they must read as "open this panel", not as ambiguous corner chevrons.
const railPanelToggleClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none";

// S8: format the autosave timestamp for the top-rail "Saved automatically" hint.
function formatRailTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SeoPageEditorTopRail({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const {
    autosave,
    blockSidebarExpandTitle,
    isBlockSidebarCollapsed,
    isNarrowEditor,
    isPreviewOpening,
    isPublishedPage,
    isSeoSidebarCollapsed,
    openLivePreview,
    page,
    previewLinkMessage,
    previewLinkPath,
    saveDraftLabel,
    seoSidebarExpandTitle,
    toggleBlockSidebar,
    toggleSeoSidebar,
  } = editor;

  const blockToggleLabel = isNarrowEditor
    ? isBlockSidebarCollapsed
      ? blockSidebarExpandTitle
      : "Close blocks panel"
    : isBlockSidebarCollapsed
      ? "Expand blocks sidebar"
      : "Collapse blocks sidebar";
  const seoToggleLabel = isNarrowEditor
    ? isSeoSidebarCollapsed
      ? seoSidebarExpandTitle
      : "Close SEO panel"
    : isSeoSidebarCollapsed
      ? "Expand SEO sidebar"
      : "Collapse SEO sidebar";

  return (
    <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-100/95 px-4 pt-4 pb-3 backdrop-blur">
      <div className="mx-auto grid max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex justify-start">
          <button
            type="button"
            className={railPanelToggleClass}
            aria-label={blockToggleLabel}
            aria-expanded={!isBlockSidebarCollapsed}
            title={blockToggleLabel}
            onClick={toggleBlockSidebar}
          >
            <ChevronIcon
              direction={isBlockSidebarCollapsed ? "right" : "left"}
            />
            <span>Blocks</span>
          </button>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
              title={
                isPublishedPage
                  ? "Save unpublished edits while keeping the current live page published."
                  : "Save this page as a draft"
              }
            >
              {saveDraftLabel}
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isPreviewOpening}
              title={
                page?.id
                  ? "Open a live draft preview in a new tab"
                  : "Save this draft, then open a live preview"
              }
              onClick={openLivePreview}
            >
              {isPreviewOpening
                ? page?.id
                  ? "Opening preview..."
                  : "Saving preview..."
                : page?.id
                  ? "Live preview"
                  : "Save & preview"}
            </button>
            {previewLinkPath && (
              <a
                href={previewLinkPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0b63f6]/20 bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0756d6] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
              >
                Open preview
              </a>
            )}
          </div>
          {autosave?.status === "saved" && (
            <p className="text-xs font-medium text-slate-500">
              Saved automatically · {formatRailTime(autosave.savedAt)}
            </p>
          )}
          {autosave?.status === "error" && (
            <p className="text-xs font-medium text-red-600">
              {autosave.message}
            </p>
          )}
          {previewLinkMessage && (
            <p className="text-xs font-medium text-slate-500">
              {previewLinkMessage}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className={railPanelToggleClass}
            aria-label={seoToggleLabel}
            aria-expanded={!isSeoSidebarCollapsed}
            title={seoToggleLabel}
            onClick={toggleSeoSidebar}
          >
            <span>SEO</span>
            <ChevronIcon direction={isSeoSidebarCollapsed ? "left" : "right"} />
          </button>
        </div>
      </div>
    </div>
  );
}
