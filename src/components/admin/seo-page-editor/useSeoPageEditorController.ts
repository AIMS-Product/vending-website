"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  pageChromeSettings,
  type PageChromeSettings,
  type PageBlock,
} from "@/lib/page-builder/blocks";
import {
  assessSeoReadiness,
  type SeoReadinessStatus,
} from "@/lib/page-builder/seo-readiness";
import { parseStructuredDataSettings } from "@/lib/page-builder/structured-data-settings";
import {
  applyInternalLinkSuggestion,
  suggestInternalLinks,
  type InternalLinkSuggestion,
  type InternalLinkSuggestionTarget,
} from "@/lib/page-builder/internal-link-suggestions";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import {
  collectBuilderBlockEntries,
  completionMessagesForBlock,
  type BuilderBlockEntry,
  parseInitialContent,
  parseInitialDraftSettings,
  parsePublishedContent,
  slugify,
} from "@/lib/page-builder/editor-helpers";
import {
  createInitialEditorContentState,
  pageEditorContentReducer,
  type MoveDirection,
} from "@/lib/page-builder/editor-state";
import {
  nextRequiredPublishStep,
  scrollToBuilderBlockId,
} from "@/components/admin/seo-page-editor/SeoReadinessHelpers";
import {
  getNarrowEditorServerSnapshot,
  getNarrowEditorSnapshot,
  subscribeToNarrowEditorChange,
} from "@/components/admin/seo-page-editor/editor-responsive";
import { makeBuilderId } from "@/components/admin/seo-page-editor/editor-utils";
import type { Tables } from "@/types/database";

type SeoPage = Tables<"seo_pages">;

export type SeoPageEditorMediaAsset = EditorMediaAsset;

export type SeoPageEditorControllerProps = {
  page?: SeoPage;
  internalLinkTargets?: InternalLinkSuggestionTarget[];
  mediaAssets?: SeoPageEditorMediaAsset[];
  aiProposals?: AiPageProposalReview[];
  savedFromRedirect?: boolean;
  redirectError?: string;
};

type MobileEditorPanel = "blocks" | "seo" | null;
type ManualSubmitIntent = "save" | "publish";

const initialState: PageEditorActionState = { status: "idle" };
const initialAiProposalState: PageAiProposalResult = { status: "idle" };
const initialAiInsertState: PageAiProposalInsertResult = { status: "idle" };
const previewSessionStorageKey = "seo-page-builder-preview-link";
const emptyInternalLinkTargets: InternalLinkSuggestionTarget[] = [];
const emptyMediaAssets: SeoPageEditorMediaAsset[] = [];
const emptyAiProposals: AiPageProposalReview[] = [];

