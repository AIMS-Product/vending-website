"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent, ReactNode, TextareaHTMLAttributes } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/site/Wordmark";
import {
  resourceColumnGridClass,
  resourceSectionClass,
} from "@/components/sections/resource-page-content-classes";
import { BlockVariantPreviewSkeleton } from "@/components/admin/SeoPageBlockVariantPreview";
import {
  acceptAiSeoProposalBlocks,
  autosaveSeoPageDraft,
  createSeoPagePreviewLink,
  generateAiSeoPageProposal,
  saveSeoPageDraftAndCreatePreviewLink,
  saveSeoPage,
  type PageAiProposalInsertResult,
  type PageAiProposalResult,
  type PageAutosaveResult,
  type PageEditorActionState,
} from "@/app/admin/pages/actions";
import type { AiPageProposalReview } from "@/lib/services/ai-page-proposals";
import {
  CARD_GRID_MAX_CARDS,
  FAQ_MAX_ITEMS,
  createEmptyPageContent,
  pageContentSchema,
  pageChromeSettings,
  richTextDocumentPlainText,
  type PageChromeSettings,
  type PageBlock,
  type PageColumn,
  type PageContent,
  type PageSection,
} from "@/lib/page-builder/blocks";
import {
  assessSeoReadiness,
  type SeoReadinessFinding,
  type SeoReadinessStatus,
  type SeoReadinessSummary,
} from "@/lib/page-builder/seo-readiness";
import {
  applyInternalLinkSuggestion,
  suggestInternalLinks,
  type InternalLinkSuggestion,
  type InternalLinkSuggestionTarget,
} from "@/lib/page-builder/internal-link-suggestions";
import {
  createPageBlock,
  createPageColumn,
  createPageSection,
  duplicatePageBlock,
  ensureEditablePageContent,
  moveItem,
  moveItemToIndex,
  type MoveDirection,
} from "@/lib/page-builder/content-ops";
import {
  blockPickerOptions,
  type BlockVariant,
} from "@/lib/page-builder/block-options";
import {
  blockCanvasPlaceholders,
  richTextBodyPlaceholder,
} from "@/lib/page-builder/block-editor-placeholders";
import {
  isBlockFieldVisible,
  optionalBlockFieldLabels,
  setBlockFieldVisibility,
  withDefaultFieldVisibility,
  type OptionalBlockFieldKey,
} from "@/lib/page-builder/block-field-visibility";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import {
  MediaDropTarget,
  MediaLibrarySelectButton,
  MediaPickerProvider,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import type { Tables } from "@/types/database";
import { footerColumns, primaryNav } from "@/lib/content/nav";

type SeoPage = Tables<"seo_pages">;

export type SeoPageEditorMediaAsset = EditorMediaAsset;

type SeoPageEditorFormProps = {
  page?: SeoPage;
  internalLinkTargets?: InternalLinkSuggestionTarget[];
  mediaAssets?: SeoPageEditorMediaAsset[];
  aiProposals?: AiPageProposalReview[];
  savedFromRedirect?: boolean;
  redirectError?: string;
};

type BuilderBlockEntry = {
  sectionId: string;
  columnId: string;
  block: PageBlock;
  blockNumber: number;
  sectionNumber: number;
  columnNumber: number;
};
type MobileEditorPanel = "blocks" | "seo" | null;
type ManualSubmitIntent = "save" | "publish";
type EditorDraftSettings = {
  slug: string;
  title: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
};

const initialState: PageEditorActionState = { status: "idle" };
const initialAiProposalState: PageAiProposalResult = { status: "idle" };
const initialAiInsertState: PageAiProposalInsertResult = { status: "idle" };
const previewSessionStorageKey = "seo-page-builder-preview-link";
const emptyInternalLinkTargets: InternalLinkSuggestionTarget[] = [];
const emptyMediaAssets: SeoPageEditorMediaAsset[] = [];
const emptyAiProposals: AiPageProposalReview[] = [];
const narrowEditorMediaQuery = "(max-width: 1279px)";
let localEditorKeyCounter = 0;

function subscribeToNarrowEditorChange(onStoreChange: () => void) {
  const media = window.matchMedia(narrowEditorMediaQuery);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getNarrowEditorSnapshot() {
  return window.matchMedia(narrowEditorMediaQuery).matches;
}

function getNarrowEditorServerSnapshot() {
  return false;
}

export function SeoPageEditorForm({
  page,
  internalLinkTargets = emptyInternalLinkTargets,
  mediaAssets = emptyMediaAssets,
  aiProposals = emptyAiProposals,
  savedFromRedirect = false,
  redirectError,
}: SeoPageEditorFormProps) {
  const { refresh, replace } = useRouter();
  const [state, formAction, isManualSubmitPending] = useActionState(
    saveSeoPage,
    initialState,
  );
  const initialContent = useMemo(() => parseInitialContent(page), [page]);
  const initialDraftSettings = useMemo(
    () => parseInitialDraftSettings(page),
    [page],
  );
  const [title, setTitle] = useState(
    initialDraftSettings?.title ?? page?.title ?? "",
  );
  const [slug, setSlug] = useState(
    initialDraftSettings?.slug ?? page?.slug ?? "",
  );
  const [slugTouched, setSlugTouched] = useState(
    Boolean(initialDraftSettings?.slug ?? page?.slug),
  );
  const [targetKeyword, setTargetKeyword] = useState(
    initialDraftSettings?.targetKeyword ?? page?.target_keyword ?? "",
  );
  const [seoTitle, setSeoTitle] = useState(
    initialDraftSettings?.seoTitle ?? page?.seo_title ?? "",
  );
  const [metaDescription, setMetaDescription] = useState(
    initialDraftSettings?.metaDescription ?? page?.meta_description ?? "",
  );
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialDraftSettings?.canonicalUrl ?? page?.canonical_url ?? "",
  );
  const [noindex, setNoindex] = useState(
    initialDraftSettings?.noindex ?? page?.noindex ?? false,
  );
  const [sitemapEnabled, setSitemapEnabled] = useState(
    initialDraftSettings?.sitemapEnabled ?? page?.sitemap_enabled ?? true,
  );
  const [content, setContent] = useState<PageContent>(() =>
    ensureEditablePageContent(initialContent),
  );
  const [autosave, setAutosave] = useState<PageAutosaveResult | null>(null);
  const [aiProposalResult, setAiProposalResult] =
    useState<PageAiProposalResult>(initialAiProposalState);
  const [aiInsertResult, setAiInsertResult] =
    useState<PageAiProposalInsertResult>(initialAiInsertState);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [isPreviewOpening, setIsPreviewOpening] = useState(false);
  const [previewLinkMessage, setPreviewLinkMessage] = useState<string | null>(
    null,
  );
  const [previewLinkPath, setPreviewLinkPath] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [lastManualSubmitIntent, setLastManualSubmitIntent] =
    useState<ManualSubmitIntent>("save");
  const [showManualSubmitToast, setShowManualSubmitToast] = useState(
    savedFromRedirect || Boolean(redirectError),
  );
  const closeBlockSettings = useCallback(() => {
    setEditingBlockId(null);
  }, []);
  const isNarrowEditor = useSyncExternalStore(
    subscribeToNarrowEditorChange,
    getNarrowEditorSnapshot,
    getNarrowEditorServerSnapshot,
  );
  const [mobileEditorPanel, setMobileEditorPanel] =
    useState<MobileEditorPanel>(null);
  const [isDesktopBlockSidebarCollapsed, setIsDesktopBlockSidebarCollapsed] =
    useState(false);
  const [isDesktopSeoSidebarCollapsed, setIsDesktopSeoSidebarCollapsed] =
    useState(false);
  const [hasSelectedNewPageMode, setHasSelectedNewPageMode] = useState(
    Boolean(page?.id),
  );
  const [linkSuggestionMessage, setLinkSuggestionMessage] = useState<
    string | null
  >(null);
  const autosaveReady = useRef(false);
  const hasRefreshedAfterManualPublish = useRef(false);
  const visibleSlug = slugTouched ? slug : slugify(title);
  const draftContentJson = useMemo(() => JSON.stringify(content), [content]);
  const publishedContent = useMemo(() => parsePublishedContent(page), [page]);
  const publishedContentJson = useMemo(
    () => (publishedContent ? JSON.stringify(publishedContent) : null),
    [publishedContent],
  );
  const isPublishedPage = page?.status === "published";
  const draftContentDiffersFromLive =
    isPublishedPage &&
    publishedContentJson !== null &&
    draftContentJson !== publishedContentJson;
  const draftSettingsDifferFromLoadedPage =
    isPublishedPage &&
    Boolean(page) &&
    (title !== page?.title ||
      visibleSlug !== page?.slug ||
      targetKeyword !== (page?.target_keyword ?? "") ||
      seoTitle !== (page?.seo_title ?? "") ||
      metaDescription !== (page?.meta_description ?? "") ||
      canonicalUrl !== (page?.canonical_url ?? "") ||
      noindex !== page?.noindex ||
      sitemapEnabled !== page?.sitemap_enabled);
  const hasUnpublishedDraftChanges =
    isPublishedPage &&
    (draftContentDiffersFromLive || draftSettingsDifferFromLoadedPage);
  const publishStateLabel = isPublishedPage
    ? hasUnpublishedDraftChanges
      ? "Published with draft changes"
      : "Published"
    : (page?.status ?? "Draft");
  const publishStateHelp = isPublishedPage
    ? hasUnpublishedDraftChanges
      ? "The live page is still the last published version. Save draft changes to keep editing later, or publish changes to update the live page."
      : "Saving draft changes keeps the live page unchanged. Publish changes only when this working copy should replace the live page."
    : "This page is not live yet. Save the draft now, then publish when it is ready.";
  const saveDraftLabel = isPublishedPage ? "Save draft changes" : "Save draft";
  const publishButtonLabel = isPublishedPage ? "Publish changes" : "Publish";
  const chromeSettings = pageChromeSettings(content);
  const seoReadiness = useMemo(
    () =>
      assessSeoReadiness(content, {
        slug: visibleSlug,
        title,
        targetKeyword,
        seoTitle,
        metaDescription,
        canonicalUrl,
        noindex,
        sitemapEnabled,
      }),
    [
      canonicalUrl,
      content,
      metaDescription,
      noindex,
      seoTitle,
      sitemapEnabled,
      targetKeyword,
      title,
      visibleSlug,
    ],
  );
  const internalLinkSuggestions = useMemo(
    () =>
      suggestInternalLinks({
        content,
        currentPageId: page?.id,
        currentPath: visibleSlug ? `/resources/${visibleSlug}` : null,
        targets: internalLinkTargets,
      }),
    [content, internalLinkTargets, page?.id, visibleSlug],
  );
  const blockOrdinalById = useMemo(() => {
    const ordinals = new Map<string, number>();
    let ordinal = 0;

    for (const section of content.sections) {
      for (const column of section.columns) {
        for (const block of column.blocks) {
          ordinals.set(block.id, ordinal);
          ordinal += 1;
        }
      }
    }

    return ordinals;
  }, [content]);
  const builderBlockEntries = useMemo(
    () => collectBuilderBlockEntries(content),
    [content],
  );
  const selectedBlockEntry =
    builderBlockEntries.find((entry) => entry.block.id === selectedBlockId) ??
    builderBlockEntries[0] ??
    null;
  const editingBlockEntry =
    builderBlockEntries.find((entry) => entry.block.id === editingBlockId) ??
    null;
  const blockCompletionIssueCount = builderBlockEntries.reduce(
    (count, entry) => count + completionMessagesForBlock(entry.block).length,
    0,
  );
  const blockSidebarStatus: SeoReadinessStatus =
    builderBlockEntries.length === 0
      ? "blocked"
      : blockCompletionIssueCount > 0
        ? "needs_work"
        : "strong";
  const blockSidebarExpandTitle =
    builderBlockEntries.length === 0
      ? "Expand blocks sidebar - no blocks yet"
      : blockCompletionIssueCount > 0
        ? `Expand blocks sidebar - ${blockCompletionIssueCount} content ${blockCompletionIssueCount === 1 ? "issue" : "issues"}`
        : "Expand blocks sidebar - all blocks ready";
  const seoSidebarExpandTitle = `Expand SEO sidebar - SEO ${seoReadiness.label}`;
  const canPublish = Boolean(page?.id);
  const publishDisabled = !canPublish || seoReadiness.blockers.length > 0;
  const nextPublishStep = nextRequiredPublishStep({
    canPublish,
    hasUnpublishedDraftChanges,
    isPublishedPage,
    summary: seoReadiness,
  });
  const primarySection = content.sections[0] ?? null;
  const primaryColumn = primarySection?.columns[0] ?? null;
  const usesSimpleBlockStack =
    content.sections.length <= 1 && (primarySection?.columns.length ?? 0) <= 1;
  const showCreationChoiceModal = !page?.id && !hasSelectedNewPageMode;
  const saveMessage = (() => {
    if (redirectError && state.status === "idle" && !lastManualSubmitIntent) {
      return redirectError;
    }
    if (
      isPublishedPage &&
      state.status === "saved" &&
      lastManualSubmitIntent === "save"
    ) {
      return "Draft changes saved. The published page is still live.";
    }
    if (
      isPublishedPage &&
      state.status === "saved" &&
      lastManualSubmitIntent === "publish"
    ) {
      return "Changes published.";
    }
    return (
      state.message ??
      (state.status === "error" ? "Save failed." : "Draft saved.")
    );
  })();
  const manualSubmitToast = showManualSubmitToast
    ? {
        message: isManualSubmitPending
          ? lastManualSubmitIntent === "publish"
            ? isPublishedPage
              ? "Publishing changes..."
              : "Publishing page..."
            : isPublishedPage
              ? "Saving draft changes..."
              : "Saving draft..."
          : saveMessage,
        tone:
          !isManualSubmitPending && (state.status === "error" || redirectError)
            ? "error"
            : isManualSubmitPending
              ? "pending"
              : "success",
      }
    : null;
  const isBlockSidebarCollapsed = isNarrowEditor
    ? mobileEditorPanel !== "blocks"
    : isDesktopBlockSidebarCollapsed;
  const isSeoSidebarCollapsed = isNarrowEditor
    ? mobileEditorPanel !== "seo"
    : isDesktopSeoSidebarCollapsed;
  const builderShellGridClass = `grid min-h-[calc(100dvh-4rem)] gap-4 p-4 lg:min-h-screen ${
    isBlockSidebarCollapsed && isSeoSidebarCollapsed
      ? "xl:grid-cols-[minmax(0,1fr)]"
      : isBlockSidebarCollapsed
        ? "xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]"
        : isSeoSidebarCollapsed
          ? "xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]"
          : "xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(380px,440px)]"
  }`;

  const handleEditorFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      if (
        !(
          submitter instanceof HTMLButtonElement ||
          submitter instanceof HTMLInputElement
        )
      ) {
        return;
      }

      if (submitter.name !== "intent") return;
      if (submitter.value !== "save" && submitter.value !== "publish") return;

      setLastManualSubmitIntent(submitter.value);
      if (submitter.value === "publish") {
        hasRefreshedAfterManualPublish.current = false;
      }
      setShowManualSubmitToast(true);
    },
    [],
  );

  useEffect(() => {
    if (state.status !== "saved" || lastManualSubmitIntent !== "publish") {
      return;
    }
    if (hasRefreshedAfterManualPublish.current) return;

    hasRefreshedAfterManualPublish.current = true;
    refresh();
  }, [lastManualSubmitIntent, refresh, state.status]);

  useEffect(() => {
    if (!showManualSubmitToast || isManualSubmitPending) return;
    if (state.status === "idle" && !savedFromRedirect && !redirectError) return;

    const timer = window.setTimeout(() => {
      setShowManualSubmitToast(false);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [
    isManualSubmitPending,
    redirectError,
    savedFromRedirect,
    showManualSubmitToast,
    state,
  ]);

  useEffect(() => {
    if (!page?.id) return;
    if (!autosaveReady.current) {
      autosaveReady.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      autosaveSeoPageDraft(page.id, {
        title,
        slug: visibleSlug,
        targetKeyword,
        seoTitle,
        metaDescription,
        canonicalUrl,
        noindex,
        sitemapEnabled,
        draftContent: content,
      })
        .then(setAutosave)
        .catch((error: unknown) => {
          console.error("seo page autosave failed", error);
          setAutosave({ status: "error", message: "Autosave failed." });
        });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    canonicalUrl,
    content,
    metaDescription,
    noindex,
    page?.id,
    seoTitle,
    sitemapEnabled,
    targetKeyword,
    title,
    visibleSlug,
  ]);

  useEffect(() => {
    const storedPreviewLink = window.sessionStorage.getItem(
      previewSessionStorageKey,
    );
    if (!storedPreviewLink) return;

    window.sessionStorage.removeItem(previewSessionStorageKey);
    try {
      const parsed = JSON.parse(storedPreviewLink) as {
        path?: unknown;
        message?: unknown;
      };
      if (typeof parsed.path === "string") {
        window.setTimeout(() => {
          setPreviewLinkPath(parsed.path as string);
          setPreviewLinkMessage(
            typeof parsed.message === "string"
              ? parsed.message
              : "Preview ready.",
          );
        }, 0);
      }
    } catch {
      // Ignore stale preview state from older builds.
    }
  }, []);

  if (showCreationChoiceModal) {
    return (
      <NewPageChoiceGate
        onCreateFromScratch={() => setHasSelectedNewPageMode(true)}
      />
    );
  }

  return (
    <MediaPickerProvider initialAssets={mediaAssets}>
      <form
        action={formAction}
        className="relative"
        onSubmit={handleEditorFormSubmit}
      >
        {manualSubmitToast && (
          <div className="pointer-events-none fixed top-5 right-4 z-[90] flex w-[calc(100vw-2rem)] justify-end sm:right-6">
            <div
              role={manualSubmitToast.tone === "error" ? "alert" : "status"}
              aria-live={
                manualSubmitToast.tone === "error" ? "assertive" : "polite"
              }
              className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${
                manualSubmitToast.tone === "error"
                  ? "border-red-200 bg-red-50/95 text-red-800"
                  : manualSubmitToast.tone === "pending"
                    ? "border-sky-200 bg-white/95 text-slate-800"
                    : "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              }`}
            >
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${
                  manualSubmitToast.tone === "error"
                    ? "bg-red-500"
                    : manualSubmitToast.tone === "pending"
                      ? "bg-sky-500"
                      : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
              <span>{manualSubmitToast.message}</span>
            </div>
          </div>
        )}
        {page?.id && <input type="hidden" name="id" value={page.id} />}
        <input type="hidden" name="draftContent" value={draftContentJson} />
        {isSeoSidebarCollapsed && (
          <input type="hidden" name="slug" value={visibleSlug} />
        )}

        <div className="relative min-h-[calc(100dvh-4rem)] overflow-x-hidden border border-slate-200 bg-slate-100 lg:min-h-screen">
          <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-100/95 px-4 pt-4 pb-3 backdrop-blur">
            <div className="mx-auto grid max-w-[1500px] grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3">
              <div className="flex justify-start">
                <button
                  type="button"
                  className={floatingRailButtonClass(blockSidebarStatus)}
                  aria-label={
                    isNarrowEditor
                      ? isBlockSidebarCollapsed
                        ? blockSidebarExpandTitle
                        : "Close blocks panel"
                      : isBlockSidebarCollapsed
                        ? "Expand blocks sidebar"
                        : "Collapse blocks sidebar"
                  }
                  title={
                    isNarrowEditor
                      ? isBlockSidebarCollapsed
                        ? blockSidebarExpandTitle
                        : "Close blocks panel"
                      : isBlockSidebarCollapsed
                        ? blockSidebarExpandTitle
                        : "Collapse blocks sidebar"
                  }
                  onClick={toggleBlockSidebar}
                >
                  <ChevronIcon
                    direction={isBlockSidebarCollapsed ? "right" : "left"}
                  />
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
                {previewLinkMessage && (
                  <p className="text-xs font-medium text-slate-500">
                    {previewLinkMessage}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className={floatingRailButtonClass(seoReadiness.status)}
                  aria-label={
                    isNarrowEditor
                      ? isSeoSidebarCollapsed
                        ? seoSidebarExpandTitle
                        : "Close SEO panel"
                      : isSeoSidebarCollapsed
                        ? "Expand SEO sidebar"
                        : "Collapse SEO sidebar"
                  }
                  title={
                    isNarrowEditor
                      ? isSeoSidebarCollapsed
                        ? seoSidebarExpandTitle
                        : "Close SEO panel"
                      : isSeoSidebarCollapsed
                        ? seoSidebarExpandTitle
                        : "Collapse SEO sidebar"
                  }
                  onClick={toggleSeoSidebar}
                >
                  <ChevronIcon
                    direction={isSeoSidebarCollapsed ? "left" : "right"}
                  />
                </button>
              </div>
            </div>
          </div>
          {isNarrowEditor &&
            (!isBlockSidebarCollapsed || !isSeoSidebarCollapsed) && (
              <button
                type="button"
                aria-label="Close editor side panel"
                className="fixed inset-x-0 top-28 bottom-0 z-[55] bg-slate-950/20 xl:hidden"
                onClick={() => setMobileEditorPanel(null)}
              />
            )}
          <div className={builderShellGridClass}>
            {!isBlockSidebarCollapsed && (
              <aside className="fixed top-32 bottom-4 left-4 z-[60] order-2 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:bottom-auto xl:left-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none">
                <div className="flex shrink-0 items-start border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Blocks
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">
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
                    chromeSettings={chromeSettings}
                    onSelectBlock={(entry) => {
                      setSelectedBlockId(entry.block.id);
                      document
                        .getElementById(`builder-block-${entry.blockNumber}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }}
                    onEditBlock={(entry) => {
                      setSelectedBlockId(entry.block.id);
                      setEditingBlockId(entry.block.id);
                      document
                        .getElementById(`builder-block-${entry.blockNumber}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }}
                    onChromeSettingsChange={updateChromeSettings}
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
              </aside>
            )}

            <div className="order-1 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100 shadow-sm xl:order-none xl:h-[calc(100dvh-7rem)]">
              {(state.status !== "idle" ||
                savedFromRedirect ||
                redirectError ||
                autosave) && (
                <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-5 py-3 text-sm shadow-sm backdrop-blur">
                  <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
                    {(state.status !== "idle" ||
                      savedFromRedirect ||
                      redirectError) && (
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
                          autosave.status === "error"
                            ? "text-red-700"
                            : "text-slate-500"
                        }
                      >
                        {autosave.status === "saved"
                          ? `Autosaved ${formatTime(autosave.savedAt)}`
                          : autosave.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mx-auto max-w-[1500px] bg-[#f5fbff] shadow-sm">
                {chromeSettings.showHeader ? <EditorPublicHeader /> : null}
                <article className="bg-[#f5fbff]">
                  <main className="group/page-body relative mx-auto max-w-5xl px-5 py-14 lg:px-10">
                    {usesSimpleBlockStack && primarySection && primaryColumn ? (
                      <SimpleBlockStackEditor
                        column={primaryColumn}
                        blockOrdinalById={blockOrdinalById}
                        onAddBlock={(type, variant) =>
                          addBlock(
                            primarySection.id,
                            primaryColumn.id,
                            type,
                            variant,
                          )
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
                          duplicateBlock(
                            primarySection.id,
                            primaryColumn.id,
                            blockId,
                          )
                        }
                        onBlockRemove={(blockId) =>
                          removeBlock(
                            primarySection.id,
                            primaryColumn.id,
                            blockId,
                          )
                        }
                        onEditBlockSettings={(blockId) => {
                          setSelectedBlockId(blockId);
                          setEditingBlockId(blockId);
                        }}
                      />
                    ) : (
                      <div>
                        {content.sections.length === 0 ? (
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
                                <rect
                                  width="18"
                                  height="18"
                                  x="3"
                                  y="3"
                                  rx="2"
                                />
                                <path d="M3 9h18" />
                                <path d="M9 21V9" />
                              </svg>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Blank page body
                            </h3>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                              Add content to start writing this page.
                            </p>
                            <button
                              type="button"
                              onClick={() => addSuggestedBlock("rich_text")}
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
                        ) : (
                          content.sections.map((section, index) => (
                            <div
                              key={section.id}
                              className={editorCanvasDividerClass(
                                index > 0,
                                14,
                              )}
                            >
                              <SortableSectionEditor
                                section={section}
                                sectionIndex={index}
                                sectionCount={content.sections.length}
                                blockOrdinalById={blockOrdinalById}
                                onSectionMove={(direction) =>
                                  moveSection(section.id, direction)
                                }
                                onSectionMoveToIndex={(targetIndex) =>
                                  moveSectionToIndex(section.id, targetIndex)
                                }
                                onSectionRemove={() =>
                                  removeSection(section.id)
                                }
                                onAddColumn={() => addColumn(section.id)}
                                onColumnMove={(columnId, direction) =>
                                  moveColumn(section.id, columnId, direction)
                                }
                                onColumnMoveToIndex={(columnId, targetIndex) =>
                                  moveColumnToIndex(
                                    section.id,
                                    columnId,
                                    targetIndex,
                                  )
                                }
                                onColumnRemove={(columnId) =>
                                  removeColumn(section.id, columnId)
                                }
                                onAddBlock={(columnId, type, variant) =>
                                  addBlock(section.id, columnId, type, variant)
                                }
                                onBlockChange={(columnId, blockId, next) =>
                                  replaceBlock(
                                    section.id,
                                    columnId,
                                    blockId,
                                    next,
                                  )
                                }
                                onBlockMove={(columnId, blockId, direction) =>
                                  moveBlock(
                                    section.id,
                                    columnId,
                                    blockId,
                                    direction,
                                  )
                                }
                                onBlockMoveToIndex={(
                                  columnId,
                                  blockId,
                                  targetIndex,
                                ) =>
                                  moveBlockToIndex(
                                    section.id,
                                    columnId,
                                    blockId,
                                    targetIndex,
                                  )
                                }
                                onBlockDuplicate={(columnId, blockId) =>
                                  duplicateBlock(section.id, columnId, blockId)
                                }
                                onBlockRemove={(columnId, blockId) =>
                                  removeBlock(section.id, columnId, blockId)
                                }
                                onEditBlockSettings={(blockId) => {
                                  setSelectedBlockId(blockId);
                                  setEditingBlockId(blockId);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </main>
                </article>
                {chromeSettings.showFooter ? <EditorPublicFooter /> : null}
              </div>
            </div>

            {!isSeoSidebarCollapsed && (
              <aside className="fixed top-32 right-4 bottom-4 z-[60] order-3 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:right-auto xl:bottom-auto xl:z-auto xl:order-none xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:w-auto xl:max-w-none">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      SEO
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">
                      Readiness and publish
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {publishStateLabel} · SEO {seoReadiness.label}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {seoReadiness.label}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                        Status
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`size-1.5 rounded-full ${
                              page?.status === "published"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                          {publishStateLabel}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs leading-5 font-medium text-slate-500">
                      {publishStateHelp}
                    </p>
                    <button
                      type="button"
                      className={`${smallButtonClass} ${readinessButtonClass(
                        seoReadiness.status,
                      )} justify-center`}
                      onClick={() =>
                        document
                          .getElementById("seo-target-keyword-field")
                          ?.focus()
                      }
                    >
                      SEO: {seoReadiness.label}
                    </button>
                  </div>

                  <NextPublishStepCard step={nextPublishStep} />

                  <div className="space-y-5">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Page title
                      </span>
                      <input
                        name="title"
                        aria-label="Page title"
                        value={title}
                        id="page-title-field"
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        className={compactInputClass}
                        placeholder="Internal page title and SEO fallback"
                      />
                      <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                        Used for admin lists, slug generation, and as the SEO
                        title fallback. The visible page headline is edited in
                        the hero block.
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Slug
                      </span>
                      <div className="mt-1.5 flex items-center rounded-lg border border-slate-200 bg-white shadow-sm transition focus-within:border-[#0b63f6] focus-within:ring-4 focus-within:ring-[#0b63f6]/10">
                        <span className="border-r border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-400">
                          /resources/
                        </span>
                        <input
                          name="slug"
                          value={visibleSlug}
                          onChange={(event) => {
                            setSlugTouched(true);
                            setSlug(slugify(event.target.value));
                          }}
                          required
                          aria-label="Slug"
                          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                          placeholder="page-slug"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Target keyword
                      </span>
                      <input
                        name="targetKeyword"
                        aria-label="Target keyword"
                        value={targetKeyword}
                        id="seo-target-keyword-field"
                        onChange={(event) =>
                          setTargetKeyword(event.target.value)
                        }
                        className={compactInputClass}
                        placeholder="e.g. vending machine business"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        SEO title
                      </span>
                      <input
                        name="seoTitle"
                        aria-label="SEO title"
                        value={seoTitle}
                        id="seo-title-field"
                        onChange={(event) => setSeoTitle(event.target.value)}
                        className={compactInputClass}
                        placeholder="Leave blank to use page headline"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Meta description
                      </span>
                      <textarea
                        name="metaDescription"
                        aria-label="Meta description"
                        value={metaDescription}
                        id="page-meta-description-field"
                        onChange={(event) =>
                          setMetaDescription(event.target.value)
                        }
                        rows={3}
                        className={textareaClass}
                        placeholder="Search result summary for this page."
                      />
                    </label>

                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                        Advanced SEO
                      </summary>
                      <div className="mt-4 space-y-4">
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-900">
                            Preferred URL
                          </span>
                          <input
                            name="canonicalUrl"
                            aria-label="Preferred URL"
                            value={canonicalUrl}
                            id="seo-canonical-url-field"
                            onChange={(event) =>
                              setCanonicalUrl(event.target.value)
                            }
                            className={compactInputClass}
                            placeholder="https://..."
                          />
                          <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                            Optional. Use only when this page should point
                            search engines to a different preferred URL.
                          </span>
                        </label>

                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
                            <input
                              name="noindex"
                              aria-label="Hide from search engines"
                              type="checkbox"
                              checked={noindex}
                              onChange={(event) => {
                                setNoindex(event.target.checked);
                                if (event.target.checked)
                                  setSitemapEnabled(false);
                              }}
                              className="mt-1 size-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6]"
                            />
                            <div>
                              <span className="block text-slate-900">
                                Hide from search engines
                              </span>
                              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                Use this only for pages that should not appear
                                in search results.
                              </span>
                            </div>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
                            <input
                              name="sitemapEnabled"
                              aria-label="Include in sitemap"
                              type="checkbox"
                              checked={sitemapEnabled}
                              disabled={noindex}
                              onChange={(event) =>
                                setSitemapEnabled(event.target.checked)
                              }
                              className="mt-1 size-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6] disabled:opacity-50"
                            />
                            <div className={noindex ? "opacity-50" : ""}>
                              <span className="block text-slate-900">
                                Include in sitemap
                              </span>
                              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                Help search engines discover this page.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </details>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5">
                      <div className="mb-4 flex items-center gap-2">
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
                          className="text-[#0b63f6]"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Search Preview
                        </h3>
                      </div>
                      <div className="space-y-1">
                        <p className="cursor-pointer truncate text-lg font-medium text-[#1a0dab] hover:underline">
                          {seoTitle || title || "Your Page Title Here"}
                        </p>
                        <p className="truncate text-sm text-[#006621]">
                          www.vendingpreneurs.com/resources/
                          {visibleSlug || "your-slug"}
                        </p>
                        <p className="line-clamp-2 text-sm text-[#545454]">
                          {metaDescription ||
                            "Your meta description will appear here. Make it compelling to encourage clicks from search results."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <SeoReadinessPanel
                    content={content}
                    summary={seoReadiness}
                    aiProposalResult={aiProposalResult}
                    aiInsertResult={aiInsertResult}
                    aiProposals={aiProposals}
                    canRunAiAgent={Boolean(page?.id)}
                    isAiGenerating={isAiGenerating}
                    isAiInserting={isAiInserting}
                    internalLinkSuggestions={internalLinkSuggestions}
                    linkSuggestionMessage={linkSuggestionMessage}
                    onInsertAiProposalBlocks={insertAiProposalBlocks}
                    onApplyInternalLinkSuggestion={applyLinkSuggestion}
                    onAddSuggestedBlock={addSuggestedBlock}
                    onRunAiAgent={runAiSeoAgent}
                    onOpenSettings={() => {
                      document
                        .getElementById("seo-target-keyword-field")
                        ?.focus();
                    }}
                    mediaAssetCount={mediaAssets.length}
                  />
                </div>

                <div className="grid shrink-0 gap-4 border-t border-slate-200 bg-white p-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-5">
                  <button
                    type="submit"
                    className={secondaryButtonClass}
                    name="intent"
                    value="save"
                    title={
                      isPublishedPage
                        ? "Save unpublished edits while keeping the current live page published."
                        : undefined
                    }
                  >
                    {saveDraftLabel}
                  </button>
                  <button
                    type="submit"
                    className={primaryButtonClass}
                    name="intent"
                    value="publish"
                    disabled={publishDisabled}
                    title={
                      seoReadiness.blockers.length > 0
                        ? "Resolve SEO blockers before publishing."
                        : undefined
                    }
                  >
                    {publishButtonLabel}
                  </button>
                </div>
              </aside>
            )}
          </div>
        </div>
        {editingBlockEntry && (
          <BlockSettingsModal
            entry={editingBlockEntry}
            onClose={closeBlockSettings}
            onChange={(next) =>
              replaceBlock(
                editingBlockEntry.sectionId,
                editingBlockEntry.columnId,
                editingBlockEntry.block.id,
                next,
              )
            }
          />
        )}
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="slug" value={visibleSlug} />
        <input type="hidden" name="metaDescription" value={metaDescription} />
        <input type="hidden" name="seoTitle" value={seoTitle} />
        <input type="hidden" name="targetKeyword" value={targetKeyword} />
        <input type="hidden" name="canonicalUrl" value={canonicalUrl} />
        {noindex && <input type="hidden" name="noindex" value="on" />}
        {sitemapEnabled && !noindex && (
          <input type="hidden" name="sitemapEnabled" value="on" />
        )}
      </form>
    </MediaPickerProvider>
  );

  async function openLivePreview() {
    if (isPreviewOpening) {
      return;
    }

    setIsPreviewOpening(true);
    setPreviewLinkMessage(null);
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
    }

    try {
      const previewResult = page?.id
        ? await createPreviewLinkForSavedPage()
        : await saveSeoPageDraftAndCreatePreviewLink(
            { status: "idle" },
            buildPageFormData(),
          );

      if (previewResult.status === "created") {
        setPreviewLinkPath(previewResult.previewPath);
        setPreviewLinkMessage(previewResult.message);
        if (previewWindow) {
          previewWindow.location.href = previewResult.previewPath;
        } else {
          setPreviewLinkMessage("Preview ready. Use Open preview.");
        }
        if (previewResult.editorPath && !page?.id) {
          window.sessionStorage.setItem(
            previewSessionStorageKey,
            JSON.stringify({
              path: previewResult.previewPath,
              message: previewResult.message,
            }),
          );
          replace(previewResult.editorPath);
        }
        return;
      }

      previewWindow?.close();
      setPreviewLinkMessage(
        previewResult.message ?? "Could not open live preview.",
      );
    } catch (error) {
      console.error("failed to open live preview", error);
      previewWindow?.close();
      setPreviewLinkMessage("Could not open live preview.");
    } finally {
      setIsPreviewOpening(false);
    }
  }

  function toggleBlockSidebar() {
    if (isNarrowEditor) {
      setMobileEditorPanel((currentPanel) =>
        currentPanel === "blocks" ? null : "blocks",
      );
      return;
    }

    setIsDesktopBlockSidebarCollapsed((isCollapsed) => !isCollapsed);
  }

  function toggleSeoSidebar() {
    if (isNarrowEditor) {
      setMobileEditorPanel((currentPanel) =>
        currentPanel === "seo" ? null : "seo",
      );
      return;
    }

    setIsDesktopSeoSidebarCollapsed((isCollapsed) => !isCollapsed);
  }

  async function createPreviewLinkForSavedPage() {
    if (!page?.id) {
      return saveSeoPageDraftAndCreatePreviewLink(
        { status: "idle" },
        buildPageFormData(),
      );
    }

    const autosaveResult = await autosaveSeoPageDraft(page.id, {
      title,
      slug: visibleSlug,
      targetKeyword,
      seoTitle,
      metaDescription,
      canonicalUrl,
      noindex,
      sitemapEnabled,
      draftContent: content,
    });

    if (autosaveResult.status === "error") {
      return { status: "error" as const, message: autosaveResult.message };
    }

    const formData = new FormData();
    formData.set("pageId", page.id);
    return createSeoPagePreviewLink({ status: "idle" }, formData);
  }

  function buildPageFormData() {
    const formData = new FormData();
    if (page?.id) formData.set("id", page.id);
    formData.set("title", title);
    formData.set("slug", visibleSlug);
    formData.set("targetKeyword", targetKeyword);
    formData.set("seoTitle", seoTitle);
    formData.set("metaDescription", metaDescription);
    formData.set("canonicalUrl", canonicalUrl);
    if (noindex) formData.set("noindex", "on");
    if (sitemapEnabled && !noindex) formData.set("sitemapEnabled", "on");
    formData.set("draftContent", draftContentJson);
    formData.set("intent", "save");
    return formData;
  }

  function updateChromeSettings(next: Partial<PageChromeSettings>) {
    setContent((current) => ({
      ...current,
      chrome: { ...pageChromeSettings(current), ...next },
    }));
  }

  function addBlock(
    sectionId: string,
    columnId: string,
    type: PageBlock["type"],
    variant?: BlockVariant,
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => ({
        ...column,
        blocks: [
          ...column.blocks,
          createPageBlockWithVariant(type, makeBuilderId("block"), variant),
        ],
      })),
    );
  }

  function addColumn(sectionId: string) {
    setContent((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId || section.columns.length >= 4) {
          return section;
        }
        return {
          ...section,
          columns: [
            ...section.columns,
            createPageColumn(makeBuilderId("column")),
          ],
        };
      }),
    }));
  }

  function addSuggestedBlock(type: PageBlock["type"]) {
    const blockId = makeBuilderId("block");
    const nextBlock = createPageBlockWithVariant(type, blockId);

    setContent((current) => {
      const firstSection = current.sections[0];
      const firstColumn = firstSection?.columns[0];

      if (!firstSection) {
        const columnId = makeBuilderId("column");
        return {
          ...current,
          sections: [
            {
              ...createPageSection(makeBuilderId("section"), columnId),
              columns: [
                {
                  ...createPageColumn(columnId),
                  blocks: [nextBlock],
                },
              ],
            },
          ],
        };
      }

      if (!firstColumn) {
        const columnId = makeBuilderId("column");
        return {
          ...current,
          sections: current.sections.map((section, index) =>
            index === 0
              ? {
                  ...section,
                  columns: [createPageColumn(columnId)].map((column) => ({
                    ...column,
                    blocks: [nextBlock],
                  })),
                }
              : section,
          ),
        };
      }

      return updateColumn(
        current,
        firstSection.id,
        firstColumn.id,
        (column) => ({
          ...column,
          blocks: [...column.blocks, nextBlock],
        }),
      );
    });
    setSelectedBlockId(blockId);
    scrollToBuilderBlockId(blockId);
  }

  function replaceBlock(
    sectionId: string,
    columnId: string,
    blockId: string,
    next: PageBlock,
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === blockId ? next : block,
        ),
      })),
    );
  }

  function moveSection(sectionId: string, direction: MoveDirection) {
    setContent((current) => {
      const index = current.sections.findIndex(
        (section) => section.id === sectionId,
      );
      return {
        ...current,
        sections: moveItem(current.sections, index, direction),
      };
    });
  }

  function moveColumn(
    sectionId: string,
    columnId: string,
    direction: MoveDirection,
  ) {
    setContent((current) =>
      updateSection(current, sectionId, (section) => {
        const index = section.columns.findIndex(
          (column) => column.id === columnId,
        );
        return {
          ...section,
          columns: moveItem(section.columns, index, direction),
        };
      }),
    );
  }

  function moveBlock(
    sectionId: string,
    columnId: string,
    blockId: string,
    direction: MoveDirection,
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => {
        const index = column.blocks.findIndex((block) => block.id === blockId);
        return { ...column, blocks: moveItem(column.blocks, index, direction) };
      }),
    );
  }

  function moveBlockToIndex(
    sectionId: string,
    columnId: string,
    blockId: string,
    targetIndex: number,
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => {
        const index = column.blocks.findIndex((block) => block.id === blockId);
        return {
          ...column,
          blocks: moveItemToIndex(column.blocks, index, targetIndex),
        };
      }),
    );
  }

  function duplicateBlock(
    sectionId: string,
    columnId: string,
    blockId: string,
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => {
        if (column.blocks.length >= 30) return column;
        const index = column.blocks.findIndex((block) => block.id === blockId);
        const block = column.blocks[index];
        if (!block) return column;

        const blocks = [...column.blocks];
        blocks.splice(
          index + 1,
          0,
          duplicatePageBlock(block, makeBuilderId("block")),
        );
        return { ...column, blocks };
      }),
    );
  }

  function removeSection(sectionId: string) {
    setContent((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    }));
  }

  function removeColumn(sectionId: string, columnId: string) {
    setContent((current) =>
      updateSection(current, sectionId, (section) => ({
        ...section,
        columns: section.columns.filter((column) => column.id !== columnId),
      })),
    );
  }

  function removeBlock(sectionId: string, columnId: string, blockId: string) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => ({
        ...column,
        blocks: column.blocks.filter((block) => block.id !== blockId),
      })),
    );
  }

  function moveSectionToIndex(sectionId: string, targetIndex: number) {
    setContent((current) => {
      const index = current.sections.findIndex(
        (section) => section.id === sectionId,
      );
      return {
        ...current,
        sections: moveItemToIndex(current.sections, index, targetIndex),
      };
    });
  }

  function moveColumnToIndex(
    sectionId: string,
    columnId: string,
    targetIndex: number,
  ) {
    setContent((current) =>
      updateSection(current, sectionId, (section) => {
        const index = section.columns.findIndex(
          (column) => column.id === columnId,
        );
        return {
          ...section,
          columns: moveItemToIndex(section.columns, index, targetIndex),
        };
      }),
    );
  }

  function applyLinkSuggestion(suggestion: InternalLinkSuggestion) {
    const result = applyInternalLinkSuggestion(content, suggestion);
    if (!result.applied) {
      setLinkSuggestionMessage(result.reason);
      return;
    }

    setContent(result.content);
    setLinkSuggestionMessage(
      `Linked "${suggestion.anchorText}" to ${suggestion.targetPath}.`,
    );
  }

  async function runAiSeoAgent() {
    if (!page?.id) {
      setAiProposalResult({
        status: "error",
        message: "Save the draft before running AI.",
      });
      return;
    }

    setIsAiGenerating(true);
    setAiProposalResult({ status: "idle" });
    try {
      const result = await generateAiSeoPageProposal(page.id);
      setAiProposalResult(result);
      if (result.status === "created") refresh();
    } catch (error) {
      console.error("AI SEO agent failed", error);
      setAiProposalResult({
        status: "error",
        message: "Could not create an AI proposal.",
      });
    } finally {
      setIsAiGenerating(false);
    }
  }

  async function insertAiProposalBlocks(
    proposalId: string,
    blockIds: string[],
  ) {
    if (!page?.id) {
      setAiInsertResult({
        status: "error",
        proposalId,
        message: "Save the draft before inserting AI content.",
      });
      return;
    }

    setIsAiInserting(true);
    setAiInsertResult({ status: "idle" });
    try {
      const result = await acceptAiSeoProposalBlocks(
        page.id,
        proposalId,
        blockIds,
      );
      setAiInsertResult(result);
      if (result.status === "inserted") {
        setContent(ensureEditablePageContent(result.content));
        refresh();
      }
    } catch (error) {
      console.error("AI SEO proposal insert failed", error);
      setAiInsertResult({
        status: "error",
        proposalId,
        message: "Could not insert AI proposal content.",
      });
    } finally {
      setIsAiInserting(false);
    }
  }
}

function NewPageChoiceGate({
  onCreateFromScratch,
}: {
  onCreateFromScratch: () => void;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center border border-slate-200 bg-slate-100 px-4 py-12">
      <section
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-7"
        aria-labelledby="new-page-choice-title"
      >
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
            SEO Page Builder
          </p>
          <h2
            id="new-page-choice-title"
            className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
          >
            Create page
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Start with a blank editable page. The SEO checklist, page canvas,
            and publish controls appear after this choice.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border-2 border-[#0b63f6] bg-[#f4f8ff] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
            onClick={onCreateFromScratch}
          >
            <span className="block text-lg font-semibold text-slate-950">
              From scratch
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">
              Start with a blank editable page.
            </span>
          </button>
          <button
            type="button"
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 p-5 text-left opacity-70"
            disabled
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-slate-950">
                From template
              </span>
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Coming soon
              </span>
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-500">
              Use approved page patterns.
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

function EditorPublicHeader() {
  return (
    <header className="sticky inset-x-0 top-0 z-20 border-b-2 border-[#111111] bg-[#f5fbff]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-4 lg:px-10">
        <Link
          href="/"
          aria-label="Vendingpreneurs home"
          onClick={(event) => event.preventDefault()}
        >
          <Wordmark height={48} />
        </Link>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-x-10 lg:flex"
        >
          {primaryNav.map((item) => (
            <EditorPublicNavLink key={item.label} item={item} />
          ))}
        </nav>
        <Link
          href="/apply"
          onClick={(event) => event.preventDefault()}
          className="hidden min-h-12 items-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] lg:inline-flex"
        >
          Step inside
        </Link>
      </div>
    </header>
  );
}

function EditorPublicFooter() {
  return (
    <footer className="border-t-2 border-[#111111] bg-[#f5fbff] px-5 py-14 lg:px-10">
      <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
        <Wordmark />
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {footerColumns.map((col, columnIndex) => (
            <ul
              key={col.items[0]?.label ?? "footer-column"}
              className="space-y-3"
            >
              {col.items.map((item) => (
                <li key={item.label}>
                  <EditorPublicNavLink
                    item={item}
                    highlighted={columnIndex === footerColumns.length - 1}
                  />
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function EditorPublicNavLink({
  item,
  highlighted = false,
}: {
  item:
    | (typeof primaryNav)[number]
    | (typeof footerColumns)[number]["items"][number];
  highlighted?: boolean;
}) {
  const className = `text-sm font-black uppercase transition hover:text-[#55b8e8] ${
    highlighted ? "text-[#2d9fd6]" : "text-[#111111]"
  }`;

  if (item.external) {
    return (
      <span className={className} aria-disabled="true">
        {item.label}
      </span>
    );
  }

  return (
    <span className={className} aria-disabled="true">
      {item.label}
    </span>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      {direction === "left" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

type NextPublishStep = {
  title: string;
  detail: string;
  tone: "blocked" | "work" | "ready";
};

function NextPublishStepCard({ step }: { step: NextPublishStep }) {
  const toneClass =
    step.tone === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : step.tone === "blocked"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-sky-200 bg-sky-50 text-sky-950";

  return (
    <section className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold tracking-wider uppercase">
        Next required step
      </p>
      <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-6 opacity-80">{step.detail}</p>
    </section>
  );
}

function BuilderBlockSidebar({
  entries,
  selectedEntry,
  chromeSettings,
  onSelectBlock,
  onEditBlock,
  onChromeSettingsChange,
}: {
  entries: BuilderBlockEntry[];
  selectedEntry: BuilderBlockEntry | null;
  chromeSettings: PageChromeSettings;
  onSelectBlock: (entry: BuilderBlockEntry) => void;
  onEditBlock: (entry: BuilderBlockEntry) => void;
  onChromeSettingsChange: (settings: Partial<PageChromeSettings>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-xl">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-sky-300 uppercase">
              Page blocks
            </p>
            <h3 className="mt-1 text-base font-semibold">Builder outline</h3>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/10 ring-inset">
            {entries.length}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        <PageChromeControls
          settings={chromeSettings}
          onChange={onChromeSettingsChange}
        />
        {entries.length > 0 ? (
          <div className="max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const isSelected = selectedEntry?.block.id === entry.block.id;
              const hasWarnings =
                completionMessagesForBlock(entry.block).length > 0;

              return (
                <div
                  key={entry.block.id}
                  className={`flex items-stretch gap-2 rounded-xl border p-1.5 transition ${
                    isSelected
                      ? "border-sky-300 bg-white text-slate-950 shadow-sm"
                      : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
                    onClick={() => onSelectBlock(entry)}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? "bg-sky-50 text-[#0b63f6] ring-1 ring-sky-100"
                          : "bg-white/10 text-slate-200 ring-1 ring-white/10"
                      }`}
                      aria-hidden="true"
                    >
                      <BuilderGlyph name={entry.block.type} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {blockLabel(entry.block.type)}
                        </span>
                        {hasWarnings && (
                          <span className="size-2 rounded-full bg-amber-400" />
                        )}
                      </span>
                      <span
                        className={`mt-1 line-clamp-2 block text-xs leading-5 ${
                          isSelected ? "text-slate-500" : "text-slate-300"
                        }`}
                      >
                        {entry.blockNumber}. {blockSummary(entry.block)}
                      </span>
                      <span
                        className={`mt-1 block text-[11px] font-medium ${
                          isSelected ? "text-slate-400" : "text-slate-400"
                        }`}
                      >
                        Section {entry.sectionNumber}, column{" "}
                        {entry.columnNumber}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${blockLabel(entry.block.type)} settings`}
                    title={`Edit ${blockLabel(entry.block.type)} settings`}
                    aria-pressed={isSelected}
                    className={`my-2 flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${
                      isSelected
                        ? "bg-[#0b63f6] text-white"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                    onClick={() => onEditBlock(entry)}
                  >
                    <SettingsGlyph />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center">
            <p className="text-sm font-semibold">No blocks yet</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Use the page canvas to add the first content block.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function PageChromeControls({
  settings,
  onChange,
}: {
  settings: PageChromeSettings;
  onChange: (settings: Partial<PageChromeSettings>) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="mb-3 text-xs font-semibold tracking-wider text-slate-300 uppercase">
        Page chrome
      </p>
      <div className="grid gap-2">
        <ChromeToggle
          label="Show header"
          checked={settings.showHeader}
          onChange={(checked) => onChange({ showHeader: checked })}
        />
        <ChromeToggle
          label="Show footer"
          checked={settings.showFooter}
          onChange={(checked) => onChange({ showFooter: checked })}
        />
      </div>
    </div>
  );
}

function ChromeToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10">
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`flex h-6 w-10 items-center rounded-full p-1 ring-1 ring-white/15 transition peer-focus-visible:ring-2 peer-focus-visible:ring-sky-200 ${
          checked ? "bg-sky-400" : "bg-white/20"
        }`}
        aria-hidden="true"
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}

const optionalFieldEyeTrackClass =
  "grid w-full grid-cols-[minmax(0,1fr)_28px] items-start gap-x-2";
const optionalFieldEyeCellClass = "flex justify-end self-start pt-0.5";
const builderOptionalFieldScopeClass = "w-full max-w-3xl";

function FieldVisibilityEyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      {visible ? (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </>
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      )}
    </svg>
  );
}

function FieldVisibilityEyeToggle({
  fieldLabel,
  visible,
  onChange,
}: {
  fieldLabel: string;
  visible: boolean;
  onChange: (visible: boolean) => void;
}) {
  const actionLabel = visible
    ? `Hide ${fieldLabel.toLowerCase()}`
    : `Show ${fieldLabel.toLowerCase()}`;

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-pressed={visible}
      title={actionLabel}
      onClick={() => onChange(!visible)}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md transition ${
        visible
          ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
      }`}
    >
      <FieldVisibilityEyeIcon visible={visible} />
    </button>
  );
}

function OptionalBlockField({
  block,
  field,
  onChange,
  label,
  compact = false,
  children,
}: {
  block: PageBlock;
  field: OptionalBlockFieldKey;
  onChange: (block: PageBlock) => void;
  label?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const visible = isBlockFieldVisible(block, field);
  const fieldLabel = label ?? optionalBlockFieldLabels[field];
  const eyeToggle = (
    <FieldVisibilityEyeToggle
      fieldLabel={fieldLabel}
      visible={visible}
      onChange={(checked) =>
        onChange(setBlockFieldVisibility(block, field, checked))
      }
    />
  );

  if (compact) {
    return (
      <div
        className={`${optionalFieldEyeTrackClass} ${visible ? "" : "opacity-70"}`}
      >
        <div className="min-w-0">{children}</div>
        <div className={optionalFieldEyeCellClass}>{eyeToggle}</div>
      </div>
    );
  }

  return (
    <div
      className={`${optionalFieldEyeTrackClass} ${visible ? "" : "opacity-70"}`}
    >
      <div className="min-w-0 space-y-1.5">
        <span className="text-sm font-medium text-slate-700">{fieldLabel}</span>
        {children}
      </div>
      <div className={optionalFieldEyeCellClass}>{eyeToggle}</div>
    </div>
  );
}

function BlockSettingsModal({
  entry,
  onClose,
  onChange,
}: {
  entry: BuilderBlockEntry;
  onClose: () => void;
  onChange: (block: PageBlock) => void;
}) {
  const messages = completionMessagesForBlock(entry.block);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const fieldSelector =
      "textarea:not([disabled]), input:not([disabled]), select:not([disabled])";

    const focusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
    };

    window.setTimeout(() => {
      const dialog = dialogRef.current;
      const firstField = dialog?.querySelector<HTMLElement>(fieldSelector);
      const firstFocusable = focusableElements()[0];
      (firstField ?? firstFocusable ?? dialog)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const items = focusableElements();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-settings-modal-title"
        tabIndex={-1}
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Block settings
            </p>
            <h3
              id="block-settings-modal-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              {blockLabel(entry.block.type)} {entry.blockNumber}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Section {entry.sectionNumber}, column {entry.columnNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                messages.length > 0
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {messages.length > 0 ? "Needs content" : "Ready"}
            </span>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
              aria-label="Close block settings"
              title="Close block settings"
              onClick={onClose}
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <BlockSidebarSettingsPanel block={entry.block} onChange={onChange} />
          {messages.length > 0 && (
            <div className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
            onClick={onClose}
          >
            Apply settings
          </button>
        </div>
      </section>
    </div>
  );
}

function BlockSidebarSettingsPanel({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
}) {
  const { assets, openMediaPicker } = useMediaPicker();
  return (
    <div className="space-y-4">
      {block.type === "rich_text" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.rich_text.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.rich_text.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <TextAreaInput
            label="Body"
            value={editableRichTextBodyText(block)}
            placeholder={richTextBodyPlaceholder(block.variant)}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  body: richTextBodyFromEditableText(block, value),
                },
              })
            }
          />
        </>
      )}

      {block.type === "hero" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.hero.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <TextAreaInput
            label="Headline"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="body"
            label="Body"
            onChange={onChange}
          >
            <TextAreaInput
              hideLabel
              label="Body"
              value={block.props.body}
              maxLength={HERO_BODY_MAX_LENGTH}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, body: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="cta"
            label="CTA"
            onChange={onChange}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="CTA label"
                value={block.props.ctaLabel}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      ctaLabel: value,
                      ctaTrackingName: syncedTrackingName({
                        currentTrackingName: block.props.ctaTrackingName,
                        previousLabel: block.props.ctaLabel,
                        nextLabel: value,
                        fallback: "hero-cta",
                      }),
                    },
                  })
                }
              />
              <TextInput
                label="CTA destination URL"
                value={block.props.ctaHref}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, ctaHref: value },
                  })
                }
              />
              <TextInput
                label="Internal CTA label"
                value={block.props.ctaTrackingName}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, ctaTrackingName: value },
                  })
                }
              />
            </div>
          </OptionalBlockField>
          {block.variant === "split" && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-slate-700">
                  Media library asset
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedMediaAssetLabel(
                    assets,
                    block.props.mediaAssetId,
                    block.props.mediaSrc,
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MediaLibrarySelectButton
                    label="Choose from library"
                    onClick={() =>
                      openMediaPicker({
                        allowedTypes: ["image"],
                        onSelect: (asset) =>
                          onChange(
                            applyMediaAssetToSplitHeroBlock(block, asset),
                          ),
                      })
                    }
                  />
                  {(block.props.mediaAssetId || block.props.mediaSrc) && (
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            mediaAssetId: undefined,
                            mediaSrc: "",
                            mediaAltText: "",
                            mediaCaption: "",
                          },
                        })
                      }
                    >
                      Clear media
                    </button>
                  )}
                </div>
              </div>
              <TextInput
                label="Media path or URL"
                value={block.props.mediaSrc ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      mediaAssetId: undefined,
                      mediaSrc: value,
                    },
                  })
                }
              />
              <TextInput
                label="Media alt text"
                value={block.props.mediaAltText ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, mediaAltText: value },
                  })
                }
              />
              <OptionalBlockField
                block={block}
                field="mediaCaption"
                label="Media caption"
                onChange={onChange}
              >
                <TextInput
                  hideLabel
                  label="Media caption"
                  value={block.props.mediaCaption ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: { ...block.props, mediaCaption: value },
                    })
                  }
                />
              </OptionalBlockField>
              <TextInput
                label="Proof text"
                value={block.props.proofText ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, proofText: value },
                  })
                }
              />
            </div>
          )}
        </>
      )}

      {block.type === "image" && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Media library asset
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMediaAssetLabel(
                assets,
                block.props.assetId,
                block.props.src,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MediaLibrarySelectButton
                label="Choose from library"
                onClick={() =>
                  openMediaPicker({
                    allowedTypes: ["image"],
                    onSelect: (asset) =>
                      onChange(applyMediaAssetToImageBlock(block, asset)),
                  })
                }
              />
              {(block.props.assetId || block.props.src) && (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        assetId: undefined,
                        src: "",
                        altText: "",
                        caption: "",
                        sourceRightsNotes: "",
                      },
                    })
                  }
                >
                  Clear media
                </button>
              )}
            </div>
          </div>
          <TextInput
            label="Image path or URL"
            value={block.props.src}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, src: value },
              })
            }
          />
          <TextInput
            label="Alt text"
            value={block.props.altText}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, altText: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="caption"
            label="Caption"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Caption"
              value={block.props.caption}
              placeholder={blockCanvasPlaceholders.image.caption}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, caption: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Rights notes"
            value={block.props.sourceRightsNotes}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, sourceRightsNotes: value },
              })
            }
          />
        </>
      )}

      {block.type === "cta" && (
        <>
          <TextInput
            label="Button text"
            value={block.props.label}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  label: value,
                  trackingName: syncedTrackingName({
                    currentTrackingName: block.props.trackingName,
                    previousLabel: block.props.label,
                    nextLabel: value,
                    fallback: "cta",
                  }),
                },
              })
            }
          />
          <TextInput
            label="Destination URL"
            value={block.props.href}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, href: value },
              })
            }
          />
          <TextInput
            label="Internal CTA label"
            value={block.props.trackingName}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, trackingName: value },
              })
            }
          />
          <TextInput
            label="Preset ID"
            value={block.props.presetId ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, presetId: value || undefined },
              })
            }
          />
        </>
      )}

      {block.type === "video" && (
        <>
          <OptionalBlockField
            block={block}
            field="title"
            label="Title"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Title"
              value={block.props.title}
              placeholder={blockCanvasPlaceholders.video.title}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, title: value },
                })
              }
            />
          </OptionalBlockField>
          <div>
            <p className="text-sm font-medium text-slate-700">Library video</p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedMediaAssetLabel(
                assets,
                block.props.assetId,
                block.props.url,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MediaLibrarySelectButton
                label="Choose from library"
                onClick={() =>
                  openMediaPicker({
                    allowedTypes: ["video", "embed"],
                    onSelect: (asset) =>
                      onChange(applyMediaAssetToVideoBlock(block, asset)),
                  })
                }
              />
            </div>
          </div>
          <TextInput
            label="URL"
            value={block.props.url}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  assetId: undefined,
                  url: value,
                },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="caption"
            label="Caption"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Caption"
              value={block.props.caption}
              placeholder={blockCanvasPlaceholders.video.caption}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, caption: value },
                })
              }
            />
          </OptionalBlockField>
        </>
      )}

      {block.type === "faq" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.faq.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <FaqItemEditorList key={block.id} block={block} onChange={onChange} />
        </>
      )}

      {block.type === "card_grid" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.card_grid.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <div className="space-y-3">
            {block.props.cards.map((card, cardIndex) => (
              <div
                key={cardItemKey(block.id, cardIndex)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Card {cardIndex + 1}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={miniButtonClass}
                      disabled={cardIndex === 0}
                      onClick={() =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            cards: moveItem(block.props.cards, cardIndex, "up"),
                          },
                        })
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className={miniButtonClass}
                      disabled={cardIndex === block.props.cards.length - 1}
                      onClick={() =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            cards: moveItem(
                              block.props.cards,
                              cardIndex,
                              "down",
                            ),
                          },
                        })
                      }
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClass}
                      onClick={() =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            cards: removeCard(block.props.cards, cardIndex),
                          },
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <TextInput
                  label="Card title"
                  value={card.title}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: updateCard(block.props.cards, cardIndex, {
                          title: value,
                        }),
                      },
                    })
                  }
                />
                <TextAreaInput
                  label="Card body"
                  value={card.body}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: updateCard(block.props.cards, cardIndex, {
                          body: value,
                        }),
                      },
                    })
                  }
                />
                <TextInput
                  label="Card link (optional)"
                  placeholder="Optional destination URL"
                  value={card.href ?? ""}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: {
                        ...block.props,
                        cards: updateCard(block.props.cards, cardIndex, {
                          href: value,
                        }),
                      },
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className={miniButtonClass}
              disabled={block.props.cards.length >= CARD_GRID_MAX_CARDS}
              onClick={(event) => {
                event.currentTarget.blur();
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: appendBlankCard(block.props.cards),
                  },
                });
              }}
            >
              {block.props.cards.length >= CARD_GRID_MAX_CARDS
                ? `${CARD_GRID_MAX_CARDS} card limit reached`
                : "Add card"}
            </button>
          </div>
        </>
      )}

      {block.type === "proof" && (
        <>
          <OptionalBlockField
            block={block}
            field="eyebrow"
            label="Eyebrow"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Eyebrow"
              value={block.props.eyebrow}
              placeholder={blockCanvasPlaceholders.proof.eyebrow}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: value },
                })
              }
            />
          </OptionalBlockField>
          <TextAreaInput
            label="Quote or stat"
            value={block.props.body}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, body: value },
              })
            }
          />
          <OptionalBlockField
            block={block}
            field="name"
            label="Name"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Name"
              value={block.props.name}
              placeholder={blockCanvasPlaceholders.proof.name}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, name: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="context"
            label="Context"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Context"
              value={block.props.context}
              placeholder={blockCanvasPlaceholders.proof.context}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, context: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Proof item ID"
            value={block.props.proofItemId ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, proofItemId: value || undefined },
              })
            }
          />
        </>
      )}

      {block.type === "lead_form" && (
        <>
          <OptionalBlockField
            block={block}
            field="heading"
            label="Heading"
            onChange={onChange}
          >
            <TextInput
              hideLabel
              label="Heading"
              value={block.props.heading}
              placeholder={blockCanvasPlaceholders.lead_form.heading}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: value },
                })
              }
            />
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="body"
            label="Helper copy"
            onChange={onChange}
          >
            <TextAreaInput
              hideLabel
              label="Helper copy"
              value={block.props.body}
              placeholder={blockCanvasPlaceholders.lead_form.body}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, body: value },
                })
              }
            />
          </OptionalBlockField>
          <TextInput
            label="Submit label"
            value={block.props.submitLabel}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  submitLabel: value,
                  trackingName: syncedTrackingName({
                    currentTrackingName: block.props.trackingName,
                    previousLabel: block.props.submitLabel,
                    nextLabel: value,
                    fallback: "lead-form",
                  }),
                },
              })
            }
          />
          <TextInput
            label="Internal form label"
            value={block.props.trackingName}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, trackingName: value },
              })
            }
          />
        </>
      )}
    </div>
  );
}

