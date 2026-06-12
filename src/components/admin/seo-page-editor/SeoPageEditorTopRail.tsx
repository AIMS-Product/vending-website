"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  copyRailUrl,
  type CopyMessage,
} from "@/components/admin/seo-page-editor/editor-copy-url";
import { ChevronIcon } from "@/components/admin/seo-page-editor/SeoPageEditorShell";
import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";
import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";
import { pagePathForSlug } from "@/lib/page-builder/page-paths";

// S6: labelled panel toggles with neutral styling (no status-coloured ring).
// These are the only way to open the Blocks / SEO panels on mobile + tablet,
// so they must read as "open this panel", not as ambiguous corner chevrons.
const railPanelToggleClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none";
const railCommandClass =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55";
const railMenuItemClass =
  "rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/25 focus-visible:outline-none";

// S20 / C140 e2e: a page is "just created in-session" when there is no loaded
// page (the editor opened on /admin/pages/new) but a draft row now exists
// (S3b auto-created it, or the first save did). In that case the "Pages"
// back-link carries `?created=<id>` so the list's S9 success banner + row
// highlight fire. Editing an already-loaded page returns to a plain list.
export function backToPagesHref(
  page: { id: string } | null | undefined,
  effectivePageId: string | null | undefined,
): string {
  if (!page?.id && effectivePageId) {
    return `/admin/pages?created=${effectivePageId}`;
  }
  return "/admin/pages";
}

export function SeoPageEditorTopRail({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  const [copyMessage, setCopyMessage] = useState<CopyMessage | null>(null);
  // N19 / I20 item 6: the Share menu is a <details>; it stayed open after a
  // copy and after clicking elsewhere. Close it on select and on outside click.
  const shareMenuRef = useRef<HTMLDetailsElement>(null);
  const closeShareMenu = () => {
    if (shareMenuRef.current) shareMenuRef.current.open = false;
  };
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const menu = shareMenuRef.current;
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false;
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);
  const {
    autosave,
    blockSidebarExpandTitle,
    effectivePageId,
    isBlockSidebarCollapsed,
    isNarrowEditor,
    isPreviewOpening,
    isPublishedPage,
    isSeoSidebarCollapsed,
    openLivePreview,
    page,
    previewLinkMessage,
    previewLinkPath,
    previewLinkTone,
    saveDraftLabel,
    seoSidebarExpandTitle,
    toggleBlockSidebar,
    toggleSeoSidebar,
    routePrefix,
    visibleSlug,
  } = editor;
  const publicPath = visibleSlug
    ? pagePathForSlug(visibleSlug, routePrefix)
    : null;
  const canCopyEditorUrl = Boolean(page?.id);
  const canCopyPublicUrl = Boolean(publicPath);

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
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-center gap-2 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3">
        <div className="order-1 flex flex-wrap justify-center gap-2 sm:order-none sm:justify-start">
          <Link
            href={backToPagesHref(page, effectivePageId)}
            className={railCommandClass}
          >
            <ChevronIcon direction="left" />
            <span>Pages</span>
          </Link>
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
        <div className="order-3 flex flex-col items-center gap-1 sm:order-none">
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
            {(canCopyEditorUrl || canCopyPublicUrl) && (
              <details className="relative" ref={shareMenuRef}>
                <summary
                  className={`${railCommandClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                  title="Copy editor or public page links"
                >
                  Share
                </summary>
                <div className="absolute top-full left-1/2 z-[70] mt-2 grid w-64 -translate-x-1/2 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                  {canCopyEditorUrl && (
                    <button
                      type="button"
                      className={railMenuItemClass}
                      title="Copy this editor page link"
                      onClick={() => {
                        void copyRailUrl(
                          () =>
                            typeof window === "undefined"
                              ? null
                              : window.location.href,
                          "Editor link copied.",
                        ).then(setCopyMessage);
                        closeShareMenu();
                      }}
                    >
                      Copy editor link
                    </button>
                  )}
                  {canCopyPublicUrl && (
                    <button
                      type="button"
                      className={railMenuItemClass}
                      title="Copy the public resource URL for this page"
                      onClick={() => {
                        void copyRailUrl(
                          () =>
                            publicPath && typeof window !== "undefined"
                              ? new URL(
                                  publicPath,
                                  window.location.origin,
                                ).toString()
                              : null,
                          "Public URL copied.",
                        ).then(setCopyMessage);
                        closeShareMenu();
                      }}
                    >
                      Copy public URL
                    </button>
                  )}
                </div>
              </details>
            )}
          </div>
          {autosave?.status === "saved" && (
            <p className="text-xs font-medium text-slate-500">
              Saved automatically · {formatPacificDateTime(autosave.savedAt)}
            </p>
          )}
          {autosave?.status === "error" && (
            <p className="text-xs font-medium text-red-600">
              {autosave.message}
            </p>
          )}
          {previewLinkMessage && (
            <p
              className={`text-xs font-medium ${
                previewLinkTone === "error" ? "text-red-600" : "text-slate-500"
              }`}
            >
              {previewLinkMessage}
            </p>
          )}
          {/* N19 / I20 item 7: tell the user the preview link carries a private
              access token so they understand it is shareable-but-private. */}
          {previewLinkPath && previewLinkTone !== "error" && (
            <p className="text-[11px] text-slate-400">
              This preview link includes a private access token — anyone with it
              can view the draft until the link is revoked.
            </p>
          )}
          {copyMessage && (
            <div
              className={`text-center text-xs font-medium ${
                copyMessage.tone === "error" ? "text-red-600" : "text-slate-500"
              }`}
              role={copyMessage.tone === "error" ? "alert" : "status"}
            >
              <p>{copyMessage.message}</p>
              {copyMessage.manualUrl ? (
                <label className="mt-1 block">
                  <span className="sr-only">Copy this URL manually</span>
                  <input
                    readOnly
                    value={copyMessage.manualUrl}
                    aria-label="Copy this URL manually"
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full max-w-[min(80vw,32rem)] rounded-md border border-red-200 bg-white px-2 py-1 font-mono text-[11px] text-red-700 shadow-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  />
                </label>
              ) : null}
            </div>
          )}
        </div>
        <div className="order-2 flex justify-center sm:order-none sm:justify-end">
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
