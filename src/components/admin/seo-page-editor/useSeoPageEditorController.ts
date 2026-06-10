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
import type { FormEvent, RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  acceptAiSeoProposalBlocks,
  autosaveSeoPageDraft,
  createSeoPageDraftForEditor,
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
  builderRoutePrefixOptions,
  defaultRoutePrefixForPageType,
  pagePathForSlug,
} from "@/lib/page-builder/page-paths";
import {
  getPageTemplate,
  pageTypeOptions,
  templateOptionsForPageType,
  type PageTemplateKey,
  type PageTypeId,
} from "@/lib/page-builder/page-templates";
import {
  assessSeoReadiness,
  type SeoReadinessFinding,
  type SeoReadinessStatus,
} from "@/lib/page-builder/seo-readiness";
import {
  defaultSeoAgentProvider,
  type SeoAgentProvider,
} from "@/lib/page-builder/seo-agent-provider";
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
import type {
  PageBuilderAiApplyResult,
  PageBuilderAiToolCall,
} from "@/lib/page-builder/ai-chat";
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
  derivePublishBlockerChecklist,
  type PublishBlockerChecklistItem,
} from "@/components/admin/seo-page-editor/publish-blocker-checklist";
import {
  deriveScheduleStatus,
  type ScheduleStatus,
} from "@/components/admin/seo-page-editor/schedule-status";
import {
  getNarrowEditorServerSnapshot,
  getNarrowEditorSnapshot,
  subscribeToNarrowEditorChange,
} from "@/components/admin/seo-page-editor/editor-responsive";
import { applyPageBuilderAiToolsToEditor } from "@/components/admin/seo-page-editor/editor-ai-tools";
import { buildSeoPageAutosavePayload } from "@/components/admin/seo-page-editor/editor-autosave-payload";
import { buildSeoPageEditorFormData } from "@/components/admin/seo-page-editor/editor-form-data";
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
type PreviewLinkTone = "neutral" | "error";
const emptyInternalLinkTargets: InternalLinkSuggestionTarget[] = [];
const emptyMediaAssets: SeoPageEditorMediaAsset[] = [];
const emptyAiProposals: AiPageProposalReview[] = [];
const autosaveMetadataFieldNames = new Set([
  "internalTags",
  "topicCluster",
  "campaignLabel",
  "funnelStage",
  "reviewPeriodMonths",
  "nextReviewAt",
  "lifecycleStatus",
  "ogTitle",
  "ogDescription",
  "scheduledPublishAt",
  "cancelScheduledPublish",
]);
const builderWalkthroughStorageKey = "page-builder-editor-walkthrough-seen";
type BuilderWalkthroughStep = 1 | 2 | 3;