function FaqItemEditorList({
  block,
  onChange,
}: {
  block: FaqBlock;
  onChange: (block: PageBlock) => void;
}) {
  const [itemKeys, setItemKeys] = useState(() =>
    createLocalEditorKeys("faq", block.props.items.length),
  );

  return (
    <div className="space-y-3">
      {block.props.items.map((item, itemIndex) => (
        <div
          key={itemKeys[itemIndex] ?? `${block.id}-${itemIndex}`}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              FAQ {itemIndex + 1}
            </p>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={() => {
                setItemKeys((current) =>
                  current.filter((_, index) => index !== itemIndex),
                );
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    items: block.props.items.filter(
                      (_, index) => index !== itemIndex,
                    ),
                  },
                });
              }}
            >
              Remove
            </button>
          </div>
          <TextInput
            label="Question"
            value={item.question}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: block.props.items.map((current, index) =>
                    index === itemIndex
                      ? { ...current, question: value }
                      : current,
                  ),
                },
              })
            }
          />
          <TextAreaInput
            label="Answer"
            value={item.answer}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: block.props.items.map((current, index) =>
                    index === itemIndex
                      ? { ...current, answer: value }
                      : current,
                  ),
                },
              })
            }
          />
        </div>
      ))}
      <button
        type="button"
        className={miniButtonClass}
        disabled={block.props.items.length >= FAQ_MAX_ITEMS}
        onClick={() => {
          const nextItems = appendBlankFaq(block.props.items);
          setItemKeys((current) => [
            ...current,
            ...createLocalEditorKeys(
              "faq",
              nextItems.length - block.props.items.length,
            ),
          ]);
          onChange({
            ...block,
            props: {
              ...block.props,
              items: nextItems,
            },
          });
        }}
      >
        {block.props.items.length >= FAQ_MAX_ITEMS
          ? `${FAQ_MAX_ITEMS} FAQ limit reached`
          : "Add FAQ"}
      </button>
    </div>
  );
}