export function useSeoPageEditorController({
  page,
  internalLinkTargets = emptyInternalLinkTargets,
  mediaAssets = emptyMediaAssets,
  aiProposals = emptyAiProposals,
  savedFromRedirect = false,
  redirectError,
}: SeoPageEditorControllerProps) {
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
  const initialStructuredDataSettings = useMemo(
    () =>
      initialDraftSettings?.structuredDataSettings ??
      parseStructuredDataSettings(page?.structured_data_settings),
    [initialDraftSettings, page?.structured_data_settings],
  );
  const [structuredDataBreadcrumb, setStructuredDataBreadcrumb] = useState(
    initialStructuredDataSettings.breadcrumb,
  );
  const [structuredDataFaq, setStructuredDataFaq] = useState(
    initialStructuredDataSettings.faq,
  );
  const [content, dispatchContent] = useReducer(
    pageEditorContentReducer,
    initialContent,
    createInitialEditorContentState,
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
    (() => {
      const pageStructuredDataSettings = parseStructuredDataSettings(
        page?.structured_data_settings,
      );
      return (
        title !== page?.title ||
        visibleSlug !== page?.slug ||
        targetKeyword !== (page?.target_keyword ?? "") ||
        seoTitle !== (page?.seo_title ?? "") ||
        metaDescription !== (page?.meta_description ?? "") ||
        canonicalUrl !== (page?.canonical_url ?? "") ||
        noindex !== page?.noindex ||
        sitemapEnabled !== page?.sitemap_enabled ||
        structuredDataBreadcrumb !== pageStructuredDataSettings.breadcrumb ||
        structuredDataFaq !== pageStructuredDataSettings.faq
      );
    })();
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
        structuredDataSettings: {
          breadcrumb: structuredDataBreadcrumb,
          faq: structuredDataFaq,
        },
      }),
    [
      canonicalUrl,
      content,
      metaDescription,
      noindex,
      seoTitle,
      sitemapEnabled,
      structuredDataBreadcrumb,
      structuredDataFaq,
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
        structuredDataSettings: {
          breadcrumb: structuredDataBreadcrumb,
          faq: structuredDataFaq,
        },
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
    structuredDataBreadcrumb,
    structuredDataFaq,
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

  return {
    addBlock,
    addColumn,
    addSuggestedBlock,
    aiInsertResult,
    aiProposalResult,
    aiProposals,
    applyLinkSuggestion,
    autosave,
    blockOrdinalById,
    blockSidebarExpandTitle,
    blockSidebarStatus,
    builderBlockEntries,
    builderShellGridClass,
    canonicalUrl,
    chromeSettings,
    closeBlockSettings,
    content,
    draftContentJson,
    duplicateBlock,
    editBlockEntry,
    editingBlockEntry,
    formAction,
    focusSeoTargetKeyword,
    handleEditorFormSubmit,
    insertAiProposalBlocks,
    internalLinkSuggestions,
    isAiGenerating,
    isAiInserting,
    isBlockSidebarCollapsed,
    isNarrowEditor,
    isPreviewOpening,
    isPublishedPage,
    isSeoSidebarCollapsed,
    linkSuggestionMessage,
    manualSubmitToast,
    mediaAssets,
    metaDescription,
    moveBlock,
    moveBlockToIndex,
    moveColumn,
    moveColumnToIndex,
    moveSection,
    moveSectionToIndex,
    nextPublishStep,
    noindex,
    onCreateFromScratch: () => setHasSelectedNewPageMode(true),
    openLivePreview,
    page,
    previewLinkMessage,
    previewLinkPath,
    primaryColumn,
    primarySection,
    publishButtonLabel,
    publishDisabled,
    publishStateHelp,
    publishStateLabel,
    removeBlock,
    removeColumn,
    removeSection,
    replaceBlock,
    redirectError,
    runAiSeoAgent,
    saveDraftLabel,
    saveMessage,
    savedFromRedirect,
    selectBlockEntry,
    seoReadiness,
    seoSidebarExpandTitle,
    seoTitle,
    selectedBlockEntry,
    setCanonicalUrl,
    setEditingBlockId,
    setMetaDescription,
    setMobileEditorPanel,
    setNoindex,
    setSelectedBlockId,
    setSeoTitle,
    setSitemapEnabled,
    setSlug,
    setSlugTouched,
    setStructuredDataBreadcrumb,
    setStructuredDataFaq,
    setTargetKeyword,
    setTitle,
    showCreationChoiceModal,
    sitemapEnabled,
    state,
    structuredDataBreadcrumb,
    structuredDataFaq,
    targetKeyword,
    title,
    toggleBlockSidebar,
    toggleSeoSidebar,
    updateChromeSettings,
    updateSlugFromInput,
    usesSimpleBlockStack,
    visibleSlug,
  };

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

  function selectBlockEntry(entry: BuilderBlockEntry) {
    setSelectedBlockId(entry.block.id);
    scrollToBuilderBlockId(entry.block.id);
  }

  function editBlockEntry(entry: BuilderBlockEntry) {
    setSelectedBlockId(entry.block.id);
    setEditingBlockId(entry.block.id);
    scrollToBuilderBlockId(entry.block.id);
  }

  function updateSlugFromInput(nextSlug: string) {
    setSlugTouched(true);
    setSlug(slugify(nextSlug));
  }

  function focusSeoTargetKeyword() {
    document.getElementById("seo-target-keyword-field")?.focus();
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
      structuredDataSettings: {
        breadcrumb: structuredDataBreadcrumb,
        faq: structuredDataFaq,
      },
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
    if (structuredDataBreadcrumb) {
      formData.set("structuredDataBreadcrumb", "on");
    }
    if (structuredDataFaq) {
      formData.set("structuredDataFaq", "on");
    }
    formData.set("draftContent", draftContentJson);
    formData.set("intent", "save");
    return formData;
  }

  function updateChromeSettings(next: Partial<PageChromeSettings>) {
    dispatchContent({ type: "updateChromeSettings", settings: next });
  }

  function addBlock(
    sectionId: string,
    columnId: string,
    type: PageBlock["type"],
    variant?: BlockVariant,
  ) {
    dispatchContent({
      type: "addBlock",
      sectionId,
      columnId,
      blockType: type,
      blockId: makeBuilderId("block"),
      variant,
    });
  }

  function addColumn(sectionId: string) {
    dispatchContent({
      type: "addColumn",
      sectionId,
      columnId: makeBuilderId("column"),
    });
  }

  function addSuggestedBlock(type: PageBlock["type"]) {
    const blockId = makeBuilderId("block");
    dispatchContent({
      type: "addSuggestedBlock",
      blockType: type,
      blockId,
      sectionId: makeBuilderId("section"),
      columnId: makeBuilderId("column"),
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
    dispatchContent({
      type: "replaceBlock",
      sectionId,
      columnId,
      blockId,
      block: next,
    });
  }

  function moveSection(sectionId: string, direction: MoveDirection) {
    dispatchContent({ type: "moveSection", sectionId, direction });
  }

  function moveColumn(
    sectionId: string,
    columnId: string,
    direction: MoveDirection,
  ) {
    dispatchContent({ type: "moveColumn", sectionId, columnId, direction });
  }

  function moveBlock(
    sectionId: string,
    columnId: string,
    blockId: string,
    direction: MoveDirection,
  ) {
    dispatchContent({
      type: "moveBlock",
      sectionId,
      columnId,
      blockId,
      direction,
    });
  }

  function moveBlockToIndex(
    sectionId: string,
    columnId: string,
    blockId: string,
    targetIndex: number,
  ) {
    dispatchContent({
      type: "moveBlockToIndex",
      sectionId,
      columnId,
      blockId,
      targetIndex,
    });
  }

  function duplicateBlock(
    sectionId: string,
    columnId: string,
    blockId: string,
  ) {
    dispatchContent({
      type: "duplicateBlock",
      sectionId,
      columnId,
      blockId,
      nextBlockId: makeBuilderId("block"),
    });
  }

  function removeSection(sectionId: string) {
    dispatchContent({ type: "removeSection", sectionId });
  }

  function removeColumn(sectionId: string, columnId: string) {
    dispatchContent({ type: "removeColumn", sectionId, columnId });
  }

  function removeBlock(sectionId: string, columnId: string, blockId: string) {
    dispatchContent({ type: "removeBlock", sectionId, columnId, blockId });
  }

  function moveSectionToIndex(sectionId: string, targetIndex: number) {
    dispatchContent({ type: "moveSectionToIndex", sectionId, targetIndex });
  }

  function moveColumnToIndex(
    sectionId: string,
    columnId: string,
    targetIndex: number,
  ) {
    dispatchContent({
      type: "moveColumnToIndex",
      sectionId,
      columnId,
      targetIndex,
    });
  }

  function applyLinkSuggestion(suggestion: InternalLinkSuggestion) {
    const result = applyInternalLinkSuggestion(content, suggestion);
    if (!result.applied) {
      setLinkSuggestionMessage(result.reason);
      return;
    }

    dispatchContent({ type: "replaceContent", content: result.content });
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
        dispatchContent({ type: "replaceContent", content: result.content });
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

export type SeoPageEditorController = ReturnType<
  typeof useSeoPageEditorController
>;