export function useSeoPageEditorController(
  {
    page,
    internalLinkTargets = emptyInternalLinkTargets,
    mediaAssets = emptyMediaAssets,
    aiProposals = emptyAiProposals,
    savedFromRedirect = false,
    redirectError,
  }: SeoPageEditorControllerProps,
  formRef: RefObject<HTMLFormElement | null>,
) {
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
  const [routePrefix, setRoutePrefix] = useState(
    initialDraftSettings?.routePrefix ??
      page?.route_prefix ??
      defaultRoutePrefixForPageType(page?.page_type),
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
  const [pageType, setPageType] = useState(
    (page?.page_type as PageTypeId | undefined) ?? "resource",
  );
  const [templateKey, setTemplateKey] = useState(
    (page?.template_key as PageTemplateKey | undefined) ?? "blank",
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
  const [metadataAutosaveVersion, setMetadataAutosaveVersion] = useState(0);
  // S3b: id of a draft auto-created for a brand-new page once the user starts
  // typing. `effectivePageId` lets autosave + the form's hidden id treat the
  // freshly-created row like a loaded page, without remounting the editor.
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const isCreatingDraftRef = useRef(false);
  const effectivePageId = page?.id ?? createdDraftId;
  const [aiProposalResult, setAiProposalResult] =
    useState<PageAiProposalResult>(initialAiProposalState);
  const [aiInsertResult, setAiInsertResult] =
    useState<PageAiProposalInsertResult>(initialAiInsertState);
  const [aiAgentProvider, setAiAgentProvider] = useState<SeoAgentProvider>(
    defaultSeoAgentProvider,
  );
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isAiInserting, setIsAiInserting] = useState(false);
  const [isPreviewOpening, setIsPreviewOpening] = useState(false);
  const [previewLinkMessage, setPreviewLinkMessage] = useState<string | null>(
    null,
  );
  const [previewLinkTone, setPreviewLinkTone] =
    useState<PreviewLinkTone>("neutral");
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
  // I2: inline "Cancel scheduled publish" arms a one-shot hidden field, then
  // submits the normal Save action so the existing server cancel path
  // (cancelScheduledPublish -> cancelledScheduledPublishMetadata) runs. No new
  // write path to the scheduler columns is introduced.
  const [isCancellingSchedule, setIsCancellingSchedule] = useState(false);
  const isNarrowEditor = useSyncExternalStore(
    subscribeToNarrowEditorChange,
    getNarrowEditorSnapshot,
    getNarrowEditorServerSnapshot,
  );
  const [mobileEditorPanel, setMobileEditorPanel] =
    useState<MobileEditorPanel>(null);
  const [isDesktopBlockSidebarCollapsed, setIsDesktopBlockSidebarCollapsed] =
    useState(true);
  const [isDesktopSeoSidebarCollapsed, setIsDesktopSeoSidebarCollapsed] =
    useState(false);
  const [hasSelectedNewPageMode, setHasSelectedNewPageMode] = useState(
    Boolean(page?.id),
  );
  const [builderWalkthroughStep, setBuilderWalkthroughStep] =
    useState<BuilderWalkthroughStep | null>(null);
  const showCreationChoiceModal = !page?.id && !hasSelectedNewPageMode;
  const [linkSuggestionMessage, setLinkSuggestionMessage] = useState<
    string | null
  >(null);
  const autosaveReady = useRef(false);
  const autosaveInFlight = useRef<Promise<unknown>>(Promise.resolve());
  const hasRefreshedAfterManualPublish = useRef(false);
  const visibleSlug = slugTouched ? slug : slugify(title);
  const draftContentJson = useMemo(() => JSON.stringify(content), [content]);
  // S3a: snapshot the new-page content baseline once (on mount) so we can
  // detect unsaved edits and guard against navigating away before the first
  // save persists them. useState lazy-init avoids reading a ref during render.
  const [newPageBaselineContentJson] = useState<string | null>(() =>
    page?.id ? null : draftContentJson,
  );
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
        routePrefix !== page?.route_prefix ||
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
  // I2: a draft that is queued for automatic publishing must not read as a
  // plain "Draft" in the collapsed status row — it has a pending future action.
  const scheduleStatus: ScheduleStatus = deriveScheduleStatus(page);
  const publishStateLabel = isPublishedPage
    ? hasUnpublishedDraftChanges
      ? "Published with draft changes"
      : "Published"
    : scheduleStatus.kind === "scheduled"
      ? "Scheduled"
      : scheduleStatus.kind === "failed"
        ? "Schedule failed"
        : (page?.status ?? "Draft");
  const publishStateHelp = isPublishedPage
    ? hasUnpublishedDraftChanges
      ? "The live page is still the last published version. Save draft changes to keep editing later, or publish changes to update the live page."
      : "Saving draft changes keeps the live page unchanged. Publish changes only when this working copy should replace the live page."
    : scheduleStatus.kind === "scheduled"
      ? `This draft is queued to publish automatically on ${scheduleStatus.display}.`
      : scheduleStatus.kind === "failed"
        ? "The scheduled publish did not run. Review the error, then save a new time to retry."
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
        currentPath: visibleSlug
          ? pagePathForSlug(visibleSlug, routePrefix)
          : null,
        targets: internalLinkTargets,
      }),
    [content, internalLinkTargets, page?.id, routePrefix, visibleSlug],
  );
  const buildAutosavePayload = useCallback(() => {
    const formData = formRef.current ? new FormData(formRef.current) : null;

    return buildSeoPageAutosavePayload({
      formData,
      page,
      title,
      slug: visibleSlug,
      routePrefix,
      targetKeyword,
      seoTitle,
      metaDescription,
      canonicalUrl,
      noindex,
      sitemapEnabled,
      structuredDataBreadcrumb,
      structuredDataFaq,
      pageType,
      templateKey,
      content,
    });
  }, [
    canonicalUrl,
    content,
    formRef,
    metaDescription,
    noindex,
    page,
    pageType,
    routePrefix,
    seoTitle,
    sitemapEnabled,
    structuredDataBreadcrumb,
    structuredDataFaq,
    targetKeyword,
    templateKey,
    title,
    visibleSlug,
  ]);
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
  // Single canonical publish-blocker list. The chip count, the rendered
  // checklist, and the disabled Publish button all read from this one list so
  // they can never disagree. It reflects the existing readiness rules plus the
  // pre-existing "save first" precondition — no rule is added or removed here.
  const publishBlockerChecklist = useMemo(
    () =>
      derivePublishBlockerChecklist({
        content,
        summary: seoReadiness,
        canPublish,
      }),
    [canPublish, content, seoReadiness],
  );
  const publishDisabled = publishBlockerChecklist.length > 0;
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
    const form = formRef.current;
    if (!form) return;

    function markMetadataChanged(event: Event) {
      const target = event.target;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        )
      ) {
        return;
      }
      if (!autosaveMetadataFieldNames.has(target.name)) return;
      setMetadataAutosaveVersion((version) => version + 1);
    }

    form.addEventListener("input", markMetadataChanged);
    form.addEventListener("change", markMetadataChanged);
    return () => {
      form.removeEventListener("input", markMetadataChanged);
      form.removeEventListener("change", markMetadataChanged);
    };
  }, [formRef, showCreationChoiceModal]);

  useEffect(() => {
    if (!effectivePageId) return;
    if (!autosaveReady.current) {
      autosaveReady.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      // Serialize requests: the draft save is a blind full-row update, so two
      // overlapping autosaves can commit out of order and silently regress
      // the draft. The payload is built after the previous request settles so
      // each save carries the freshest state.
      autosaveInFlight.current = autosaveInFlight.current
        .catch(() => undefined)
        .then(() =>
          autosaveSeoPageDraft(effectivePageId, buildAutosavePayload()),
        )
        .then(setAutosave)
        .catch((error: unknown) => {
          console.error("seo page autosave failed", error);
          setAutosave({ status: "error", message: "Autosave failed." });
        });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [buildAutosavePayload, effectivePageId, metadataAutosaveVersion]);

  // S3b: once the user starts a brand-new page (a real title exists), create a
  // draft row after a short pause so autosave can take over. Guarded so it
  // fires once and never creates blank rows. URL is swapped to the new id via
  // history (no remount) so a reload lands on the persisted draft.
  useEffect(() => {
    if (page?.id || createdDraftId) return;
    if (title.trim() === "") return;
    const timer = window.setTimeout(async () => {
      if (isCreatingDraftRef.current) return;
      isCreatingDraftRef.current = true;
      try {
        const result = await createSeoPageDraftForEditor({
          title,
          slug: visibleSlug,
          routePrefix,
          targetKeyword: targetKeyword.trim() || undefined,
          seoTitle: seoTitle.trim() || undefined,
          metaDescription: metaDescription.trim() || undefined,
          pageType,
          templateKey,
          draftContent: content,
        });
        if (result.status === "created") {
          setCreatedDraftId(result.pageId);
          autosaveReady.current = true;
          window.history.replaceState(
            null,
            "",
            `/admin/pages/${result.pageId}`,
          );
          setAutosave({ status: "saved", savedAt: new Date().toISOString() });
        } else {
          setAutosave({ status: "error", message: result.message });
        }
      } catch (error) {
        console.error("auto-create draft failed", error);
        setAutosave({ status: "error", message: "Autosave failed." });
      } finally {
        isCreatingDraftRef.current = false;
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    content,
    createdDraftId,
    metaDescription,
    page?.id,
    pageType,
    routePrefix,
    seoTitle,
    targetKeyword,
    templateKey,
    title,
    visibleSlug,
  ]);

  // S3a: a brand-new page has no id yet, so the id-keyed autosave above does
  // not protect it. Warn before a tab close / refresh / external navigation
  // would discard unsaved work typed before the first save creates the row.
  useEffect(() => {
    // Once a draft exists (loaded page or S3b auto-created one) autosave
    // protects the work, so the guard only matters before any row exists.
    if (effectivePageId) return;
    const hasUnsavedNewContent =
      title.trim() !== "" ||
      (slugTouched && slug.trim() !== "") ||
      seoTitle.trim() !== "" ||
      metaDescription.trim() !== "" ||
      targetKeyword.trim() !== "" ||
      (newPageBaselineContentJson !== null &&
        draftContentJson !== newPageBaselineContentJson);
    if (!hasUnsavedNewContent) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    draftContentJson,
    effectivePageId,
    metaDescription,
    newPageBaselineContentJson,
    seoTitle,
    slug,
    slugTouched,
    targetKeyword,
    title,
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
          setPreviewLinkTone("neutral");
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
    aiAgentProvider,
    aiInsertResult,
    aiProposalResult,
    aiProposals,
    applyLinkSuggestion,
    applyPageBuilderAiTools,
    advanceBuilderWalkthrough,
    autosave,
    blockOrdinalById,
    blockSidebarExpandTitle,
    blockSidebarStatus,
    builderBlockEntries,
    builderShellGridClass,
    builderWalkthroughStep,
    canonicalUrl,
    chromeSettings,
    closeBlockSettings,
    confirmAiDeleteBlock,
    content,
    draftContentJson,
    duplicateBlock,
    dismissBuilderWalkthrough,
    editBlockEntry,
    effectivePageId,
    editingBlockEntry,
    finishBuilderWalkthrough,
    focusPublishBlocker,
    formAction,
    focusSeoSetting,
    isCancellingSchedule,
    handleEditorFormSubmit,
    insertAiProposalBlocks,
    insertDocumentImportBlocks,
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
    onChoosePageTemplate,
    openLivePreview,
    page,
    pageType,
    pageTypeOptions,
    routePrefix,
    routePrefixOptions: builderRoutePrefixOptions,
    previewLinkMessage,
    previewLinkPath,
    previewLinkTone,
    primaryColumn,
    primarySection,
    publishBlockerChecklist,
    publishButtonLabel,
    publishDisabled,
    publishStateHelp,
    publishStateLabel,
    removeBlock,
    removeColumn,
    removeSection,
    replaceBlock,
    redirectError,
    requestCancelSchedule,
    runAiSeoAgent,
    scheduleStatus,
    saveDraftLabel,
    saveMessage,
    savedFromRedirect,
    selectBlockEntry,
    seoReadiness,
    seoSidebarExpandTitle,
    seoTitle,
    selectedBlockId,
    selectedBlockEntry,
    setCanonicalUrl,
    setEditingBlockId,
    setMetaDescription,
    setAiAgentProvider,
    setMobileEditorPanel,
    setNoindex,
    setRoutePrefix,
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
    templateKey,
    templateOptions: templateOptionsForPageType(pageType),
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
    setPreviewLinkTone("neutral");
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
    }

    try {
      const previewResult = effectivePageId
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
      setPreviewLinkTone("error");
      setPreviewLinkMessage(
        previewResult.message ?? "Could not open live preview.",
      );
    } catch (error) {
      console.error("failed to open live preview", error);
      previewWindow?.close();
      setPreviewLinkTone("error");
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

  function shouldOfferBuilderWalkthrough() {
    if (page?.id) return false;
    try {
      return !window.localStorage.getItem(builderWalkthroughStorageKey);
    } catch {
      return false;
    }
  }

  function applyWalkthroughPanelLayout(step: BuilderWalkthroughStep) {
    if (step === 1) {
      if (isNarrowEditor) {
        setMobileEditorPanel("blocks");
      } else {
        setIsDesktopBlockSidebarCollapsed(false);
      }
      return;
    }

    if (step === 2) {
      if (isNarrowEditor) {
        setMobileEditorPanel("seo");
      } else {
        setIsDesktopSeoSidebarCollapsed(false);
      }
      return;
    }

    if (isNarrowEditor) {
      setMobileEditorPanel(null);
    } else {
      setIsDesktopBlockSidebarCollapsed(true);
      setIsDesktopSeoSidebarCollapsed(true);
    }
  }

  function completeBuilderWalkthrough() {
    try {
      window.localStorage.setItem(builderWalkthroughStorageKey, "1");
    } catch {
      // Ignore private browsing storage failures.
    }
  }

  function advanceBuilderWalkthrough() {
    if (builderWalkthroughStep === 1) {
      applyWalkthroughPanelLayout(2);
      setBuilderWalkthroughStep(2);
      return;
    }

    if (builderWalkthroughStep === 2) {
      applyWalkthroughPanelLayout(3);
      setBuilderWalkthroughStep(3);
    }
  }

  function finishBuilderWalkthrough() {
    completeBuilderWalkthrough();
    setBuilderWalkthroughStep(null);
  }

  function dismissBuilderWalkthrough() {
    completeBuilderWalkthrough();
    setBuilderWalkthroughStep(null);
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

  function requestCancelSchedule() {
    if (isCancellingSchedule) return;
    setIsCancellingSchedule(true);
    // Render the armed hidden field (next frame), submit the standard Save so
    // the server runs the existing cancel path, then disarm on the following
    // frame. requestSubmit() serializes the form synchronously, so the hidden
    // field is captured before we disarm — and it never lingers into later
    // saves.
    window.requestAnimationFrame(() => {
      const form = formRef.current;
      const saveButton = form?.querySelector<HTMLButtonElement>(
        'button[type="submit"][name="intent"][value="save"]',
      );
      if (form && saveButton) {
        form.requestSubmit(saveButton);
      }
      window.requestAnimationFrame(() => setIsCancellingSchedule(false));
    });
  }

  function focusPublishBlocker(item: PublishBlockerChecklistItem) {
    const { target } = item;
    if (target.kind === "save-first") {
      // The Save draft control lives in the top rail (outside this panel). Move
      // focus to it so keyboard users land on the action that clears this step.
      window.requestAnimationFrame(() => {
        const saveButton = document.querySelector<HTMLElement>(
          'button[name="intent"][value="save"]',
        );
        saveButton?.scrollIntoView({ behavior: "smooth", block: "center" });
        saveButton?.focus();
      });
      return;
    }

    if (target.kind === "field") {
      if (advancedSeoFieldIds.has(target.elementId)) {
        const advancedFields = document.getElementById("advanced-seo-fields");
        if (advancedFields instanceof HTMLDetailsElement) {
          advancedFields.open = true;
        }
      }
      window.requestAnimationFrame(() => {
        const field = document.getElementById(target.elementId);
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        field?.focus();
      });
      return;
    }

    if (target.kind === "block-modal") {
      const entry = builderBlockEntries[target.blockIndex];
      if (entry) {
        editBlockEntry(entry);
      }
      return;
    }

    // anchor target: scroll the canvas to the referenced block.
    const elementId = target.anchor.replace(/^#/, "");
    window.requestAnimationFrame(() => {
      document
        .getElementById(elementId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function focusSeoSetting(finding: SeoReadinessFinding) {
    const targetId = seoSettingFieldId(finding.path);
    if (advancedSeoFieldIds.has(targetId)) {
      const advancedFields = document.getElementById("advanced-seo-fields");
      if (advancedFields instanceof HTMLDetailsElement) {
        advancedFields.open = true;
      }
    }
    window.requestAnimationFrame(() => {
      const field = document.getElementById(targetId);
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus();
    });
  }

  async function createPreviewLinkForSavedPage() {
    const previewPageId = effectivePageId;
    if (!previewPageId) {
      return saveSeoPageDraftAndCreatePreviewLink(
        { status: "idle" },
        buildPageFormData(),
      );
    }

    const autosaveResult = await autosaveSeoPageDraft(
      previewPageId,
      buildAutosavePayload(),
    );

    if (autosaveResult.status === "error") {
      return { status: "error" as const, message: autosaveResult.message };
    }

    const formData = new FormData();
    formData.set("pageId", previewPageId);
    return createSeoPagePreviewLink({ status: "idle" }, formData);
  }

  function buildPageFormData() {
    return buildSeoPageEditorFormData({
      pageId: effectivePageId,
      title,
      slug: visibleSlug,
      routePrefix,
      targetKeyword,
      seoTitle,
      metaDescription,
      canonicalUrl,
      noindex,
      sitemapEnabled,
      structuredDataBreadcrumb,
      structuredDataFaq,
      pageType,
      templateKey,
      draftContentJson,
    });
  }

  function onChoosePageTemplate(nextPageType: string, nextTemplateKey: string) {
    const template = getPageTemplate(nextPageType, nextTemplateKey);
    setPageType(template.pageType);
    setRoutePrefix(defaultRoutePrefixForPageType(template.pageType));
    setTemplateKey(template.templateKey);
    dispatchContent({ type: "replaceContent", content: template.content });
    setSelectedBlockId(null);
    setEditingBlockId(null);
    setHasSelectedNewPageMode(true);
    if (shouldOfferBuilderWalkthrough()) {
      applyWalkthroughPanelLayout(1);
      setBuilderWalkthroughStep(1);
    }
  }

  function updateChromeSettings(next: Partial<PageChromeSettings>) {
    dispatchContent({ type: "updateChromeSettings", settings: next });
  }

  function addBlock(
    sectionId: string,
    columnId: string,
    type: PageBlock["type"],
    variant?: BlockVariant,
    insertIndex?: number,
  ) {
    const blockId = makeBuilderId("block");
    dispatchContent({
      type: "addBlock",
      sectionId,
      columnId,
      blockType: type,
      blockId,
      variant,
      insertIndex,
    });
    setSelectedBlockId(blockId);
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

  function insertDocumentImportBlocks(blocks: PageBlock[]) {
    if (blocks.length === 0) return;

    const firstSection = content.sections[0];
    const firstColumn = firstSection?.columns[0];
    if (!firstSection || !firstColumn) return;

    const nextContent = {
      ...content,
      sections: content.sections.map((section, sectionIndex) =>
        sectionIndex === 0
          ? {
              ...section,
              columns: section.columns.map((column, columnIndex) =>
                columnIndex === 0
                  ? { ...column, blocks: [...column.blocks, ...blocks] }
                  : column,
              ),
            }
          : section,
      ),
    };
    dispatchContent({ type: "replaceContent", content: nextContent });

    const lastBlockId = blocks.at(-1)?.id;
    if (lastBlockId) {
      setSelectedBlockId(lastBlockId);
      window.setTimeout(() => scrollToBuilderBlockId(lastBlockId), 0);
    }
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

  function applyPageBuilderAiTools(
    toolCalls: PageBuilderAiToolCall[],
  ): PageBuilderAiApplyResult {
    return applyPageBuilderAiToolsToEditor({
      content,
      toolCalls,
      makeBlockId: () => makeBuilderId("block"),
      replaceContent: (nextContent) =>
        dispatchContent({ type: "replaceContent", content: nextContent }),
      setTitle,
      setSlugTouched,
      setSlug,
      setTargetKeyword,
      setSeoTitle,
      setMetaDescription,
      setSelectedBlockId,
      scheduleBlockScroll: (blockId) => {
        window.setTimeout(() => scrollToBuilderBlockId(blockId), 0);
      },
    });
  }

  function confirmAiDeleteBlock(blockId: string) {
    const entry = builderBlockEntries.find((item) => item.block.id === blockId);
    if (!entry) return "Block no longer exists.";

    removeBlock(entry.sectionId, entry.columnId, blockId);
    return "Deleted block.";
  }

  async function runAiSeoAgent() {
    if (!page?.id) {
      setAiProposalResult({
        status: "error",
        message: "Save the draft before running AI.",
      });
      return;
    }

    // S11: explain what the agent does before running it (it can take time and
    // calls an AI model). It only generates a proposal — nothing is published
    // or changed until the user reviews and inserts the suggested blocks.
    const confirmed = window.confirm(
      "Run the SEO agent?\n\nIt analyses this page and generates suggested SEO content and blocks. Nothing is published or changed automatically — you review and choose what to insert. This can take a moment.",
    );
    if (!confirmed) return;

    setIsAiGenerating(true);
    setAiProposalResult({ status: "idle" });
    try {
      const result = await generateAiSeoPageProposal(page.id, aiAgentProvider);
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

const advancedSeoFieldIds = new Set([
  "seo-canonical-url-field",
  "seo-noindex-field",
  "seo-sitemap-enabled-field",
  "seo-structured-data-breadcrumb-field",
  "seo-structured-data-faq-field",
]);

function seoSettingFieldId(path: string) {
  if (path === "title") return "page-title-field";
  if (path === "slug") return "page-slug-field";
  if (path === "seo_title") return "seo-title-field";
  if (path === "target_keyword") return "seo-target-keyword-field";
  if (path === "meta_description") return "page-meta-description-field";
  if (path === "canonical_url") return "seo-canonical-url-field";
  if (path === "noindex") return "seo-noindex-field";
  if (path === "sitemap_enabled") return "seo-sitemap-enabled-field";
  if (path.startsWith("structured_data_settings.breadcrumb")) {
    return "seo-structured-data-breadcrumb-field";
  }
  if (path.startsWith("structured_data_settings.faq")) {
    return "seo-structured-data-faq-field";
  }
  return "seo-target-keyword-field";
}

export type SeoPageEditorController = ReturnType<
  typeof useSeoPageEditorController
>;