function FaqCanvasItemEditorList({
  block,
  onChange,
}: {
  block: FaqBlock;
  onChange: (block: PageBlock) => void;
}) {
  const items =
    block.props.items.length > 0
      ? block.props.items
      : [{ question: "", answer: "" }];

  return (
    <>
      {items.map((item, itemIndex) => (
        <div key={`${block.id}-faq-canvas-${itemIndex}`} className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              FAQ {itemIndex + 1}
            </p>
            {items.length > 1 && (
              <button
                type="button"
                className={dangerButtonClass}
                onClick={() =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      items: removeFaqItem(block.props.items, itemIndex),
                    },
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
          <TextInput
            label="Question"
            placeholder={blockCanvasPlaceholders.faq.question}
            value={item.question}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: updateFaqItem(block.props.items, itemIndex, {
                    question: value,
                  }),
                },
              })
            }
          />
          <TextAreaInput
            label="Answer"
            placeholder={blockCanvasPlaceholders.faq.answer}
            value={item.answer}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: updateFaqItem(block.props.items, itemIndex, {
                    answer: value,
                  }),
                },
              })
            }
          />
        </div>
      ))}
      <div className="p-5">
        <button
          type="button"
          className={miniButtonClass}
          disabled={block.props.items.length >= FAQ_MAX_ITEMS}
          onClick={() =>
            onChange({
              ...block,
              props: {
                ...block.props,
                items:
                  block.props.items.length === 0
                    ? appendBlankFaq([{ question: "", answer: "" }])
                    : appendBlankFaq(block.props.items),
              },
            })
          }
        >
          {block.props.items.length >= FAQ_MAX_ITEMS
            ? `${FAQ_MAX_ITEMS} FAQ limit reached`
            : "Add FAQ"}
        </button>
      </div>
    </>
  );
}

function SettingsGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SeoReadinessPanel({
  content,
  summary,
  aiProposalResult,
  aiInsertResult,
  aiProposals,
  canRunAiAgent,
  isAiGenerating,
  isAiInserting,
  internalLinkSuggestions,
  linkSuggestionMessage,
  onInsertAiProposalBlocks,
  onApplyInternalLinkSuggestion,
  onAddSuggestedBlock,
  onRunAiAgent,
  onOpenSettings,
  mediaAssetCount,
}: {
  content: PageContent;
  summary: SeoReadinessSummary;
  aiProposalResult: PageAiProposalResult;
  aiInsertResult: PageAiProposalInsertResult;
  aiProposals: AiPageProposalReview[];
  canRunAiAgent: boolean;
  isAiGenerating: boolean;
  isAiInserting: boolean;
  internalLinkSuggestions: InternalLinkSuggestion[];
  linkSuggestionMessage: string | null;
  onInsertAiProposalBlocks: (proposalId: string, blockIds: string[]) => void;
  onApplyInternalLinkSuggestion: (suggestion: InternalLinkSuggestion) => void;
  onAddSuggestedBlock: (type: PageBlock["type"]) => void;
  onRunAiAgent: () => void;
  onOpenSettings: () => void;
  mediaAssetCount: number;
}) {
  const topFindings = [
    ...summary.blockers,
    ...summary.warnings,
    ...summary.opportunities,
  ].slice(0, 6);

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 shadow-sm sm:grid-cols-2">
        {summary.categories.map((category) => (
          <div
            key={category.category}
            className={`bg-white p-5 transition-colors hover:bg-slate-50 ${readinessCategoryClass(
              category.status,
            )}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {friendlyReadinessCategoryLabel(category.category)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${readinessPillClass(
                  category.status,
                )} ring-1 ring-black/5 ring-inset`}
              >
                {labelForReadinessStatus(category.status)}
              </span>
            </div>
            {category.findings[0] ? (
              <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                {category.findings[0].message}
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-400">
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
                  className="text-emerald-500"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Evidence looks clean.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900">
            Action Items
          </h3>
          <span className="text-sm font-medium text-slate-500">
            Highest impact first
          </span>
        </div>

        {topFindings.length > 0 ? (
          <div className="grid gap-4">
            {topFindings.map((finding, index) => (
              <article
                key={`${finding.code}-${finding.path}-${index}`}
                className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full ${findingDotClass(
                      finding.severity,
                    )}`}
                  />
                  <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    {findingSeverityLabel(finding.severity)}
                  </span>
                  <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 ring-inset">
                    {friendlyFindingLocation(finding)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 font-semibold text-slate-900">
                  {finding.message}
                </p>
                {friendlyEvidenceText(finding) && (
                  <p className="mt-1.5 text-sm text-slate-500">
                    {friendlyEvidenceText(finding)}
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <ReadinessFindingAction
                    content={content}
                    finding={finding}
                    onAddSuggestedBlock={onAddSuggestedBlock}
                    onOpenSettings={onOpenSettings}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center text-sm leading-6 text-emerald-800 shadow-sm">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
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
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-emerald-900">
              All clear!
            </h4>
            <p className="mt-1 text-sm text-emerald-700">
              No readiness findings on this draft. Review the public preview
              before publishing.
            </p>
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="text-sm font-semibold text-slate-900">
            Builder support
          </h3>
          <div className="mt-4 grid gap-3">
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <summary className="cursor-pointer font-semibold">
                Media assets
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {mediaAssetCount > 0
                  ? `${mediaAssetCount} approved assets are available from image blocks.`
                  : "No assets yet. Add images, alt text, and rights notes before relying on image blocks."}
              </p>
              <Link
                href="/admin/media"
                className="mt-3 inline-flex text-xs font-semibold text-[#0b63f6] hover:text-slate-950"
              >
                Open full media library
              </Link>
            </details>
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <summary className="cursor-pointer font-semibold">
                Approved claims and CTAs
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Use content libraries for approved source excerpts, proof
                points, claims, and reusable CTA presets. Keep claims
                source-backed before adding them to this draft.
              </p>
              <Link
                href="/admin/libraries"
                className="mt-3 inline-flex text-xs font-semibold text-[#0b63f6] hover:text-slate-950"
              >
                Open content libraries
              </Link>
            </details>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-900">
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
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                SEO agent
              </h3>
              <p className="mt-1 text-xs text-violet-700">
                Source-backed drafts stay separate until selected content is
                inserted.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm ring-1 ring-violet-300 transition-all ring-inset hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canRunAiAgent || isAiGenerating}
              onClick={onRunAiAgent}
            >
              {isAiGenerating
                ? "Running..."
                : canRunAiAgent
                  ? "Run SEO agent"
                  : "Save first"}
            </button>
          </div>
          {aiProposalResult.status !== "idle" && aiProposalResult.message && (
            <p
              className={`mt-4 rounded-lg bg-white px-4 py-3 text-sm font-medium shadow-sm ring-1 ring-inset ${
                aiProposalResult.status === "error"
                  ? "text-red-700 ring-red-200"
                  : "text-emerald-700 ring-emerald-200"
              }`}
            >
              {aiProposalResult.message}
            </p>
          )}
          <AiProposalReviewList
            proposals={aiProposals}
            insertResult={aiInsertResult}
            isInserting={isAiInserting}
            onInsertBlocks={onInsertAiProposalBlocks}
          />
        </div>
      </aside>

      {(internalLinkSuggestions.length > 0 || linkSuggestionMessage) && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-200/60 pb-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-900">
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
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Internal link suggestions
              </h3>
              <p className="mt-1 text-xs text-sky-700">
                Add relevant links from the copy that already exists on this
                page.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-sky-200 ring-inset">
              {internalLinkSuggestions.length} available
            </span>
          </div>

          {linkSuggestionMessage && (
            <p className="mt-4 rounded-lg bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-sky-200 ring-inset">
              {linkSuggestionMessage}
            </p>
          )}

          {internalLinkSuggestions.length > 0 && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {internalLinkSuggestions.slice(0, 4).map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="group flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-sky-200 transition-all ring-inset hover:shadow-md hover:ring-sky-300"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Link &quot;{suggestion.anchorText}&quot;
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                    {suggestion.reason}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="truncate text-xs font-medium text-sky-700">
                      {suggestion.targetPath}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm ring-1 ring-sky-300 transition-all ring-inset hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
                      onClick={() => onApplyInternalLinkSuggestion(suggestion)}
                    >
                      Apply link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReadinessFindingAction({
  content,
  finding,
  onAddSuggestedBlock,
  onOpenSettings,
}: {
  content: PageContent;
  finding: SeoReadinessFinding;
  onAddSuggestedBlock: (type: PageBlock["type"]) => void;
  onOpenSettings: () => void;
}) {
  const suggestedBlock = suggestedBlockForFinding(finding);
  const anchor = anchorForFinding(content, finding);

  if (suggestedBlock) {
    return (
      <button
        type="button"
        className={smallButtonClass}
        onClick={() => onAddSuggestedBlock(suggestedBlock.type)}
      >
        <span className="flex items-center gap-1.5">
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
          {suggestedBlock.label}
        </span>
      </button>
    );
  }

  if (requiresSeoSettings(finding)) {
    return (
      <button
        type="button"
        className={smallButtonClass}
        onClick={onOpenSettings}
      >
        <span className="flex items-center gap-1.5">
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Open SEO settings
        </span>
      </button>
    );
  }

  if (anchor) {
    return (
      <a href={anchor} className={smallButtonClass}>
        <span className="flex items-center gap-1.5">
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
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" x2="21" y1="14" y2="3" />
          </svg>
          Go to field
        </span>
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 ring-inset">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      Review the highlighted area in the editor
    </span>
  );
}

function scrollToBuilderBlockId(blockId: string) {
  window.setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-builder-block-id="${blockId}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
  }, 0);
}

function suggestedBlockForFinding(
  finding: SeoReadinessFinding,
): { type: PageBlock["type"]; label: string } | null {
  if (
    finding.code === "missing_relevant_image" ||
    finding.code === "empty_image_source" ||
    finding.code === "empty_image_alt_text"
  ) {
    return { type: "image", label: "Add image" };
  }
  if (
    finding.code === "missing_faq_opportunity" ||
    finding.code === "empty_faq_block"
  ) {
    return { type: "faq", label: "Add FAQ section" };
  }
  if (
    finding.code === "missing_conversion_block" ||
    finding.code === "empty_cta_label" ||
    finding.code === "empty_cta_link"
  ) {
    return { type: "cta", label: "Add CTA" };
  }
  if (
    finding.code === "missing_supporting_subsections" ||
    finding.code === "content_depth_light"
  ) {
    return { type: "rich_text", label: "Add text section" };
  }
  return null;
}

function anchorForFinding(content: PageContent, finding: SeoReadinessFinding) {
  if (finding.path === "title") return "#page-title-field";
  if (finding.path === "meta_description")
    return "#page-meta-description-field";
  if (finding.path.startsWith("blocks.")) {
    const [, blockIndex] = finding.path.split(".");
    const blockNumber = Number(blockIndex) + 1;
    if (Number.isFinite(blockNumber)) {
      return `#builder-block-${blockNumber}`;
    }
  }
  const globalBlockIndex = globalBlockIndexFromNestedPath(
    content,
    finding.path,
  );
  if (globalBlockIndex !== null) {
    return `#builder-block-${globalBlockIndex + 1}`;
  }
  return null;
}

function requiresSeoSettings(finding: SeoReadinessFinding) {
  return [
    "seo_title",
    "target_keyword",
    "canonical_url",
    "slug",
    "noindex",
    "sitemap_enabled",
  ].some(
    (path) => finding.path === path || finding.path.startsWith(`${path}.`),
  );
}

function friendlyFindingLocation(finding: SeoReadinessFinding) {
  if (finding.path === "slug") return "URL slug";
  if (finding.path === "title") return "Page title";
  if (finding.path === "seo_title") return "SEO title";
  if (finding.path === "target_keyword") return "Target keyword";
  if (finding.path === "meta_description") return "Meta description";
  if (finding.path === "sections") return "Page content";
  if (finding.path.startsWith("blocks.")) {
    const [, blockIndex, , propName, childIndex, childField] =
      finding.path.split(".");
    const blockNumber = Number(blockIndex) + 1;
    const readableProp = friendlyFieldName(childField ?? propName);
    if (childIndex !== undefined && childField) {
      return `Content ${blockNumber} · ${friendlyFieldName(propName)} ${
        Number(childIndex) + 1
      } ${readableProp}`;
    }
    return `Content ${blockNumber} · ${readableProp}`;
  }
  const nestedBlockLocation = friendlyNestedBlockLocation(finding.path);
  if (nestedBlockLocation) return nestedBlockLocation;
  return friendlyFieldName(finding.path);
}

function nestedBlockLocationFromPath(path: string) {
  const match = path.match(/^sections\.(\d+)\.columns\.(\d+)\.blocks\.(\d+)\./);
  if (!match) return null;
  const [, sectionValue, columnValue, blockValue] = match;
  const sectionIndex = Number(sectionValue);
  const columnIndex = Number(columnValue);
  const blockIndex = Number(blockValue);
  if (
    !Number.isFinite(sectionIndex) ||
    !Number.isFinite(columnIndex) ||
    !Number.isFinite(blockIndex)
  ) {
    return null;
  }
  return { sectionIndex, columnIndex, blockIndex };
}

function globalBlockIndexFromNestedPath(content: PageContent, path: string) {
  const target = nestedBlockLocationFromPath(path);
  if (!target) return null;

  let globalIndex = 0;
  for (const [sectionIndex, section] of content.sections.entries()) {
    for (const [columnIndex, column] of section.columns.entries()) {
      if (
        sectionIndex === target.sectionIndex &&
        columnIndex === target.columnIndex
      ) {
        return target.blockIndex < column.blocks.length
          ? globalIndex + target.blockIndex
          : null;
      }
      globalIndex += column.blocks.length;
    }
  }

  return null;
}

function friendlyNestedBlockLocation(path: string) {
  const match = path.match(
    /^sections\.\d+\.columns\.\d+\.blocks\.(\d+)\.props\.([^.]+)(?:\.(\d+)\.([^.]+))?/,
  );
  if (!match) return null;
  const [, blockIndex, propName, childIndex, childField] = match;
  const blockNumber = Number(blockIndex) + 1;
  const readableProp = friendlyFieldName(childField ?? propName);
  if (childIndex !== undefined && childField) {
    return `Content ${blockNumber} · ${friendlyFieldName(propName)} ${
      Number(childIndex) + 1
    } ${readableProp}`;
  }
  return `Content ${blockNumber} · ${readableProp}`;
}

function friendlyReadinessCategoryLabel(
  category: SeoReadinessSummary["categories"][number]["category"],
) {
  if (category === "serp") return "Search result";
  if (category === "schema") return "FAQ help";
  return {
    indexing: "Search visibility",
    content: "Page content",
    links: "Internal links",
    media: "Images",
    conversion: "Enquiries",
    trust: "Trust proof",
  }[category];
}

function nextRequiredPublishStep({
  canPublish,
  hasUnpublishedDraftChanges,
  isPublishedPage,
  summary,
}: {
  canPublish: boolean;
  hasUnpublishedDraftChanges: boolean;
  isPublishedPage: boolean;
  summary: SeoReadinessSummary;
}): NextPublishStep {
  const blocker = summary.blockers[0];
  if (blocker) {
    return {
      title: `Fix ${friendlyActionLocation(blocker)}`,
      detail: blocker.message,
      tone: "blocked",
    };
  }

  if (!canPublish) {
    return {
      title: "Save this draft",
      detail:
        "Saving creates the page record, unlocks the SEO agent, and enables publishing after the checklist is clear.",
      tone: "work",
    };
  }

  const warning = summary.warnings[0];
  if (warning) {
    return {
      title: `Improve ${friendlyActionLocation(warning)}`,
      detail: warning.message,
      tone: "work",
    };
  }

  if (isPublishedPage) {
    return {
      title: hasUnpublishedDraftChanges
        ? "Ready to publish changes"
        : "Published page is live",
      detail: hasUnpublishedDraftChanges
        ? "The live page is unchanged. Publish changes when this draft should replace the current public version."
        : "Save draft changes to keep editing without replacing the live page, then publish when the changes are ready.",
      tone: "ready",
    };
  }

  return {
    title: "Ready to publish",
    detail:
      "No hard blockers remain. Review the public preview, then publish when the page is ready.",
    tone: "ready",
  };
}

function friendlyActionLocation(finding: SeoReadinessFinding) {
  const location = friendlyFindingLocation(finding);
  if (/^[A-Z]{2,}\b/.test(location)) return location;
  return `${location.charAt(0).toLowerCase()}${location.slice(1)}`;
}

function friendlyEvidenceText(finding: SeoReadinessFinding) {
  if (!finding.evidence) return null;
  if (finding.evidence.startsWith("Field: ")) {
    return `Field: ${friendlyFindingLocation(finding)}`;
  }
  return finding.evidence;
}

function friendlyFieldName(value: string | undefined) {
  if (!value) return "Field";
  if (value === "ctaHref" || value === "href") {
    return "Destination URL";
  }
  if (value === "trackingName" || value === "ctaTrackingName") {
    return "Internal CTA label";
  }
  if (value === "canonical_url" || value === "canonicalUrl") {
    return "Preferred URL";
  }
  if (value === "src") return "Image";
  if (value === "altText") return "Alt text";
  if (value === "sourceRightsNotes") return "Rights notes";
  if (value === "assetId") return "Media asset";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function findingSeverityLabel(severity: SeoReadinessFinding["severity"]) {
  if (severity === "blocker") return "Must fix";
  if (severity === "warning") return "Should fix";
  return "Opportunity";
}

type AiReviewProposedBlock = AiPageProposalReview["proposal"]["blocks"][number];

function AiProposalReviewList({
  proposals,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposals: AiPageProposalReview[];
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  if (proposals.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {proposals.slice(0, 3).map((proposal) => (
        <AiProposalReviewCard
          key={proposal.id}
          proposal={proposal}
          insertResult={insertResult}
          isInserting={isInserting}
          onInsertBlocks={onInsertBlocks}
        />
      ))}
    </div>
  );
}

function AiProposalReviewCard({
  proposal,
  insertResult,
  isInserting,
  onInsertBlocks,
}: {
  proposal: AiPageProposalReview;
  insertResult: PageAiProposalInsertResult;
  isInserting: boolean;
  onInsertBlocks: (proposalId: string, blockIds: string[]) => void;
}) {
  const defaultSelectedBlockIds = useMemo(
    () =>
      proposal.proposal.blocks.flatMap((entry) =>
        canInsertAiProposedBlock(entry) ? [entry.block.id] : [],
      ),
    [proposal],
  );
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>(
    defaultSelectedBlockIds,
  );
  const proposalResult =
    insertResult.proposalId === proposal.id ? insertResult : null;
  const isProposed = proposal.status === "proposed";
  const selectableCount = defaultSelectedBlockIds.length;
  const sourceRefCount = proposal.proposal.blocks.reduce(
    (count, entry) => count + aiSourceCount(entry),
    0,
  );
  const warningCount =
    proposal.warnings.length +
    proposal.proposal.blocks.reduce(
      (count, entry) => count + entry.warnings.length,
      0,
    );

  return (
    <article className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-violet-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950">
              AI proposal
            </h4>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {isProposed ? "Ready" : proposal.status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {isProposed
              ? "Review selected content before inserting it into the page."
              : "Already accepted. Check the editor below for duplicate or outdated sections before publishing."}
          </p>
        </div>
        {isProposed && (
          <button
            type="button"
            className={miniButtonClass}
            disabled={isInserting || selectedBlockIds.length === 0}
            onClick={() => onInsertBlocks(proposal.id, selectedBlockIds)}
          >
            {isInserting ? "Inserting..." : "Insert selected content"}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {proposal.proposal.blocks.length}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Items</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">
            {sourceRefCount}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Sources</p>
        </div>
        <div className="rounded-md bg-violet-50 p-2">
          <p className="text-lg font-semibold text-slate-950">{warningCount}</p>
          <p className="text-[11px] font-medium text-slate-500">Warnings</p>
        </div>
      </div>

      {proposal.proposal.metadata.seoTitle && (
        <p className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
          SEO title suggestion:{" "}
          <span className="font-semibold text-slate-800">
            {proposal.proposal.metadata.seoTitle}
          </span>
        </p>
      )}

      {proposalResult?.message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ring-1 ${
            proposalResult.status === "error"
              ? "bg-red-50 text-red-700 ring-red-100"
              : "bg-emerald-50 text-emerald-700 ring-emerald-100"
          }`}
        >
          {proposalResult.message}
        </p>
      )}

      <details className="mt-3 rounded-md border border-violet-100 bg-violet-50/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
          Review content changes · {selectableCount} safe to insert
        </summary>
        <div className="grid gap-2 border-t border-violet-100 p-2">
          {proposal.proposal.blocks.map((entry) => {
            const canInsert = canInsertAiProposedBlock(entry);
            const checked = selectedBlockIds.includes(entry.block.id);
            return (
              <label
                key={entry.block.id}
                className={`flex gap-3 rounded-md border p-3 text-left ${
                  canInsert && isProposed
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-100 bg-slate-50/60 text-slate-400"
                }`}
              >
                <input
                  aria-label={`Insert ${aiBlockReviewTitle(entry.block)}`}
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={!canInsert || !isProposed || isInserting}
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setSelectedBlockIds((current) =>
                      nextChecked
                        ? [...new Set([...current, entry.block.id])]
                        : current.filter((id) => id !== entry.block.id),
                    );
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {blockLabel(entry.block.type)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      {aiSourceCount(entry)} source refs
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-medium text-slate-800">
                    {aiBlockReviewTitle(entry.block)}
                  </span>
                  {aiBlockReviewBody(entry.block) && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">
                      {aiBlockReviewBody(entry.block)}
                    </span>
                  )}
                  {entry.warnings.length > 0 && (
                    <span className="mt-2 block text-xs leading-5 text-amber-700">
                      {entry.warnings
                        .map((warning) => warning.message)
                        .join(" ")}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </details>

      {proposal.warnings.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
          {proposal.warnings.map((warning) => warning.message).join(" ")}
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-400">
          Technical reference
        </summary>
        <p className="mt-1 font-mono text-[11px] break-all text-slate-400">
          {proposal.id}
        </p>
      </details>
    </article>
  );
}

function canInsertAiProposedBlock(entry: AiReviewProposedBlock) {
  return (
    aiSourceCount(entry) > 0 &&
    !entry.warnings.some(
      (warning) =>
        warning.code === "unsupported_claim" || warning.code === "needs_source",
    )
  );
}

function aiSourceCount(entry: AiReviewProposedBlock) {
  return (
    entry.sourceDocumentIds.length +
    entry.sourceExcerptIds.length +
    entry.approvedClaimIds.length
  );
}

function aiBlockReviewTitle(block: PageBlock) {
  if (block.type === "hero") return block.props.heading;
  if (block.type === "rich_text") return block.props.heading;
  if (block.type === "card_grid") return block.props.heading;
  if (block.type === "faq") return block.props.heading;
  if (block.type === "cta") return block.props.label;
  if (block.type === "lead_form") return block.props.heading;
  if (block.type === "proof") return block.props.body;
  if (block.type === "image") return block.props.altText || "Image";
  return block.props.title;
}

function aiBlockReviewBody(block: PageBlock) {
  if (block.type === "hero") return block.props.body;
  if (block.type === "rich_text")
    return richTextDocumentPlainText(block.props.body);
  if (block.type === "card_grid") return block.props.cards[0]?.body ?? "";
  if (block.type === "faq") return block.props.items[0]?.question ?? "";
  if (block.type === "lead_form") return block.props.body;
  if (block.type === "proof") return block.props.context;
  if (block.type === "image") return block.props.caption;
  if (block.type === "video") return block.props.caption;
  return block.props.href;
}

function SortableSectionEditor({
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
              onEditBlockSettings={onEditBlockSettings}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SimpleBlockStackEditor({
  column,
  blockOrdinalById,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockMoveToIndex,
  onBlockDuplicate,
  onBlockRemove,
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
  onEditBlockSettings: (blockId: string) => void;
}) {
  return (
    <div>
      {column.blocks.length === 0 ? (
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
          <h3 className="text-sm font-semibold text-slate-900">
            Blank page body
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Add the next piece of content for this page.
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

function BlockPicker({
  onAddBlock,
}: {
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PageBlock["type"]>(
    blockPickerOptions[0]?.type ?? "rich_text",
  );
  const variantPanelRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    blockPickerOptions.find((option) => option.type === selectedType) ??
    blockPickerOptions[0];

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function selectBlockType(type: PageBlock["type"]) {
    setSelectedType(type);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => {
        variantPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 0);
    }
  }

  return (
    <div className="relative">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 transition-all hover:border-[#0b63f6]/50 hover:bg-slate-50 hover:text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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
      ) : (
        <div
          role="presentation"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/20 px-4 py-4 sm:px-6 lg:py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <dialog
            open
            className="animate-in fade-in slide-in-from-top-2 mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 sm:p-5"
            aria-modal="true"
            aria-labelledby="block-picker-title"
            aria-describedby="block-picker-description"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4
                  id="block-picker-title"
                  className="text-base font-semibold text-slate-950"
                >
                  Add page content
                </h4>
                <p
                  id="block-picker-description"
                  className="mt-1 text-sm text-slate-500"
                >
                  Choose what appears next on the page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close page content picker"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[250px_minmax(0,1fr)] lg:overflow-hidden">
              <div className="flex min-h-[5.25rem] gap-2 overflow-x-auto pb-2 lg:grid lg:max-h-full lg:min-h-0 lg:gap-2 lg:overflow-x-visible lg:overflow-y-auto lg:pr-1 lg:pb-0">
                {blockPickerOptions.map((option) => {
                  const isSelected = option.type === selectedOption.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      data-testid="block-picker-type"
                      data-block-picker-type={option.type}
                      className={`flex min-h-20 min-w-56 items-start gap-3 rounded-lg border p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none lg:min-w-0 ${
                        isSelected
                          ? "border-[#0b63f6]/65 bg-[#f7faff] shadow-sm ring-1 ring-[#0b63f6]/20"
                          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => selectBlockType(option.type)}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 ring-inset ${
                          isSelected
                            ? "bg-white text-[#0b63f6] ring-[#0b63f6]/20"
                            : "bg-slate-50 text-slate-500 ring-slate-200"
                        }`}
                        aria-hidden="true"
                      >
                        <BuilderGlyph name={option.type} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500 sm:text-sm sm:leading-5">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedOption && (
                <div
                  ref={variantPanelRef}
                  className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:overflow-y-auto"
                >
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-slate-950 sm:text-base">
                      Choose {articleFor(selectedOption.label)}{" "}
                      {selectedOption.label.toLowerCase()} layout
                    </h5>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedOption.variants.map((variant) => (
                      <button
                        key={`${selectedOption.type}-${variant.id}`}
                        type="button"
                        data-testid="block-picker-variant"
                        data-block-picker-type={selectedOption.type}
                        data-block-picker-variant={variant.id}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-[#0b63f6]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                        onClick={() => {
                          onAddBlock(selectedOption.type, variant.id);
                          setIsOpen(false);
                        }}
                      >
                        <span
                          className="block h-44 overflow-hidden border-b border-slate-200 bg-[#f5fbff] p-2 sm:h-52 sm:p-3"
                          aria-hidden="true"
                        >
                          <BlockVariantPreviewSkeleton
                            type={selectedOption.type}
                            variant={variant.id}
                          />
                        </span>
                        <span className="block px-4 py-3">
                          <span className="block text-sm font-semibold text-slate-900">
                            {variant.label}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">
                            {variant.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  blockIndex,
  blockNumber,
  blockCount,
  onChange,
  onMove,
  onMoveToIndex,
  onDuplicate,
  onRemove,
  onEditSettings,
}: {
  block: PageBlock;
  blockIndex: number;
  blockNumber: number;
  blockCount: number;
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEditSettings: () => void;
}) {
  const blockCompletionMessages = completionMessagesForBlock(block);
  const completionStatus =
    blockCompletionMessages.length > 0 ? "Needs content" : "Ready";
  const renderInlineContentEditor = true;

  return (
    <article
      id={`builder-block-${blockNumber}`}
      data-builder-block-id={block.id}
      className="group/editor scroll-mt-28 transition-all"
    >
      <div className="relative isolate min-w-0 rounded-[12px] border border-transparent bg-transparent transition-all focus-within:border-[#0b63f6]/50 focus-within:bg-white/80 focus-within:ring-4 focus-within:ring-[#0b63f6]/5 hover:border-slate-300 hover:bg-white/70">
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10">
          <BlockToolbar
            label={`Page content ${blockNumber}`}
            typeLabel={blockLabel(block.type)}
            variantLabel={blockVariantLabel(block)}
            description={blockSummary(block)}
            status={completionStatus}
            statusDetail={
              blockCompletionMessages.length > 0
                ? blockCompletionMessages.join(" ")
                : undefined
            }
            icon={block.type}
            blockIndex={blockIndex}
            blockCount={blockCount}
            onMove={onMove}
            onMoveToIndex={onMoveToIndex}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            onEditSettings={onEditSettings}
          />
        </div>

        {renderInlineContentEditor && (
          <details open className="contents">
            <summary className="hidden text-sm font-semibold text-slate-800">
              Block settings
            </summary>
            <div className="px-3 pt-14 pb-6 sm:px-4">
              {block.type === "rich_text" && (
                <div
                  className={`${builderOptionalFieldScopeClass} px-3 py-7 sm:px-4`}
                >
                  <OptionalBlockField
                    block={block}
                    field="eyebrow"
                    onChange={onChange}
                    compact
                  >
                    <label className="block">
                      <span className="sr-only">Eyebrow</span>
                      <input
                        aria-label="Eyebrow"
                        value={block.props.eyebrow}
                        placeholder={blockCanvasPlaceholders.rich_text.eyebrow}
                        onChange={(event) =>
                          onChange({
                            ...block,
                            props: {
                              ...block.props,
                              eyebrow: event.target.value,
                            },
                          })
                        }
                        className={eyebrowInputClass}
                      />
                    </label>
                  </OptionalBlockField>
                  <OptionalBlockField
                    block={block}
                    field="heading"
                    onChange={onChange}
                    compact
                  >
                    <label className="mt-3 block">
                      <span className="sr-only">Heading</span>
                      <input
                        aria-label="Heading"
                        value={block.props.heading}
                        placeholder={blockCanvasPlaceholders.rich_text.heading}
                        onChange={(event) =>
                          onChange({
                            ...block,
                            props: {
                              ...block.props,
                              heading: event.target.value,
                            },
                          })
                        }
                        className={sectionHeadingInputClass}
                      />
                    </label>
                  </OptionalBlockField>
                  <label className="mt-4 block">
                    <span className="sr-only">Body</span>
                    <textarea
                      aria-label="Body"
                      value={editableRichTextBodyText(block)}
                      placeholder={richTextBodyPlaceholder(block.variant)}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            body: richTextBodyFromEditableText(
                              block,
                              event.target.value,
                            ),
                          },
                        })
                      }
                      rows={5}
                      className={bodyTextareaClass}
                    />
                  </label>
                </div>
              )}

              {block.type === "hero" &&
                (block.variant === "split" ? (
                  <SplitHeroBlockCanvas
                    block={block}
                    onChange={onChange}
                    onEditSettings={onEditSettings}
                  />
                ) : (
                  <HeroInlineContentFields block={block} onChange={onChange} />
                ))}

              {block.type === "image" && (
                <ImageBlockCanvas
                  block={block}
                  onChange={onChange}
                  onEditSettings={onEditSettings}
                />
              )}

              {block.type === "cta" && (
                <div className="px-3 py-4 sm:px-4">
                  <label className="inline-flex min-h-12 max-w-sm items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                    <span className="sr-only">CTA label</span>
                    <input
                      aria-label="CTA label"
                      value={block.props.label}
                      placeholder={blockCanvasPlaceholders.cta.label}
                      onChange={(event) => {
                        const nextLabel = event.target.value;
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            label: nextLabel,
                            trackingName: syncedTrackingName({
                              currentTrackingName: block.props.trackingName,
                              previousLabel: block.props.label,
                              nextLabel,
                              fallback: "cta",
                            }),
                          },
                        });
                      }}
                      className="w-full min-w-28 bg-transparent outline-none placeholder:text-[#111111]/55"
                    />
                  </label>
                </div>
              )}

              {block.type === "video" && (
                <VideoBlockCanvas
                  block={block}
                  onChange={onChange}
                  onEditSettings={onEditSettings}
                />
              )}

              {block.type === "faq" && (
                <>
                  <div
                    className={`${builderOptionalFieldScopeClass} px-3 py-4 sm:px-4`}
                  >
                    <OptionalBlockField
                      block={block}
                      field="heading"
                      onChange={onChange}
                      compact
                    >
                      <label className="block">
                        <span className="sr-only">Heading</span>
                        <input
                          aria-label="Heading"
                          value={block.props.heading}
                          placeholder={blockCanvasPlaceholders.faq.heading}
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                heading: event.target.value,
                              },
                            })
                          }
                          className={sectionHeadingInputClass}
                        />
                      </label>
                    </OptionalBlockField>
                  </div>
                  <div
                    className={`${builderOptionalFieldScopeClass} mt-5 divide-y-2 divide-[#bfeeff] rounded-[10px] border-2 border-[#111111] bg-white px-3 shadow-[7px_7px_0_#55b8e8] sm:px-4`}
                  >
                    <FaqCanvasItemEditorList
                      block={block}
                      onChange={onChange}
                    />
                  </div>
                </>
              )}

              {block.type === "card_grid" && (
                <div className="px-3 py-4 sm:px-4">
                  <div className={builderOptionalFieldScopeClass}>
                    <OptionalBlockField
                      block={block}
                      field="heading"
                      onChange={onChange}
                      compact
                    >
                      <label className="block">
                        <span className="sr-only">Heading</span>
                        <input
                          aria-label="Heading"
                          value={block.props.heading}
                          placeholder={
                            blockCanvasPlaceholders.card_grid.heading
                          }
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                heading: event.target.value,
                              },
                            })
                          }
                          className={sectionHeadingInputClass}
                        />
                      </label>
                    </OptionalBlockField>
                  </div>
                  <div className={cardGridCanvasGridClass(block)}>
                    {block.props.cards.map((card, cardIndex) => (
                      <article
                        key={cardItemKey(block.id, cardIndex)}
                        className={cardGridCanvasCardClass(block, cardIndex)}
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Card {cardIndex + 1}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={miniButtonClass}
                              disabled={cardIndex === 0}
                              onClick={() =>
                                onChange({
                                  ...block,
                                  props: {
                                    ...block.props,
                                    cards: moveItem(
                                      block.props.cards,
                                      cardIndex,
                                      "up",
                                    ),
                                  },
                                })
                              }
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className={miniButtonClass}
                              disabled={
                                cardIndex === block.props.cards.length - 1
                              }
                              onClick={() =>
                                onChange({
                                  ...block,
                                  props: {
                                    ...block.props,
                                    cards: moveItem(
                                      block.props.cards,
                                      cardIndex,
                                      "down",
                                    ),
                                  },
                                })
                              }
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              className={dangerButtonClass}
                              onClick={() =>
                                onChange({
                                  ...block,
                                  props: {
                                    ...block.props,
                                    cards: removeCard(
                                      block.props.cards,
                                      cardIndex,
                                    ),
                                  },
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <TextInput
                          label="Card title"
                          placeholder={blockCanvasPlaceholders.card_grid.title}
                          value={card.title}
                          onChange={(value) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                cards: updateCard(
                                  block.props.cards,
                                  cardIndex,
                                  {
                                    title: value,
                                  },
                                ),
                              },
                            })
                          }
                        />
                        <TextAreaInput
                          label="Card body"
                          placeholder={blockCanvasPlaceholders.card_grid.body}
                          value={card.body}
                          onChange={(value) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                cards: updateCard(
                                  block.props.cards,
                                  cardIndex,
                                  {
                                    body: value,
                                  },
                                ),
                              },
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={onEditSettings}
                          aria-label={`Edit optional link for card ${cardIndex + 1}`}
                          className={`mt-4 inline-flex items-center gap-2 text-sm font-black uppercase focus-visible:ring-2 focus-visible:ring-[#0b63f6]/30 focus-visible:outline-none ${
                            hasEditorText(card.href)
                              ? "text-[#2d9fd6] hover:text-[#111111]"
                              : "text-slate-400 hover:text-[#2d9fd6]"
                          }`}
                        >
                          Learn more
                          {!hasEditorText(card.href) && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase ring-1 ring-slate-200">
                              Optional
                            </span>
                          )}
                        </button>
                      </article>
                    ))}
                    <button
                      type="button"
                      className="group flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed border-[#55b8e8]/70 bg-white p-5 text-center text-sm font-black text-[#0b63f6] uppercase shadow-[5px_5px_0_rgba(85,184,232,0.25)] transition hover:-translate-y-0.5 hover:border-[#0b63f6] hover:bg-[#f7fbff] hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0"
                      disabled={block.props.cards.length >= CARD_GRID_MAX_CARDS}
                      onClick={(event) => {
                        event.currentTarget.blur();
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            cards: appendBlankCard(block.props.cards),
                          },
                        });
                      }}
                    >
                      <span
                        className="flex size-12 items-center justify-center rounded-full border-2 border-current bg-white shadow-sm transition group-hover:scale-105"
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="size-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        >
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      </span>
                      <span>
                        {block.props.cards.length >= CARD_GRID_MAX_CARDS
                          ? `${CARD_GRID_MAX_CARDS} card limit reached`
                          : "Add card"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {block.type === "proof" && (
                <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                  <div className={builderOptionalFieldScopeClass}>
                    <OptionalBlockField
                      block={block}
                      field="eyebrow"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Eyebrow"
                        placeholder={blockCanvasPlaceholders.proof.eyebrow}
                        value={block.props.eyebrow}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, eyebrow: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                  </div>
                  <label className="mt-3 block">
                    <span className="sr-only">Body</span>
                    <textarea
                      aria-label="Body"
                      value={block.props.body}
                      placeholder={blockCanvasPlaceholders.proof.body}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          props: { ...block.props, body: event.target.value },
                        })
                      }
                      rows={3}
                      className="focus:ring-brand-100 w-full bg-transparent text-xl leading-8 font-semibold text-slate-950 outline-none focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:ring-2"
                    />
                  </label>
                  <div
                    className={`${builderOptionalFieldScopeClass} mt-4 space-y-4`}
                  >
                    <OptionalBlockField
                      block={block}
                      field="name"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Name"
                        placeholder={blockCanvasPlaceholders.proof.name}
                        value={block.props.name}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, name: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                    <OptionalBlockField
                      block={block}
                      field="context"
                      onChange={onChange}
                      compact
                    >
                      <TextInput
                        hideLabel
                        label="Context"
                        placeholder={blockCanvasPlaceholders.proof.context}
                        value={block.props.context}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, context: value },
                          })
                        }
                      />
                    </OptionalBlockField>
                  </div>
                </figure>
              )}

              {block.type === "lead_form" && (
                <div className="grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                  <div className={builderOptionalFieldScopeClass}>
                    <OptionalBlockField
                      block={block}
                      field="heading"
                      onChange={onChange}
                      compact
                    >
                      <label className="block">
                        <span className="sr-only">Heading</span>
                        <input
                          aria-label="Heading"
                          value={block.props.heading}
                          placeholder={
                            blockCanvasPlaceholders.lead_form.heading
                          }
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                heading: event.target.value,
                              },
                            })
                          }
                          className={sectionHeadingInputClass}
                        />
                      </label>
                    </OptionalBlockField>
                    <OptionalBlockField
                      block={block}
                      field="body"
                      onChange={onChange}
                      compact
                    >
                      <label className="mt-3 block">
                        <span className="sr-only">Body</span>
                        <textarea
                          aria-label="Body"
                          value={block.props.body}
                          placeholder={blockCanvasPlaceholders.lead_form.body}
                          onChange={(event) =>
                            onChange({
                              ...block,
                              props: {
                                ...block.props,
                                body: event.target.value,
                              },
                            })
                          }
                          rows={3}
                          className={bodyTextareaClass}
                        />
                      </label>
                    </OptionalBlockField>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={disabledLeadFieldClass}>Full name</div>
                    <div className={disabledLeadFieldClass}>Email</div>
                    <div className={disabledLeadFieldClass}>Phone</div>
                    <div className={disabledLeadFieldClass}>Market</div>
                  </div>
                  <div>
                    <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                      <span className="sr-only">Submit label</span>
                      <input
                        aria-label="Submit label"
                        value={block.props.submitLabel}
                        placeholder={
                          blockCanvasPlaceholders.lead_form.submitLabel
                        }
                        onChange={(event) => {
                          const nextLabel = event.target.value;
                          onChange({
                            ...block,
                            props: {
                              ...block.props,
                              submitLabel: nextLabel,
                              trackingName: syncedTrackingName({
                                currentTrackingName: block.props.trackingName,
                                previousLabel: block.props.submitLabel,
                                nextLabel,
                                fallback: "lead-form",
                              }),
                            },
                          });
                        }}
                        className="w-full min-w-24 bg-transparent outline-none placeholder:text-[#111111]/55"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

const HERO_BODY_MAX_LENGTH = 500;

function EditorCharLimit({ value, max }: { value: string; max: number }) {
  const count = value.length;
  const warnAt = Math.floor(max * 0.8);

  const toneClass =
    count >= max
      ? "font-semibold text-red-600"
      : count >= warnAt
        ? "font-medium text-amber-600"
        : "font-medium text-emerald-600";

  return (
    <p
      aria-live="polite"
      className={`mt-1 text-right text-xs tabular-nums ${toneClass}`}
    >
      {count}/{max}
    </p>
  );
}

function AutoResizeTextarea({
  className,
  value,
  onChange,
  rows = 1,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={textareaRef}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      className={`${className ?? ""} overflow-hidden`}
    />
  );
}

function HeroInlineContentFields({
  block,
  onChange,
  className = `${builderOptionalFieldScopeClass} px-3 py-8 sm:px-4`,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  onChange: (block: PageBlock) => void;
  className?: string;
}) {
  const heroBodyInputId = `${block.id}-hero-body`;

  return (
    <div className={className}>
      <OptionalBlockField
        block={block}
        field="eyebrow"
        onChange={onChange}
        compact
      >
        <label className="block">
          <span className="sr-only">Eyebrow</span>
          <input
            aria-label="Eyebrow"
            value={block.props.eyebrow}
            placeholder={blockCanvasPlaceholders.hero.eyebrow}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, eyebrow: event.target.value },
              })
            }
            className={eyebrowInputClass}
          />
        </label>
      </OptionalBlockField>
      <label className="mt-3 block">
        <span className="sr-only">Heading</span>
        <textarea
          aria-label="Heading"
          value={block.props.heading}
          placeholder={blockCanvasPlaceholders.hero.heading}
          onChange={(event) =>
            onChange({
              ...block,
              props: { ...block.props, heading: event.target.value },
            })
          }
          rows={2}
          className={heroHeadingInputClass}
        />
      </label>
      <OptionalBlockField
        block={block}
        field="body"
        onChange={onChange}
        compact
      >
        <label htmlFor={heroBodyInputId} className="mt-5 block max-w-3xl">
          <span className="sr-only">Body</span>
          <AutoResizeTextarea
            id={heroBodyInputId}
            aria-label="Body"
            value={block.props.body}
            placeholder={blockCanvasPlaceholders.hero.body}
            maxLength={HERO_BODY_MAX_LENGTH}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, body: event.target.value },
              })
            }
            rows={3}
            className={leadInputClass}
          />
          <EditorCharLimit
            value={block.props.body}
            max={HERO_BODY_MAX_LENGTH}
          />
        </label>
      </OptionalBlockField>
      <OptionalBlockField block={block} field="cta" onChange={onChange} compact>
        <div className="mt-8">
          <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
            <span className="sr-only">CTA label</span>
            <input
              aria-label="CTA label"
              value={block.props.ctaLabel}
              placeholder={blockCanvasPlaceholders.hero.ctaLabel}
              onChange={(event) => {
                const nextLabel = event.target.value;
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    ctaLabel: nextLabel,
                    ctaTrackingName: syncedTrackingName({
                      currentTrackingName: block.props.ctaTrackingName,
                      previousLabel: block.props.ctaLabel,
                      nextLabel,
                      fallback: "hero-cta",
                    }),
                  },
                });
              }}
              className="w-full min-w-24 bg-transparent outline-none placeholder:text-[#111111]/55"
            />
          </label>
        </div>
      </OptionalBlockField>
    </div>
  );
}

function SplitHeroBlockCanvas({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const { openMediaPicker } = useMediaPicker();
  const imageClass =
    "aspect-[4/5] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]";
  const mediaNode = block.props.mediaSrc ? (
    <figure>
      <Image
        src={block.props.mediaSrc}
        alt={block.props.mediaAltText ?? ""}
        width={900}
        height={1125}
        sizes="(max-width: 1024px) 100vw, 40vw"
        className={imageClass}
      />
      <OptionalBlockField
        block={block}
        field="mediaCaption"
        onChange={onChange}
        compact
      >
        <label className="mt-4 block">
          <span className="sr-only">Media caption</span>
          <input
            aria-label="Media caption"
            value={block.props.mediaCaption ?? ""}
            placeholder={blockCanvasPlaceholders.hero.mediaCaption}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, mediaCaption: event.target.value },
              })
            }
            className="focus:ring-brand-100 w-full bg-transparent text-sm font-semibold text-slate-600 outline-none focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2"
          />
        </label>
      </OptionalBlockField>
      {!block.props.mediaAltText?.trim() && (
        <p className="mt-2 text-xs text-amber-700">
          Add alt text in block settings before publishing.
        </p>
      )}
    </figure>
  ) : block.props.proofText ? (
    <aside className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
      <p className="text-sm font-black text-[#55b8e8] uppercase">Proof</p>
      <p className="mt-4 text-xl leading-8 font-black text-[#111111]">
        {block.props.proofText}
      </p>
    </aside>
  ) : (
    <MediaDropTarget
      label={blockCanvasPlaceholders.image.dropLabel}
      hint={blockCanvasPlaceholders.image.dropHint}
      className={`${imageClass} border-dashed bg-slate-50 px-4 transition focus-within:ring-4 focus-within:ring-[#0b63f6]/20 hover:border-[#0b63f6]/40 hover:bg-white`}
      onAsset={(asset) =>
        onChange(applyMediaAssetToSplitHeroBlock(block, asset))
      }
      onOpenLibrary={() =>
        openMediaPicker({
          allowedTypes: ["image"],
          onSelect: (asset) =>
            onChange(applyMediaAssetToSplitHeroBlock(block, asset)),
        })
      }
    />
  );

  return (
    <div className="grid items-center gap-10 px-3 py-8 sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <HeroInlineContentFields
        block={block}
        onChange={onChange}
        className="max-w-none p-0"
      />
      <div>{mediaNode}</div>
    </div>
  );
}

function ImageBlockCanvas({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "image" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const { openMediaPicker } = useMediaPicker();
  const imageFrameClass =
    block.variant === "inline"
      ? "grid items-center gap-6 md:grid-cols-[minmax(160px,0.75fr)_minmax(0,1fr)]"
      : block.variant === "feature"
        ? "grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.75fr)]"
        : "";
  const imageClass =
    block.variant === "wide"
      ? "aspect-[16/7] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
      : block.variant === "inline"
        ? "aspect-square w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
        : block.variant === "feature"
          ? "aspect-[4/3] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[9px_9px_0_#55b8e8]"
          : "aspect-video w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]";
  const mediaNode = block.props.src ? (
    <Image
      src={block.props.src}
      alt={block.props.altText}
      width={1600}
      height={900}
      sizes="(max-width: 1024px) 100vw, 900px"
      className={imageClass}
    />
  ) : (
    <MediaDropTarget
      label={blockCanvasPlaceholders.image.dropLabel}
      hint={blockCanvasPlaceholders.image.dropHint}
      className={`${imageClass} border-dashed bg-slate-50 px-4 transition focus-within:ring-4 focus-within:ring-[#0b63f6]/20 hover:border-[#0b63f6]/40 hover:bg-white`}
      onAsset={(asset) => onChange(applyMediaAssetToImageBlock(block, asset))}
      onOpenLibrary={() =>
        openMediaPicker({
          allowedTypes: ["image"],
          onSelect: (asset) =>
            onChange(applyMediaAssetToImageBlock(block, asset)),
        })
      }
    />
  );
  const captionInput = (
    <input
      aria-label="Caption"
      value={block.props.caption}
      placeholder={blockCanvasPlaceholders.image.caption}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, caption: event.target.value },
        })
      }
      className="focus:ring-brand-100 w-full bg-transparent text-sm text-slate-500 outline-none focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2"
    />
  );

  if (block.variant === "feature") {
    return (
      <div className={`px-3 py-4 sm:px-4 ${builderOptionalFieldScopeClass}`}>
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <figure className={imageFrameClass}>
            <figcaption className="text-base leading-7 font-semibold text-slate-600">
              <p className="text-sm font-black text-[#55b8e8] uppercase">
                Featured media
              </p>
              <label className="mt-3 block">
                <span className="sr-only">Caption</span>
                {captionInput}
              </label>
            </figcaption>
            <div className="md:order-2">{mediaNode}</div>
          </figure>
        </OptionalBlockField>
      </div>
    );
  }

  return (
    <figure className={`px-3 py-4 sm:px-4 ${imageFrameClass}`}>
      {mediaNode}
      <div className={builderOptionalFieldScopeClass}>
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <label
            className={block.variant === "inline" ? "block" : "mt-3 block"}
          >
            <span className="sr-only">Caption</span>
            {captionInput}
          </label>
        </OptionalBlockField>
      </div>
    </figure>
  );
}

function VideoBlockCanvas({
  block,
  onChange,
  onEditSettings,
}: {
  block: Extract<PageBlock, { type: "video" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const videoPanel = (
    <button
      type="button"
      onClick={onEditSettings}
      className={`grid place-items-center rounded-[10px] border-2 border-[#111111] bg-[#f5fbff] transition hover:bg-white focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
        block.variant === "wide" ? "aspect-[16/7]" : "aspect-video"
      }`}
    >
      <span className="grid size-14 place-items-center rounded-full border-2 border-[#111111] bg-white shadow-[4px_4px_0_#55b8e8]">
        <span className="sr-only">Edit video settings</span>
        <span className="ml-1 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-[#111111]" />
      </span>
    </button>
  );
  const titleInput = (
    <input
      aria-label="Video title"
      value={block.props.title}
      placeholder={blockCanvasPlaceholders.video.title}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, title: event.target.value },
        })
      }
      className="w-full bg-transparent text-xl font-black text-[#111111] uppercase outline-none placeholder:text-slate-400 focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2 focus:ring-[#0b63f6]/20"
    />
  );
  const captionInput = (
    <textarea
      aria-label="Video caption"
      value={block.props.caption}
      placeholder={blockCanvasPlaceholders.video.caption}
      rows={block.variant === "inline" ? 3 : 2}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, caption: event.target.value },
        })
      }
      className="mt-3 w-full resize-y bg-transparent text-sm leading-7 font-semibold text-slate-600 outline-none placeholder:text-slate-400 focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2 focus:ring-[#0b63f6]/20"
    />
  );
  const watchButton = (
    <button
      type="button"
      onClick={onEditSettings}
      className="mt-3 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/30 focus-visible:outline-none"
    >
      Watch video
    </button>
  );

  if (block.variant === "inline") {
    return (
      <div className="grid items-center gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8] md:grid-cols-[180px_minmax(0,1fr)]">
        {videoPanel}
        <div className={`min-w-0 ${builderOptionalFieldScopeClass}`}>
          <OptionalBlockField
            block={block}
            field="title"
            onChange={onChange}
            compact
          >
            <label className="block">
              <span className="sr-only">Video title</span>
              {titleInput}
            </label>
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="caption"
            onChange={onChange}
            compact
          >
            <label className="block">
              <span className="sr-only">Video caption</span>
              {captionInput}
            </label>
          </OptionalBlockField>
          {watchButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8] ${
        block.variant === "wide" ? "p-6" : "p-5"
      }`}
    >
      {videoPanel}
      <div className={builderOptionalFieldScopeClass}>
        <OptionalBlockField
          block={block}
          field="title"
          onChange={onChange}
          compact
        >
          <label className="mt-5 block">
            <span className="sr-only">Video title</span>
            {titleInput}
          </label>
        </OptionalBlockField>
        {watchButton}
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <label className="block">
            <span className="sr-only">Video caption</span>
            {captionInput}
          </label>
        </OptionalBlockField>
      </div>
    </div>
  );
}

function MovePositionMenu({
  label,
  currentIndex,
  itemCount,
  onMove,
  onMoveToIndex,
  upLabel = "Move up one",
  downLabel = "Move down one",
  positionHeading = "Move to position",
  positionLabel = (index: number) => `Position ${index + 1}`,
  align = "center",
}: {
  label: string;
  currentIndex: number;
  itemCount: number;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  upLabel?: string;
  downLabel?: string;
  positionHeading?: string;
  positionLabel?: (index: number) => string;
  align?: "center" | "start" | "end";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === itemCount - 1;
  const menuAlignClass =
    align === "end"
      ? "right-0"
      : align === "start"
        ? "left-0"
        : "left-1/2 -translate-x-1/2";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <BuilderTooltip
        label="Move"
        detail={`Change where ${label} appears · ${upLabel.toLowerCase()}, ${downLabel.toLowerCase()}, or pick a position`}
        align={align}
      >
        <button
          type="button"
          aria-label={`Move ${label}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={iconButtonClass}
          onClick={() => setIsOpen((open) => !open)}
        >
          <BuilderGlyph name="grip" />
        </button>
      </BuilderTooltip>
      {isOpen && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 absolute z-40 mt-2 min-w-[188px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 ${menuAlignClass}`}
        >
          <button
            type="button"
            className={menuButtonClass}
            disabled={isFirst}
            onClick={() => {
              onMove("up");
              setIsOpen(false);
            }}
          >
            {upLabel}
          </button>
          <button
            type="button"
            className={menuButtonClass}
            disabled={isLast}
            onClick={() => {
              onMove("down");
              setIsOpen(false);
            }}
          >
            {downLabel}
          </button>
          {itemCount > 1 ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <p className="px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                {positionHeading}
              </p>
              {Array.from({ length: itemCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={menuButtonClass}
                  disabled={index === currentIndex}
                  aria-current={index === currentIndex ? "true" : undefined}
                  onClick={() => {
                    onMoveToIndex(index);
                    setIsOpen(false);
                  }}
                >
                  {positionLabel(index)}
                  {index === currentIndex ? " (current)" : ""}
                </button>
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BuilderTooltip({
  label,
  detail,
  children,
  className,
  align = "center",
}: {
  label: string;
  detail?: string;
  children: ReactNode;
  className?: string;
  align?: "center" | "start" | "end";
}) {
  const alignClass =
    align === "start"
      ? "left-0 translate-x-0"
      : align === "end"
        ? "right-0 translate-x-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      className={`group/builder-tooltip relative inline-flex ${className ?? ""}`}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-[calc(100%+0.45rem)] z-30 hidden w-max max-w-64 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-left text-[11px] leading-4 text-white shadow-lg group-focus-within/builder-tooltip:block group-hover/builder-tooltip:block ${alignClass}`}
      >
        <span className="block font-semibold">{label}</span>
        {detail ? (
          <span className="mt-1 block font-normal text-slate-300">
            {detail}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function BlockToolbar({
  label,
  typeLabel,
  variantLabel,
  description,
  status,
  statusDetail,
  icon,
  blockIndex,
  blockCount,
  onMove,
  onMoveToIndex,
  onDuplicate,
  onRemove,
  onEditSettings,
}: {
  label: string;
  typeLabel: string;
  variantLabel: string;
  description: string;
  status: string;
  statusDetail?: string;
  icon: PageBlock["type"];
  blockIndex: number;
  blockCount: number;
  onMove: (direction: MoveDirection) => void;
  onMoveToIndex: (targetIndex: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEditSettings: () => void;
}) {
  const readyDetail = `${label} · ${description}`;
  const variantDetail = `${typeLabel} layout · ${description}${
    status === "Ready" ? " · Ready" : ""
  }`;

  return (
    <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs opacity-100 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5 backdrop-blur transition-all md:opacity-0 md:group-focus-within/editor:opacity-100 md:group-hover/editor:opacity-100">
      <div className="flex min-w-0 items-center gap-3">
        <BuilderTooltip label={`${typeLabel} block`} detail={readyDetail}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200/50 ring-inset"
            aria-label={`${typeLabel} block`}
          >
            <BuilderGlyph name={icon} />
          </span>
        </BuilderTooltip>
        <span className="flex min-w-0 items-center gap-2">
          <BuilderTooltip label={variantLabel} detail={variantDetail}>
            <span className="truncate text-[11px] font-medium text-slate-600">
              {variantLabel}
            </span>
          </BuilderTooltip>
          {status !== "Ready" && (
            <BuilderTooltip label={status} detail={statusDetail ?? description}>
              <span
                className="size-2 shrink-0 rounded-full bg-amber-400"
                aria-label={status}
              />
            </BuilderTooltip>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <MovePositionMenu
            label={label}
            currentIndex={blockIndex}
            itemCount={blockCount}
            onMove={onMove}
            onMoveToIndex={onMoveToIndex}
            align="end"
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <MoreActions
            label="Block actions"
            detail="Edit settings, duplicate, or remove this block"
            align="end"
          >
            <button
              type="button"
              className={menuButtonClass}
              onClick={onEditSettings}
            >
              Edit settings
            </button>
            <button
              type="button"
              className={menuButtonClass}
              onClick={onDuplicate}
            >
              Duplicate content
            </button>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={onRemove}
            >
              Remove content
            </button>
          </MoreActions>
        </div>
      </div>
    </header>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className="block">
      {hideLabel ? null : (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
      />
    </label>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className="block">
      {hideLabel ? null : (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={textareaClass}
      />
      {maxLength !== undefined ? (
        <EditorCharLimit value={value} max={maxLength} />
      ) : null}
    </label>
  );
}

function MoreActions({
  label,
  detail,
  align = "center",
  children,
}: {
  label: string;
  detail?: string;
  align?: "center" | "start" | "end";
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <BuilderTooltip label={label} detail={detail} align={align}>
        <button
          type="button"
          aria-label={label}
          className={iconButtonClass}
          onClick={() => setIsOpen(!isOpen)}
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
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </BuilderTooltip>
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 z-20 mt-2 min-w-[160px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5">
          {children}
        </div>
      )}
    </div>
  );
}

function BuilderGlyph({
  name,
}: {
  name: PageBlock["type"] | "up" | "down" | "more" | "grip";
}) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "size-4",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "up") {
    return (
      <svg {...common}>
        <path d="m6 15 6-6 6 6" />
      </svg>
    );
  }
  if (name === "down") {
    return (
      <svg {...common}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  if (name === "more") {
    return (
      <svg {...common}>
        <path d="M12 5h.01" />
        <path d="M12 12h.01" />
        <path d="M12 19h.01" />
      </svg>
    );
  }
  if (name === "grip") {
    return (
      <svg {...common}>
        <path d="M9 5h.01" />
        <path d="M15 5h.01" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M9 19h.01" />
        <path d="M15 19h.01" />
      </svg>
    );
  }
  if (name === "hero") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 10h10" />
        <path d="M4 15h8" />
        <path d="M4 19h5" />
      </svg>
    );
  }
  if (name === "rich_text") {
    return (
      <svg {...common}>
        <path d="M5 6h14" />
        <path d="M5 11h14" />
        <path d="M5 16h9" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg {...common}>
        <path d="M4 5h16v14H4V5Z" />
        <path d="m5 17 5-5 4 4 2-2 3 3" />
        <path d="M15 9h.01" />
      </svg>
    );
  }
  if (name === "cta") {
    return (
      <svg {...common}>
        <path d="M5 8h14v8H5V8Z" />
        <path d="M9 12h6" />
      </svg>
    );
  }
  if (name === "faq") {
    return (
      <svg {...common}>
        <path d="M12 18h.01" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.8.6-1.6 1.2-1.6 2.6" />
        <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      </svg>
    );
  }
  if (name === "card_grid") {
    return (
      <svg {...common}>
        <path d="M4 5h7v6H4V5Z" />
        <path d="M13 5h7v6h-7V5Z" />
        <path d="M4 13h7v6H4v-6Z" />
        <path d="M13 13h7v6h-7v-6Z" />
      </svg>
    );
  }
  if (name === "proof") {
    return (
      <svg {...common}>
        <path d="m12 3 3 6 6 .9-4.5 4.4 1.1 6.2L12 17l-5.6 3.5 1.1-6.2L3 9.9 9 9l3-6Z" />
      </svg>
    );
  }
  if (name === "video") {
    return (
      <svg {...common}>
        <path d="M4 6h12v12H4V6Z" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 4h12v16H6V4Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </svg>
  );
}

function applyMediaAssetToSplitHeroBlock(
  block: Extract<PageBlock, { type: "hero" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "hero" }> {
  const nextBlock: Extract<PageBlock, { type: "hero" }> = {
    ...block,
    props: {
      ...block.props,
      mediaAssetId: asset.id,
      mediaSrc: asset.publicUrl,
      mediaAltText: asset.altText,
      mediaCaption: asset.caption ?? "",
    },
  };
  return asset.caption
    ? (setBlockFieldVisibility(nextBlock, "mediaCaption", true) as Extract<
        PageBlock,
        { type: "hero" }
      >)
    : nextBlock;
}

function applyMediaAssetToImageBlock(
  block: Extract<PageBlock, { type: "image" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "image" }> {
  return {
    ...block,
    props: {
      ...block.props,
      assetId: asset.id,
      src: asset.publicUrl,
      altText: asset.altText,
      caption: asset.caption ?? block.props.caption,
      sourceRightsNotes: asset.sourceRightsNotes,
    },
  };
}

function applyMediaAssetToVideoBlock(
  block: Extract<PageBlock, { type: "video" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "video" }> {
  return {
    ...block,
    props: {
      ...block.props,
      assetId: asset.id,
      url: asset.publicUrl,
      title: block.props.title || asset.title,
      caption: asset.caption ?? block.props.caption,
    },
  };
}

function selectedMediaAssetLabel(
  assets: EditorMediaAsset[],
  assetId?: string,
  fallbackUrl?: string,
) {
  if (assetId) {
    return (
      assets.find((asset) => asset.id === assetId)?.title ?? "Selected asset"
    );
  }
  if (fallbackUrl) {
    return (
      assets.find((asset) => asset.publicUrl === fallbackUrl)?.title ??
      "Custom media URL"
    );
  }
  return "No asset selected";
}

function parseInitialContent(page: SeoPage | undefined): PageContent {
  const parsed = pageContentSchema.safeParse(
    page?.draft_content ?? createEmptyPageContent(),
  );
  if (!parsed.success) return createEmptyPageContent();
  return parsed.data;
}

function parsePublishedContent(page: SeoPage | undefined): PageContent | null {
  if (!page?.published_content) return null;
  const parsed = pageContentSchema.safeParse(page.published_content);
  if (!parsed.success) return null;
  return parsed.data;
}

function parseInitialDraftSettings(
  page: SeoPage | undefined,
): EditorDraftSettings | null {
  if (!page?.draft_settings) return null;
  const value = page.draft_settings;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const settings = value as Record<string, unknown>;
  const slug = stringSetting(settings.slug);
  const title = stringSetting(settings.title);
  if (!slug || !title) return null;

  return {
    slug,
    title,
    targetKeyword: stringSetting(settings.targetKeyword),
    seoTitle: stringSetting(settings.seoTitle),
    metaDescription: stringSetting(settings.metaDescription),
    canonicalUrl: stringSetting(settings.canonicalUrl),
    noindex: booleanSetting(settings.noindex, page.noindex),
    sitemapEnabled: booleanSetting(
      settings.sitemapEnabled,
      page.sitemap_enabled,
    ),
  };
}

function stringSetting(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function collectBuilderBlockEntries(content: PageContent): BuilderBlockEntry[] {
  const entries: BuilderBlockEntry[] = [];
  let blockNumber = 1;

  for (const [sectionIndex, section] of content.sections.entries()) {
    for (const [columnIndex, column] of section.columns.entries()) {
      for (const block of column.blocks) {
        entries.push({
          sectionId: section.id,
          columnId: column.id,
          block,
          blockNumber,
          sectionNumber: sectionIndex + 1,
          columnNumber: columnIndex + 1,
        });
        blockNumber += 1;
      }
    }
  }

  return entries;
}

function updateSection(
  content: PageContent,
  sectionId: string,
  updater: (section: PageSection) => PageSection,
): PageContent {
  return {
    ...content,
    sections: content.sections.map((section) =>
      section.id === sectionId ? updater(section) : section,
    ),
  };
}

function updateColumn(
  content: PageContent,
  sectionId: string,
  columnId: string,
  updater: (column: PageColumn) => PageColumn,
): PageContent {
  return updateSection(content, sectionId, (section) => ({
    ...section,
    columns: section.columns.map((column) =>
      column.id === columnId ? updater(column) : column,
    ),
  }));
}

function makeBuilderId(prefix: "section" | "column" | "block") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function createPageBlockWithVariant(
  type: PageBlock["type"],
  id: string,
  variant?: BlockVariant,
) {
  const block = createPageBlock(type, id);
  const variantBlock = variant ? withBlockVariant(block, variant) : block;
  return withEditorDefaultsForNewBlock(variantBlock);
}

function withBlockVariant(block: PageBlock, variant: BlockVariant): PageBlock {
  return { ...block, variant } as PageBlock;
}

function withEditorDefaultsForNewBlock(block: PageBlock): PageBlock {
  let nextBlock: PageBlock = block;

  if (block.type === "cta" && !block.props.presetId) {
    nextBlock = {
      ...block,
      props: {
        ...block.props,
        href: block.props.href || "/apply",
        trackingName: block.props.trackingName || "cta",
      },
    };
  } else if (block.type === "lead_form") {
    nextBlock = {
      ...block,
      props: {
        ...block.props,
        trackingName:
          block.props.trackingName ||
          trackingNameForLabel(block.props.submitLabel, "lead-form"),
      },
    };
  } else if (
    block.type === "rich_text" &&
    block.variant === "checklist" &&
    !hasEditorText(richTextDocumentPlainText(block.props.body))
  ) {
    nextBlock = {
      ...block,
      props: {
        ...block.props,
        body: {
          version: 1,
          nodes: [{ type: "list", style: "bullet", items: ["", "", ""] }],
        },
      },
    };
  } else if (
    block.type === "faq" &&
    (block.props.items.length === 0 || block.props.items.every(isBlankFaqItem))
  ) {
    nextBlock = {
      ...block,
      props: {
        ...block.props,
        items: [{ question: "", answer: "" }],
      },
    };
  } else if (
    block.type === "card_grid" &&
    (block.props.cards.length === 0 || block.props.cards.every(isBlankCard))
  ) {
    const cardCount = block.variant === "compact" ? 4 : 3;
    nextBlock = {
      ...block,
      props: {
        ...block.props,
        cards: Array.from({ length: cardCount }, createBlankCard),
      },
    };
  }

  return withDefaultFieldVisibility(nextBlock);
}

function trackingNameForLabel(
  label: string | null | undefined,
  fallback: string,
) {
  return slugify(label ?? "") || fallback;
}

function articleFor(label: string) {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

function syncedTrackingName({
  currentTrackingName,
  previousLabel,
  nextLabel,
  fallback,
}: {
  currentTrackingName: string;
  previousLabel: string;
  nextLabel: string;
  fallback: string;
}) {
  const previousGenerated = trackingNameForLabel(previousLabel, fallback);
  if (
    !hasEditorText(currentTrackingName) ||
    currentTrackingName === previousGenerated
  ) {
    return trackingNameForLabel(nextLabel, fallback);
  }
  return currentTrackingName;
}

function bodyText(block: Extract<PageBlock, { type: "rich_text" }>) {
  return richTextDocumentPlainText(block.props.body);
}

function editableRichTextBodyText(
  block: Extract<PageBlock, { type: "rich_text" }>,
) {
  if (!shouldEditRichTextAsList(block)) {
    return bodyText(block);
  }

  const lines: string[] = [];
  for (const node of block.props.body.nodes) {
    let line: string;
    if (node.type === "list") {
      line = node.items.join("\n");
    } else if (node.type === "paragraph" && "spans" in node) {
      line = node.spans.map((span) => span.text).join("");
    } else {
      line = node.text;
    }
    if (line.length > 0) lines.push(line);
  }
  return lines.join("\n");
}

function richTextBodyFromEditableText(
  block: Extract<PageBlock, { type: "rich_text" }>,
  value: string,
) {
  if (!shouldEditRichTextAsList(block)) {
    return {
      version: 1 as const,
      nodes: [{ type: "paragraph" as const, text: value }],
    };
  }

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim());
  const items = lines.filter((line) => line.length > 0 || lines.length === 1);
  const listItems = items.length > 0 ? items : [""];
  const hasListNode = block.props.body.nodes.some(
    (node) => node.type === "list",
  );

  if (!hasListNode) {
    return {
      version: 1 as const,
      nodes: [
        { type: "list" as const, style: "bullet" as const, items: listItems },
      ],
    };
  }

  return {
    version: 1 as const,
    nodes: block.props.body.nodes.map((node) =>
      node.type === "list" ? { ...node, items: listItems } : node,
    ),
  };
}

function shouldEditRichTextAsList(
  block: Extract<PageBlock, { type: "rich_text" }>,
) {
  return (
    block.variant === "checklist" ||
    block.props.body.nodes.some((node) => node.type === "list")
  );
}

function blockVariantOptions(type: PageBlock["type"]) {
  return (
    blockPickerOptions.find((option) => option.type === type)?.variants ?? []
  );
}

function blockVariantLabel(block: PageBlock) {
  const option = blockVariantOptions(block.type).find(
    (variant) => variant.id === block.variant,
  );
  return option?.label ?? humanizeVariant(block.variant);
}

function humanizeVariant(variant: BlockVariant) {
  return String(variant)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function blockLabel(type: PageBlock["type"]) {
  if (type === "hero") return "Hero";
  if (type === "rich_text") return "Rich text";
  if (type === "image") return "Image";
  if (type === "video") return "Video";
  if (type === "faq") return "FAQ";
  if (type === "card_grid") return "Card grid";
  if (type === "proof") return "Proof";
  if (type === "lead_form") return "Lead form";
  return "CTA";
}

function blockSummary(block: PageBlock) {
  const title = aiBlockReviewTitle(block);
  if (hasEditorText(title)) return title;
  if (block.type === "hero") return "Hero needs a headline";
  if (block.type === "rich_text") return "Text section needs a heading";
  if (block.type === "image") return "Image needs media";
  if (block.type === "cta") return "CTA needs button copy";
  if (block.type === "faq") return "FAQ needs a question";
  if (block.type === "card_grid") return "Card grid missing heading";
  if (block.type === "proof") return "Proof needs a quote or stat";
  if (block.type === "video") return "Video needs a title";
  return "Lead form missing heading";
}

function editorSectionClass(
  background: PageSection["background"],
  spacing: PageSection["spacing"],
) {
  return resourceSectionClass(background, spacing);
}

function editorCanvasDividerClass(showDivider: boolean, spacing: 10 | 14) {
  if (!showDivider) return "";
  const spacingClass = spacing === 10 ? "mt-10 pt-10" : "mt-14 pt-14";
  return `border-t border-dashed border-slate-300 ${spacingClass}`;
}

function columnGridClass(count: number) {
  return resourceColumnGridClass(count);
}

type FaqBlock = Extract<PageBlock, { type: "faq" }>;
type FaqItem = FaqBlock["props"]["items"][number];
type CardGridBlock = Extract<PageBlock, { type: "card_grid" }>;
type CardItem = CardGridBlock["props"]["cards"][number];

function updateFaqItem(
  items: FaqItem[],
  itemIndex: number,
  patch: Partial<FaqItem>,
): FaqItem[] {
  const nextItems = items.length > 0 ? items : [{ question: "", answer: "" }];

  return nextItems.map((item, index) =>
    index === itemIndex ? { ...item, ...patch } : item,
  );
}

function removeFaqItem(items: FaqItem[], itemIndex: number): FaqItem[] {
  const nextItems = items.filter((_, index) => index !== itemIndex);
  return nextItems.length > 0 ? nextItems : [{ question: "", answer: "" }];
}

function appendBlankFaq(items: FaqItem[]): FaqItem[] {
  if (items.length >= FAQ_MAX_ITEMS) return items;
  return [...items, { question: "", answer: "" }];
}

function createBlankCard(): CardItem {
  return { title: "", body: "", href: "" };
}

function appendBlankCard(cards: CardItem[]): CardItem[] {
  if (cards.length >= CARD_GRID_MAX_CARDS) return cards;
  return [...cards, createBlankCard()];
}

function cardGridCanvasGridClass(block: CardGridBlock) {
  if (block.variant === "compact") {
    return "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
  }

  if (block.variant === "feature") {
    return "mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]";
  }

  return "mt-5 grid gap-4 md:grid-cols-3";
}

function cardGridCanvasCardClass(block: CardGridBlock, cardIndex: number) {
  return `rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8] ${
    block.variant === "feature" && cardIndex === 0
      ? "md:row-span-2 md:min-h-64"
      : ""
  } ${block.variant === "compact" ? "p-4" : ""}`;
}

function createLocalEditorKey(prefix: string) {
  localEditorKeyCounter += 1;
  return `${prefix}-${localEditorKeyCounter}`;
}

function createLocalEditorKeys(prefix: string, count: number) {
  return Array.from({ length: count }, () => createLocalEditorKey(prefix));
}

function cardItemKey(blockId: string, cardIndex: number) {
  return `${blockId}-card-${cardIndex}`;
}

function isBlankFaqItem(item: FaqItem) {
  return !hasEditorText(item.question) && !hasEditorText(item.answer);
}

function isBlankCard(card: CardItem) {
  return (
    !hasEditorText(card.title) &&
    !hasEditorText(card.body) &&
    !hasEditorText(card.href)
  );
}

function updateCard(
  cards: CardItem[],
  cardIndex: number,
  patch: Partial<CardItem>,
): CardItem[] {
  return cards.map((card, index) =>
    index === cardIndex ? { ...card, ...patch } : card,
  );
}

function removeCard(cards: CardItem[], cardIndex: number): CardItem[] {
  return cards.filter((_, index) => index !== cardIndex);
}

function completionMessagesForBlock(block: PageBlock) {
  const messages: string[] = [];

  if (block.type === "hero") {
    if (!hasEditorText(block.props.heading)) {
      messages.push("Add a hero headline before publishing.");
    }
    if (
      isBlockFieldVisible(block, "body") &&
      !hasEditorText(block.props.body)
    ) {
      messages.push("Add a short hero summary so the page has a clear lead.");
    }
    if (
      isBlockFieldVisible(block, "cta") &&
      hasEditorText(block.props.ctaLabel) &&
      !hasEditorText(block.props.ctaHref)
    ) {
      messages.push("The hero CTA has button text but no destination.");
    }
    if (
      block.variant === "split" &&
      !hasEditorText(block.props.mediaSrc) &&
      !hasEditorText(block.props.proofText)
    ) {
      messages.push("Add split hero media or proof content.");
    }
  }

  if (block.type === "rich_text") {
    if (
      isBlockFieldVisible(block, "heading") &&
      !hasEditorText(block.props.heading)
    ) {
      messages.push("Add a section heading.");
    }
    if (!hasEditorText(richTextDocumentPlainText(block.props.body))) {
      messages.push("Add body copy for this text section.");
    }
  }

  if (block.type === "image") {
    if (!block.props.assetId && !hasEditorText(block.props.src)) {
      messages.push("Choose an image or remove this content.");
    }
    if (!hasEditorText(block.props.altText)) {
      messages.push("Add descriptive alt text for this image.");
    }
  }

  if (block.type === "video" && !hasEditorText(block.props.url)) {
    messages.push("Add a video URL or remove this content.");
  }

  if (block.type === "cta" && !block.props.presetId) {
    if (!hasEditorText(block.props.label)) {
      messages.push("Add button text for this CTA.");
    }
    if (!hasEditorText(block.props.href)) {
      messages.push("Add a destination for this CTA.");
    }
  }

  if (block.type === "faq") {
    if (block.props.items.length === 0) {
      messages.push("Add at least one FAQ question and answer.");
    }
    for (const [itemIndex, item] of block.props.items.entries()) {
      const itemNumber = itemIndex + 1;
      if (!hasEditorText(item.question)) {
        messages.push(`FAQ ${itemNumber} needs a question.`);
      }
      if (!hasEditorText(item.answer)) {
        messages.push(`FAQ ${itemNumber} needs an answer.`);
      }
    }
  }

  if (block.type === "card_grid") {
    if (block.props.cards.length === 0) {
      messages.push("Add at least one card or remove this content.");
    }
    for (const [cardIndex, card] of block.props.cards.entries()) {
      const cardNumber = cardIndex + 1;
      for (const message of cardCompletionMessages(card)) {
        messages.push(`Card ${cardNumber}: ${message}`);
      }
    }
  }

  if (block.type === "proof" && !hasEditorText(block.props.body)) {
    messages.push("Add the proof quote or stat text.");
  }

  if (block.type === "lead_form") {
    if (
      isBlockFieldVisible(block, "heading") &&
      !hasEditorText(block.props.heading)
    ) {
      messages.push("Add a lead form heading.");
    }
    if (
      isBlockFieldVisible(block, "body") &&
      !hasEditorText(block.props.body)
    ) {
      messages.push("Add lead form helper copy.");
    }
    if (!hasEditorText(block.props.submitLabel)) {
      messages.push("Add submit button text for this form.");
    }
  }

  return messages;
}

function cardCompletionMessages(card: CardItem) {
  const messages: string[] = [];
  if (!hasEditorText(card.title)) messages.push("Add a card title.");
  if (!hasEditorText(card.body)) messages.push("Add a short card description.");
  if (!hasEditorText(card.href)) {
    messages.push("No link set; this card will not send visitors anywhere.");
  }
  return messages;
}

function hasEditorText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelForReadinessStatus(status: SeoReadinessStatus) {
  if (status === "blocked") return "Blocked";
  if (status === "needs_work") return "Needs work";
  if (status === "opportunities") return "Review";
  return "Strong";
}

function readinessPillClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "needs_work") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }
  if (status === "opportunities") {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

function readinessButtonClass(status: SeoReadinessStatus) {
  if (status === "blocked")
    return "border-red-200 bg-white text-red-700 hover:bg-red-50 ring-1 ring-inset ring-red-100";
  if (status === "needs_work") {
    return "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 ring-1 ring-inset ring-amber-100";
  }
  if (status === "opportunities") {
    return "border-sky-200 bg-white text-sky-700 hover:bg-sky-50 ring-1 ring-inset ring-sky-100";
  }
  return "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100";
}

function floatingRailButtonClass(status: SeoReadinessStatus) {
  const base =
    "inline-flex size-10 items-center justify-center rounded-full border bg-white shadow-lg transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none";

  if (status === "blocked") {
    return `${base} border-red-300 text-red-700 ring-4 ring-red-100 shadow-red-200/80`;
  }
  if (status === "needs_work") {
    return `${base} border-amber-300 text-amber-700 ring-4 ring-amber-100 shadow-amber-200/80`;
  }
  if (status === "opportunities") {
    return `${base} border-sky-300 text-sky-700 ring-4 ring-sky-100 shadow-sky-200/80`;
  }
  return `${base} border-emerald-300 text-emerald-700 ring-4 ring-emerald-100 shadow-emerald-200/80`;
}

function readinessCategoryClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "border-l-4 border-l-red-500";
  if (status === "needs_work") return "border-l-4 border-l-amber-500";
  if (status === "opportunities") return "border-l-4 border-l-sky-500";
  return "border-l-4 border-l-emerald-500";
}

function findingDotClass(severity: "blocker" | "warning" | "opportunity") {
  if (severity === "blocker") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

const leadInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-base leading-7 text-slate-600 outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10";

const eyebrowInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold tracking-wider text-indigo-600 uppercase outline-none transition-all placeholder:text-indigo-300 hover:bg-indigo-50/50 focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100";

const heroHeadingInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-3xl font-bold tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10 md:text-4xl";

const sectionHeadingInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-2xl font-bold tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10 md:text-3xl";

const bodyTextareaClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base leading-8 text-slate-600 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10";

const disabledLeadFieldClass =
  "rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-400 shadow-sm";

const compactInputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

const primaryButtonClass =
  "rounded-lg bg-[#0b63f6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0756d6] hover:shadow focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "inline-flex max-w-full items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const miniButtonClass =
  "rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const menuButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none";

const dangerButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:text-red-700 focus-visible:ring-4 focus-visible:ring-red-100 focus-visible:outline-none text-left";

const iconButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
