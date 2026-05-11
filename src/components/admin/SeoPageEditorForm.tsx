"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/site/Wordmark";
import {
  ResourcePageBlockView,
  resourceColumnGridClass,
  resourceSectionClass,
} from "@/components/sections/ResourcePageContent";
import {
  acceptAiSeoProposalBlocks,
  autosaveSeoPageDraft,
  createSeoPagePreviewLink,
  generateAiSeoPageProposal,
  saveSeoPage,
  type PageAiProposalInsertResult,
  type PageAiProposalResult,
  type PageAutosaveResult,
  type PageEditorActionState,
} from "@/app/admin/pages/actions";
import type { AiPageProposalReview } from "@/lib/services/ai-page-proposals";
import {
  createEmptyPageContent,
  pageContentSchema,
  richTextDocumentPlainText,
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
  reorderItemsById,
  type MoveDirection,
} from "@/lib/page-builder/content-ops";
import type { Tables } from "@/types/database";
import { footerColumns, primaryNav } from "@/lib/content/nav";

type SeoPage = Tables<"seo_pages">;
type Sensors = ReturnType<typeof useSensors>;

export type SeoPageEditorMediaAsset = {
  id: string;
  title: string;
  altText: string;
  caption: string | null;
  sourceRightsNotes: string;
  publicUrl: string;
};

type SeoPageEditorFormProps = {
  page?: SeoPage;
  internalLinkTargets?: InternalLinkSuggestionTarget[];
  mediaAssets?: SeoPageEditorMediaAsset[];
  aiProposals?: AiPageProposalReview[];
  savedFromRedirect?: boolean;
  redirectError?: string;
};

type BlockVariant = PageBlock["variant"];
type BlockPickerVariantOption = {
  id: BlockVariant;
  label: string;
  description: string;
};
type LayoutPreset =
  | "full_width_hero"
  | "full_width_text"
  | "text_left_image_right"
  | "image_left_text_right"
  | "text_left_cta_right";

type BuilderBlockEntry = {
  sectionId: string;
  columnId: string;
  block: PageBlock;
  blockNumber: number;
  sectionNumber: number;
  columnNumber: number;
};

const initialState: PageEditorActionState = { status: "idle" };
const initialAiProposalState: PageAiProposalResult = { status: "idle" };
const initialAiInsertState: PageAiProposalInsertResult = { status: "idle" };
export function SeoPageEditorForm({
  page,
  internalLinkTargets = [],
  mediaAssets = [],
  aiProposals = [],
  savedFromRedirect = false,
  redirectError,
}: SeoPageEditorFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSeoPage, initialState);
  const initialContent = useMemo(() => parseInitialContent(page), [page]);
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(page?.slug));
  const [targetKeyword, setTargetKeyword] = useState(
    page?.target_keyword ?? "",
  );
  const [seoTitle, setSeoTitle] = useState(page?.seo_title ?? "");
  const [metaDescription, setMetaDescription] = useState(
    page?.meta_description ?? "",
  );
  const [canonicalUrl, setCanonicalUrl] = useState(page?.canonical_url ?? "");
  const [noindex, setNoindex] = useState(page?.noindex ?? false);
  const [sitemapEnabled, setSitemapEnabled] = useState(
    page?.sitemap_enabled ?? true,
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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isBlockSidebarCollapsed, setIsBlockSidebarCollapsed] = useState(false);
  const [isSeoSidebarCollapsed, setIsSeoSidebarCollapsed] = useState(false);
  const [hasSelectedNewPageMode, setHasSelectedNewPageMode] = useState(
    Boolean(page?.id),
  );
  const [linkSuggestionMessage, setLinkSuggestionMessage] = useState<
    string | null
  >(null);
  const autosaveReady = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [isLayoutOptionsOpen, setIsLayoutOptionsOpen] = useState(false);
  const layoutOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        layoutOptionsRef.current &&
        !layoutOptionsRef.current.contains(event.target as Node)
      ) {
        setIsLayoutOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleSlug = slugTouched ? slug : slugify(title);
  const draftContentJson = useMemo(() => JSON.stringify(content), [content]);
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
    summary: seoReadiness,
  });
  const primarySection = content.sections[0] ?? null;
  const primaryColumn = primarySection?.columns[0] ?? null;
  const usesSimpleBlockStack =
    content.sections.length <= 1 && (primarySection?.columns.length ?? 0) <= 1;
  const showCreationChoiceModal = !page?.id && !hasSelectedNewPageMode;
  const saveMessage =
    redirectError ??
    state.message ??
    (state.status === "error" ? "Save failed." : "Draft saved.");
  const builderShellGridClass = `grid min-h-[calc(100dvh-4rem)] gap-4 p-4 lg:min-h-screen ${
    isBlockSidebarCollapsed && isSeoSidebarCollapsed
      ? "xl:grid-cols-[minmax(0,1fr)]"
      : isBlockSidebarCollapsed
        ? "xl:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]"
        : isSeoSidebarCollapsed
          ? "xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]"
          : "xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(380px,440px)]"
  }`;

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

  if (showCreationChoiceModal) {
    return (
      <NewPageChoiceGate
        onCreateFromScratch={() => setHasSelectedNewPageMode(true)}
      />
    );
  }

  return (
    <form action={formAction} className="relative">
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
                  isBlockSidebarCollapsed
                    ? "Expand blocks sidebar"
                    : "Collapse blocks sidebar"
                }
                title={
                  isBlockSidebarCollapsed
                    ? blockSidebarExpandTitle
                    : "Collapse blocks sidebar"
                }
                onClick={() =>
                  setIsBlockSidebarCollapsed((isCollapsed) => !isCollapsed)
                }
              >
                <ChevronIcon
                  direction={isBlockSidebarCollapsed ? "right" : "left"}
                />
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!page?.id || isPreviewOpening}
                title={
                  page?.id
                    ? "Open a live draft preview in a new tab"
                    : "Save the page before opening a live preview"
                }
                onClick={openLivePreview}
              >
                {isPreviewOpening ? "Opening preview..." : "Live preview"}
              </button>
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
                  isSeoSidebarCollapsed
                    ? "Expand SEO sidebar"
                    : "Collapse SEO sidebar"
                }
                title={
                  isSeoSidebarCollapsed
                    ? seoSidebarExpandTitle
                    : "Collapse SEO sidebar"
                }
                onClick={() =>
                  setIsSeoSidebarCollapsed((isCollapsed) => !isCollapsed)
                }
              >
                <ChevronIcon
                  direction={isSeoSidebarCollapsed ? "left" : "right"}
                />
              </button>
            </div>
          </div>
        </div>
        <div className={builderShellGridClass}>
          {!isBlockSidebarCollapsed && (
            <aside className="order-2 flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:order-none xl:h-[calc(100dvh-2rem)] xl:min-h-0">
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
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
                <BuilderBlockSidebar
                  entries={builderBlockEntries}
                  selectedEntry={selectedBlockEntry}
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

          <div className="order-1 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100 shadow-sm xl:order-none xl:h-[calc(100dvh-2rem)]">
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
              <EditorPublicHeader />
              <article className="bg-[#f5fbff]">
                <header className="border-b-2 border-[#111111] bg-[#f5fbff]">
                  <div className="mx-auto max-w-5xl px-5 py-16 lg:px-10">
                    {targetKeyword && (
                      <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
                        {targetKeyword}
                      </p>
                    )}
                    <label className="mt-8 block">
                      <span className="sr-only">Title</span>
                      <textarea
                        name="title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        rows={2}
                        placeholder="Page headline"
                        id="page-title-field"
                        className={headlineInputClass}
                      />
                    </label>
                    <label className="mt-7 block max-w-3xl">
                      <span className="sr-only">Meta description</span>
                      <textarea
                        name="metaDescription"
                        value={metaDescription}
                        onChange={(event) =>
                          setMetaDescription(event.target.value)
                        }
                        rows={3}
                        placeholder="Opening summary shown at the top of the page."
                        id="page-meta-description-field"
                        className={pageLeadInputClass}
                      />
                    </label>
                  </div>
                </header>

                <main className="group/page-body relative mx-auto max-w-5xl px-5 py-14 lg:px-10">
                  <div className="pointer-events-none absolute top-4 right-5 z-30 flex justify-end opacity-0 transition-opacity group-hover/page-body:opacity-100 focus-within:opacity-100 lg:right-10">
                    <div
                      className="pointer-events-auto relative"
                      ref={layoutOptionsRef}
                    >
                      <button
                        type="button"
                        className={`${smallButtonClass} inline-flex items-center gap-2`}
                        onClick={() =>
                          setIsLayoutOptionsOpen(!isLayoutOptionsOpen)
                        }
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
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <path d="M3 9h18" />
                          <path d="M9 21V9" />
                        </svg>
                        Add section
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
                          className={`transition-transform ${isLayoutOptionsOpen ? "rotate-180" : ""}`}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {isLayoutOptionsOpen && (
                        <div className="absolute right-0 z-40 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 focus:outline-none">
                          <div className="px-3 py-2 text-xs font-medium tracking-wider text-slate-500 uppercase">
                            Add page section
                          </div>
                          <div className="space-y-1">
                            {layoutPresetOptions.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                className="group flex w-full flex-col rounded-lg p-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                                onClick={() => {
                                  addLayoutPreset(preset.id);
                                  setIsLayoutOptionsOpen(false);
                                }}
                              >
                                <span className="text-sm font-medium text-slate-900 group-hover:text-[#0b63f6]">
                                  {preset.label}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  {preset.description}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {usesSimpleBlockStack && primarySection && primaryColumn ? (
                    <SimpleBlockStackEditor
                      sectionId={primarySection.id}
                      column={primaryColumn}
                      sensors={sensors}
                      mediaAssets={mediaAssets}
                      blockOrdinalById={blockOrdinalById}
                      onBlockDragEnd={(event) =>
                        handleBlockDragEnd(
                          primarySection.id,
                          primaryColumn.id,
                          event,
                        )
                      }
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
                    />
                  ) : (
                    <DndContext
                      id="seo-page-sections"
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleSectionDragEnd}
                    >
                      <SortableContext
                        items={content.sections.map((section) => section.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-14">
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
                                Add a section to start shaping the page.
                              </p>
                              <button
                                type="button"
                                onClick={() => setIsLayoutOptionsOpen(true)}
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
                                Add first section
                              </button>
                            </div>
                          ) : (
                            content.sections.map((section, index) => (
                              <SortableSectionEditor
                                key={section.id}
                                section={section}
                                sectionIndex={index}
                                sectionCount={content.sections.length}
                                sensors={sensors}
                                mediaAssets={mediaAssets}
                                blockOrdinalById={blockOrdinalById}
                                onSectionMove={(direction) =>
                                  moveSection(section.id, direction)
                                }
                                onSectionRemove={() =>
                                  removeSection(section.id)
                                }
                                onColumnDragEnd={handleColumnDragEnd}
                                onBlockDragEnd={handleBlockDragEnd}
                                onAddColumn={() => addColumn(section.id)}
                                onColumnMove={(columnId, direction) =>
                                  moveColumn(section.id, columnId, direction)
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
                                onBlockDuplicate={(columnId, blockId) =>
                                  duplicateBlock(section.id, columnId, blockId)
                                }
                                onBlockRemove={(columnId, blockId) =>
                                  removeBlock(section.id, columnId, blockId)
                                }
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </main>
              </article>
              <EditorPublicFooter />
            </div>
          </div>

          {!isSeoSidebarCollapsed && (
            <aside className="order-3 flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl xl:sticky xl:top-4 xl:order-none xl:h-[calc(100dvh-2rem)] xl:min-h-0">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    SEO
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">
                    Readiness and publish
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {page?.status ?? "draft"} · SEO {seoReadiness.label}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {seoReadiness.label}
                </span>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Status
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            page?.status === "published"
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {page?.status ?? "draft"}
                      </span>
                    </span>
                  </div>
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
                      value={targetKeyword}
                      id="seo-target-keyword-field"
                      onChange={(event) => setTargetKeyword(event.target.value)}
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
                      value={seoTitle}
                      id="seo-title-field"
                      onChange={(event) => setSeoTitle(event.target.value)}
                      className={compactInputClass}
                      placeholder="Leave blank to use page headline"
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
                          value={canonicalUrl}
                          id="seo-canonical-url-field"
                          onChange={(event) =>
                            setCanonicalUrl(event.target.value)
                          }
                          className={compactInputClass}
                          placeholder="https://..."
                        />
                        <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                          Optional. Use only when this page should point search
                          engines to a different preferred URL.
                        </span>
                      </label>

                      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
                          <input
                            name="noindex"
                            type="checkbox"
                            checked={noindex}
                            onChange={(event) => {
                              setNoindex(event.target.checked);
                              if (event.target.checked)
                                setSitemapEnabled(false);
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6]"
                          />
                          <div>
                            <span className="block text-slate-900">
                              Hide from search engines
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">
                              Use this only for pages that should not appear in
                              search results.
                            </span>
                          </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
                          <input
                            name="sitemapEnabled"
                            type="checkbox"
                            checked={sitemapEnabled}
                            disabled={noindex}
                            onChange={(event) =>
                              setSitemapEnabled(event.target.checked)
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6] disabled:opacity-50"
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

              <div className="grid shrink-0 gap-4 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-5">
                <button
                  className={secondaryButtonClass}
                  name="intent"
                  value="save"
                >
                  Save draft
                </button>
                <button
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
                  Publish
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
      {editingBlockEntry && (
        <BlockSettingsModal
          entry={editingBlockEntry}
          mediaAssets={mediaAssets}
          onClose={() => setEditingBlockId(null)}
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
      <input type="hidden" name="seoTitle" value={seoTitle} />
      <input type="hidden" name="targetKeyword" value={targetKeyword} />
      <input type="hidden" name="canonicalUrl" value={canonicalUrl} />
      {noindex && <input type="hidden" name="noindex" value="on" />}
      {sitemapEnabled && !noindex && (
        <input type="hidden" name="sitemapEnabled" value="on" />
      )}
    </form>
  );

  async function openLivePreview() {
    if (!page?.id || isPreviewOpening) {
      setPreviewLinkMessage("Save the page before opening a live preview.");
      return;
    }

    setIsPreviewOpening(true);
    setPreviewLinkMessage(null);
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
    }

    try {
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
        previewWindow?.close();
        setPreviewLinkMessage(autosaveResult.message);
        return;
      }

      const formData = new FormData();
      formData.set("pageId", page.id);
      const previewResult = await createSeoPagePreviewLink(
        { status: "idle" },
        formData,
      );

      if (previewResult.status === "created") {
        if (previewWindow) {
          previewWindow.location.href = previewResult.previewPath;
        } else {
          setPreviewLinkMessage("Preview created. Allow pop-ups to open it.");
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

  function addLayoutPreset(preset: LayoutPreset) {
    if (preset === "full_width_hero") {
      addSuggestedBlock("hero");
      return;
    }
    if (preset === "full_width_text") {
      addSuggestedBlock("rich_text");
      return;
    }

    setContent((current) => {
      const layoutSection = layoutPresetSection(preset);
      if (isEmptyBuilderContent(current)) {
        return { ...current, sections: [layoutSection] };
      }
      return { ...current, sections: [...current.sections, layoutSection] };
    });
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
    setContent((current) => {
      const firstSection = current.sections[0];
      const firstColumn = firstSection?.columns[0];
      const nextBlock = createPageBlockWithVariant(
        type,
        makeBuilderId("block"),
      );

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

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    setContent((current) => ({
      ...current,
      sections: reorderItemsById(
        current.sections,
        String(active.id),
        String(over.id),
      ),
    }));
  }

  function handleColumnDragEnd(sectionId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    setContent((current) =>
      updateSection(current, sectionId, (section) => ({
        ...section,
        columns: reorderItemsById(
          section.columns,
          String(active.id),
          String(over.id),
        ),
      })),
    );
  }

  function handleBlockDragEnd(
    sectionId: string,
    columnId: string,
    event: DragEndEvent,
  ) {
    const { active, over } = event;
    if (!over) return;
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => ({
        ...column,
        blocks: reorderItemsById(
          column.blocks,
          String(active.id),
          String(over.id),
        ),
      })),
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
      if (result.status === "created") router.refresh();
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
        router.refresh();
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
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-7"
        role="region"
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
      </div>
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
            <ul key={columnIndex} className="space-y-3">
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
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={(event) => event.preventDefault()}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={(event) => event.preventDefault()}
    >
      {item.label}
    </Link>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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
  onSelectBlock,
  onEditBlock,
}: {
  entries: BuilderBlockEntry[];
  selectedEntry: BuilderBlockEntry | null;
  onSelectBlock: (entry: BuilderBlockEntry) => void;
  onEditBlock: (entry: BuilderBlockEntry) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 text-white shadow-xl">
      <div className="border-b border-white/10 px-4 py-4">
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
        <p className="mt-2 text-xs leading-5 text-slate-300">
          Select a block to locate it on the page. Use the settings button to
          edit content in a pop-over.
        </p>
      </div>

      <div className="grid gap-4 p-4">
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
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
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
                    className={`my-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${
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

function BlockSettingsModal({
  entry,
  mediaAssets,
  onClose,
  onChange,
}: {
  entry: BuilderBlockEntry;
  mediaAssets: SeoPageEditorMediaAsset[];
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

    const focusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
    };

    window.setTimeout(() => {
      const dialog = dialogRef.current;
      const firstFocusable = focusableElements()[0];
      (firstFocusable ?? dialog)?.focus();
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
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

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <BlockSidebarSettingsPanel
            block={entry.block}
            mediaAssets={mediaAssets}
            onChange={onChange}
          />
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
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

function BlockSidebarSettingsPanel({
  block,
  mediaAssets,
  onChange,
}: {
  block: PageBlock;
  mediaAssets: SeoPageEditorMediaAsset[];
  onChange: (block: PageBlock) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Layout variant
        </span>
        <select
          value={block.variant}
          onChange={(event) =>
            onChange(
              withEditorDefaultsForNewBlock(
                withBlockVariant(block, event.target.value as BlockVariant),
              ),
            )
          }
          className={compactInputClass}
        >
          {blockVariantOptions(block.type).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {block.type === "rich_text" && (
        <>
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, eyebrow: value },
              })
            }
          />
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <TextAreaInput
            label="Body"
            value={editableRichTextBodyText(block)}
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
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, eyebrow: value },
              })
            }
          />
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
          <TextAreaInput
            label="Body"
            value={block.props.body}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, body: value },
              })
            }
          />
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
              label="CTA href"
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
          {block.variant === "split" && (
            <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <TextInput
                label="Media path or URL"
                value={block.props.mediaSrc ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, mediaSrc: value },
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
              <TextInput
                label="Media caption"
                value={block.props.mediaCaption ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: { ...block.props, mediaCaption: value },
                  })
                }
              />
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
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Media library asset
            </span>
            <select
              value={block.props.assetId ?? ""}
              onChange={(event) => {
                const asset = mediaAssets.find(
                  (item) => item.id === event.target.value,
                );
                onChange(
                  asset
                    ? applyMediaAssetToImageBlock(block, asset)
                    : {
                        ...block,
                        props: {
                          ...block.props,
                          assetId: undefined,
                          src: "",
                          altText: "",
                          caption: "",
                          sourceRightsNotes: "",
                        },
                      },
                );
              }}
              className={compactInputClass}
            >
              <option value="">Choose from media library</option>
              {mediaAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </select>
          </label>
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
          <TextInput
            label="Caption"
            value={block.props.caption}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, caption: value },
              })
            }
          />
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
            label="Href"
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
          <TextInput
            label="Title"
            value={block.props.title}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, title: value },
              })
            }
          />
          <TextInput
            label="URL"
            value={block.props.url}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, url: value },
              })
            }
          />
          <TextInput
            label="Caption"
            value={block.props.caption}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, caption: value },
              })
            }
          />
        </>
      )}

      {block.type === "faq" && (
        <>
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <div className="space-y-3">
            {block.props.items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    FAQ {itemIndex + 1}
                  </p>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    onClick={() =>
                      onChange({
                        ...block,
                        props: {
                          ...block.props,
                          items: block.props.items.filter(
                            (_, index) => index !== itemIndex,
                          ),
                        },
                      })
                    }
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
              onClick={() =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    items: [...block.props.items, { question: "", answer: "" }],
                  },
                })
              }
            >
              Add FAQ
            </button>
          </div>
        </>
      )}

      {block.type === "card_grid" && (
        <>
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <div className="space-y-3">
            {block.props.cards.map((card, cardIndex) => (
              <div
                key={cardIndex}
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
                  label="Card link"
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
              disabled={block.props.cards.length >= 12}
              onClick={() =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: [...block.props.cards, createBlankCard()],
                  },
                })
              }
            >
              Add card
            </button>
          </div>
        </>
      )}

      {block.type === "proof" && (
        <>
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, eyebrow: value },
              })
            }
          />
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
          <TextInput
            label="Name"
            value={block.props.name}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, name: value },
              })
            }
          />
          <TextInput
            label="Context"
            value={block.props.context}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, context: value },
              })
            }
          />
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
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, heading: value },
              })
            }
          />
          <TextAreaInput
            label="Helper copy"
            value={block.props.body}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, body: value },
              })
            }
          />
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

function SettingsGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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
                    className={`h-2.5 w-2.5 rounded-full ${findingDotClass(
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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
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

const layoutPresetOptions: Array<{
  id: LayoutPreset;
  label: string;
  description: string;
}> = [
  {
    id: "full_width_hero",
    label: "Opening hero",
    description: "Headline, intro copy, and one primary action.",
  },
  {
    id: "full_width_text",
    label: "Text section",
    description: "Long-form copy across the page width.",
  },
  {
    id: "text_left_image_right",
    label: "Text left, image right",
    description: "Create a two-column section with copy beside an image.",
  },
  {
    id: "image_left_text_right",
    label: "Image left, text right",
    description: "Reverse the split layout for visual variety.",
  },
  {
    id: "text_left_cta_right",
    label: "Text left, CTA right",
    description: "Pair explanatory copy with a focused conversion action.",
  },
];

function ReadinessFindingAction({
  finding,
  onAddSuggestedBlock,
  onOpenSettings,
}: {
  finding: SeoReadinessFinding;
  onAddSuggestedBlock: (type: PageBlock["type"]) => void;
  onOpenSettings: () => void;
}) {
  const suggestedBlock = suggestedBlockForFinding(finding);
  const anchor = anchorForFinding(finding);

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

function anchorForFinding(finding: SeoReadinessFinding) {
  if (finding.path === "title") return "#page-title-field";
  if (finding.path === "meta_description")
    return "#page-meta-description-field";
  if (finding.path.startsWith("blocks.")) {
    const blockIndex = Number(finding.path.split(".")[1]);
    if (Number.isFinite(blockIndex)) return `#builder-block-${blockIndex + 1}`;
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
  return friendlyFieldName(finding.path);
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
  summary,
}: {
  canPublish: boolean;
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

  return {
    title: "Ready to publish",
    detail:
      "No hard blockers remain. Review the public preview, then publish when the page is ready.",
    tone: "ready",
  };
}

function friendlyActionLocation(finding: SeoReadinessFinding) {
  const location = friendlyFindingLocation(finding);
  if (location.startsWith("URL")) return location;
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
  if (value === "trackingName" || value === "ctaTrackingName") {
    return "Internal CTA label";
  }
  if (value === "canonical_url" || value === "canonicalUrl") {
    return "Preferred URL";
  }
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
      proposal.proposal.blocks
        .filter(canInsertAiProposedBlock)
        .map((entry) => entry.block.id),
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
        <div className="rounded-md bg-violet-50 px-2 py-2">
          <p className="text-lg font-semibold text-slate-950">
            {proposal.proposal.blocks.length}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Items</p>
        </div>
        <div className="rounded-md bg-violet-50 px-2 py-2">
          <p className="text-lg font-semibold text-slate-950">
            {sourceRefCount}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Sources</p>
        </div>
        <div className="rounded-md bg-violet-50 px-2 py-2">
          <p className="text-lg font-semibold text-slate-950">{warningCount}</p>
          <p className="text-[11px] font-medium text-slate-500">Warnings</p>
        </div>
      </div>

      {proposal.proposal.metadata.seoTitle && (
        <p className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-xs leading-5 text-slate-600">
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
  sensors,
  mediaAssets,
  blockOrdinalById,
  onSectionMove,
  onSectionRemove,
  onColumnDragEnd,
  onBlockDragEnd,
  onAddColumn,
  onColumnMove,
  onColumnRemove,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockDuplicate,
  onBlockRemove,
}: {
  section: PageSection;
  sectionIndex: number;
  sectionCount: number;
  sensors: Sensors;
  mediaAssets: SeoPageEditorMediaAsset[];
  blockOrdinalById: Map<string, number>;
  onSectionMove: (direction: MoveDirection) => void;
  onSectionRemove: () => void;
  onColumnDragEnd: (sectionId: string, event: DragEndEvent) => void;
  onBlockDragEnd: (
    sectionId: string,
    columnId: string,
    event: DragEndEvent,
  ) => void;
  onAddColumn: () => void;
  onColumnMove: (columnId: string, direction: MoveDirection) => void;
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
  onBlockDuplicate: (columnId: string, blockId: string) => void;
  onBlockRemove: (columnId: string, blockId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`group/section relative rounded-[12px] border border-transparent transition-all ${editorSectionClass(
        section.background,
        section.spacing,
      )} ${
        isDragging
          ? "z-10 scale-[1.01] border-[#0b63f6] bg-white shadow-2xl"
          : "hover:border-slate-300"
      }`}
    >
      <header className="absolute -top-5 right-3 left-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-2 opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100">
        <div className="flex items-center gap-3">
          <DragHandle
            label={`Reorder section ${sectionIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Page section {sectionIndex + 1}
            </h3>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 ring-inset">
              {section.columns.length}{" "}
              {section.columns.length === 1 ? "column" : "columns"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <IconButton
              icon="up"
              label={`Move section ${sectionIndex + 1} up`}
              disabled={sectionIndex === 0}
              onClick={() => onSectionMove("up")}
            />
            <IconButton
              icon="down"
              label={`Move section ${sectionIndex + 1} down`}
              disabled={sectionIndex === sectionCount - 1}
              onClick={() => onSectionMove("down")}
            />
          </div>
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
          <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <MoreActions label={`Section ${sectionIndex + 1} actions`}>
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

      <DndContext
        id={`seo-page-${section.id}-columns`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => onColumnDragEnd(section.id, event)}
      >
        <SortableContext
          items={section.columns.map((column) => column.id)}
          strategy={verticalListSortingStrategy}
        >
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
                <h4 className="text-sm font-semibold text-slate-900">
                  No columns
                </h4>
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
                  sensors={sensors}
                  mediaAssets={mediaAssets}
                  blockOrdinalById={blockOrdinalById}
                  onBlockDragEnd={(event) =>
                    onBlockDragEnd(section.id, column.id, event)
                  }
                  onColumnMove={(direction) =>
                    onColumnMove(column.id, direction)
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
                  onBlockDuplicate={(blockId) =>
                    onBlockDuplicate(column.id, blockId)
                  }
                  onBlockRemove={(blockId) => onBlockRemove(column.id, blockId)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SimpleBlockStackEditor({
  sectionId,
  column,
  sensors,
  mediaAssets,
  blockOrdinalById,
  onBlockDragEnd,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockDuplicate,
  onBlockRemove,
}: {
  sectionId: string;
  column: PageColumn;
  sensors: Sensors;
  mediaAssets: SeoPageEditorMediaAsset[];
  blockOrdinalById: Map<string, number>;
  onBlockDragEnd: (event: DragEndEvent) => void;
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
  onBlockChange: (blockId: string, next: PageBlock) => void;
  onBlockMove: (blockId: string, direction: MoveDirection) => void;
  onBlockDuplicate: (blockId: string) => void;
  onBlockRemove: (blockId: string) => void;
}) {
  return (
    <DndContext
      id={`seo-page-${sectionId}-${column.id}-simple-blocks`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onBlockDragEnd}
    >
      <SortableContext
        items={column.blocks.map((block) => block.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-14">
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
                <SortableBlockEditor
                  key={block.id}
                  block={block}
                  index={blockIndex}
                  blockNumber={
                    (blockOrdinalById.get(block.id) ?? blockIndex) + 1
                  }
                  blockCount={column.blocks.length}
                  mediaAssets={mediaAssets}
                  onChange={(next) => onBlockChange(block.id, next)}
                  onMove={(direction) => onBlockMove(block.id, direction)}
                  onDuplicate={() => onBlockDuplicate(block.id)}
                  onRemove={() => onBlockRemove(block.id)}
                />
              ))}
              <BlockPicker onAddBlock={onAddBlock} />
            </>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableColumnEditor({
  column,
  columnIndex,
  columnCount,
  sensors,
  mediaAssets,
  blockOrdinalById,
  onBlockDragEnd,
  onColumnMove,
  onColumnRemove,
  onAddBlock,
  onBlockChange,
  onBlockMove,
  onBlockDuplicate,
  onBlockRemove,
}: {
  column: PageColumn;
  columnIndex: number;
  columnCount: number;
  sensors: Sensors;
  mediaAssets: SeoPageEditorMediaAsset[];
  blockOrdinalById: Map<string, number>;
  onBlockDragEnd: (event: DragEndEvent) => void;
  onColumnMove: (direction: MoveDirection) => void;
  onColumnRemove: () => void;
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
  onBlockChange: (blockId: string, next: PageBlock) => void;
  onBlockMove: (blockId: string, direction: MoveDirection) => void;
  onBlockDuplicate: (blockId: string) => void;
  onBlockRemove: (blockId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/column relative flex flex-col rounded-[12px] border border-dashed border-transparent bg-transparent transition-all ${
        isDragging
          ? "z-20 scale-[1.02] border-[#0b63f6] bg-white shadow-xl"
          : "hover:border-slate-300 hover:bg-white/50"
      }`}
    >
      <header className="absolute -top-5 right-2 left-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 opacity-0 shadow-sm ring-1 ring-black/5 transition-opacity group-focus-within/column:opacity-100 group-hover/column:opacity-100">
        <div className="flex items-center gap-2">
          <DragHandle
            label={`Reorder column ${columnIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <h4 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            Column {columnIndex + 1}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
            <IconButton
              icon="left"
              label={`Move column ${columnIndex + 1} left`}
              disabled={columnIndex === 0}
              onClick={() => onColumnMove("up")}
            />
            <IconButton
              icon="right"
              label={`Move column ${columnIndex + 1} right`}
              disabled={columnIndex === columnCount - 1}
              onClick={() => onColumnMove("down")}
            />
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-0.5 shadow-sm">
            <MoreActions label={`Column ${columnIndex + 1} actions`}>
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
        <DndContext
          id={`seo-page-${column.id}-blocks`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onBlockDragEnd}
        >
          <SortableContext
            items={column.blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-10">
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
                    <SortableBlockEditor
                      key={block.id}
                      block={block}
                      index={blockIndex}
                      blockNumber={
                        (blockOrdinalById.get(block.id) ?? blockIndex) + 1
                      }
                      blockCount={column.blocks.length}
                      mediaAssets={mediaAssets}
                      onChange={(next) => onBlockChange(block.id, next)}
                      onMove={(direction) => onBlockMove(block.id, direction)}
                      onDuplicate={() => onBlockDuplicate(block.id)}
                      onRemove={() => onBlockRemove(block.id)}
                    />
                  ))}
                  <BlockPicker onAddBlock={onAddBlock} />
                </>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

const blockPickerOptions: Array<{
  type: PageBlock["type"];
  label: string;
  description: string;
  variants: BlockPickerVariantOption[];
}> = [
  {
    type: "hero",
    label: "Hero",
    description: "Opening message with optional CTA.",
    variants: [
      {
        id: "standard",
        label: "Standard hero",
        description: "Headline, intro copy, and one CTA.",
      },
      {
        id: "split",
        label: "Split hero",
        description: "Best for pairing copy with media or proof.",
      },
      {
        id: "compact",
        label: "Compact hero",
        description: "Short page opener for utility pages.",
      },
      {
        id: "editorial",
        label: "Editorial hero",
        description: "Stronger story-led opening for guides.",
      },
    ],
  },
  {
    type: "rich_text",
    label: "Text",
    description: "SEO body copy and supporting sections.",
    variants: [
      {
        id: "default",
        label: "Standard text",
        description: "Heading with paragraph body copy.",
      },
      {
        id: "intro",
        label: "Intro text",
        description: "Lead-in copy after the hero.",
      },
      {
        id: "compact",
        label: "Compact text",
        description: "Short supporting note or bridge.",
      },
      {
        id: "checklist",
        label: "Checklist text",
        description: "Structured copy for steps or inclusions.",
      },
    ],
  },
  {
    type: "image",
    label: "Image",
    description: "Media asset with alt text and rights notes.",
    variants: [
      {
        id: "standard",
        label: "Standard image",
        description: "Inline image with caption.",
      },
      {
        id: "wide",
        label: "Wide image",
        description: "Full-width visual break.",
      },
      {
        id: "inline",
        label: "Inline image",
        description: "Smaller supporting image.",
      },
      {
        id: "feature",
        label: "Feature image",
        description: "Prominent image for split sections.",
      },
    ],
  },
  {
    type: "cta",
    label: "CTA",
    description: "Primary conversion button.",
    variants: [
      {
        id: "primary",
        label: "Primary CTA",
        description: "Main conversion action.",
      },
      {
        id: "secondary",
        label: "Secondary CTA",
        description: "Lower-emphasis conversion action.",
      },
      {
        id: "text",
        label: "Text link CTA",
        description: "Inline supporting action.",
      },
    ],
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Visible Q&A for schema.",
    variants: [
      {
        id: "standard",
        label: "Standard FAQ",
        description: "Question list for answer pages.",
      },
      {
        id: "compact",
        label: "Compact FAQ",
        description: "Short objection-handling section.",
      },
      {
        id: "accordion",
        label: "Accordion FAQ",
        description: "Expandable-style question group.",
      },
    ],
  },
  {
    type: "card_grid",
    label: "Cards",
    description: "Comparison cards or grouped options.",
    variants: [
      {
        id: "standard",
        label: "Standard cards",
        description: "Balanced grid for grouped details.",
      },
      {
        id: "compact",
        label: "Compact cards",
        description: "Dense scannable comparison points.",
      },
      {
        id: "feature",
        label: "Feature cards",
        description: "Bigger cards for key offers.",
      },
    ],
  },
  {
    type: "proof",
    label: "Proof",
    description: "Approved testimonial, stat, or evidence.",
    variants: [
      {
        id: "quote",
        label: "Quote proof",
        description: "Customer or source-backed quote.",
      },
      {
        id: "stat",
        label: "Stat proof",
        description: "Number-led credibility point.",
      },
      {
        id: "logo",
        label: "Logo proof",
        description: "Source, partner, or trust marker.",
      },
    ],
  },
  {
    type: "video",
    label: "Video",
    description: "Embedded or linked video.",
    variants: [
      {
        id: "standard",
        label: "Standard video",
        description: "Video with title and caption.",
      },
      {
        id: "wide",
        label: "Wide video",
        description: "Full-width video feature.",
      },
      {
        id: "inline",
        label: "Inline video",
        description: "Smaller video inside supporting copy.",
      },
    ],
  },
  {
    type: "lead_form",
    label: "Form",
    description: "Lead capture with fixed contact fields.",
    variants: [
      {
        id: "standard",
        label: "Standard form",
        description: "Full lead-capture section.",
      },
      {
        id: "compact",
        label: "Compact form",
        description: "Shorter form for simple pages.",
      },
      {
        id: "sidebar",
        label: "Sidebar form",
        description: "Form paired with adjacent content.",
      },
    ],
  },
];

function BlockPicker({
  onAddBlock,
}: {
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PageBlock["type"]>(
    blockPickerOptions[0]?.type ?? "rich_text",
  );
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
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/20 px-4 py-6 sm:px-6 lg:py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            className="animate-in fade-in slide-in-from-top-2 mx-auto w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 sm:p-5"
            role="dialog"
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
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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
            <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div className="grid gap-2 self-start">
                {blockPickerOptions.map((option) => {
                  const isSelected = option.type === selectedOption.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      className={`flex min-h-16 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                        isSelected
                          ? "border-[#0b63f6]/65 bg-[#f7faff] shadow-sm ring-1 ring-[#0b63f6]/20"
                          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedType(option.type)}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 ring-inset ${
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
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-slate-950 sm:text-base">
                      Choose a {selectedOption.label.toLowerCase()} layout
                    </h5>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedOption.variants.map((variant) => (
                      <button
                        key={`${selectedOption.type}-${variant.id}`}
                        type="button"
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-[#0b63f6]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                        onClick={() => {
                          onAddBlock(selectedOption.type, variant.id);
                          setIsOpen(false);
                        }}
                      >
                        <span
                          className="block h-40 border-b border-slate-200 bg-white p-5 sm:h-48 sm:p-6"
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
          </div>
        </div>
      )}
    </div>
  );
}

function BlockVariantPreviewSkeleton({
  type,
  variant,
}: {
  type: PageBlock["type"];
  variant: BlockVariant;
}) {
  if (type === "hero") {
    return <HeroLayoutPreview variant={variant} />;
  }
  if (type === "image") {
    return <ImageLayoutPreview variant={variant} />;
  }
  if (type === "lead_form") {
    return <LeadFormLayoutPreview variant={variant} />;
  }
  if (type === "card_grid") {
    return <CardsLayoutPreview variant={variant} />;
  }
  if (type === "video") {
    return <VideoLayoutPreview variant={variant} />;
  }
  if (type === "faq") {
    return <FaqLayoutPreview variant={variant} />;
  }
  if (type === "proof") {
    return <ProofLayoutPreview variant={variant} />;
  }
  if (type === "cta") {
    return <CtaLayoutPreview variant={variant} />;
  }
  return <TextLayoutPreview variant={variant} />;
}

function HeroLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "split") {
    return (
      <span className="grid h-full grid-cols-[minmax(0,1fr)_88px] items-center gap-6">
        <span className="block">
          <PreviewAccent className="w-16" />
          <PreviewLine tone="dark" className="mt-5 h-4 w-full" />
          <PreviewLine tone="dark" className="mt-2 h-4 w-3/4" />
          <PreviewLine className="mt-4 h-2 w-full" />
          <PreviewLine className="mt-2 h-2 w-4/5" />
          <PreviewButton className="mt-5 w-20" />
        </span>
        <PreviewImage className="h-28" />
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className="flex h-full flex-col items-center justify-center text-center">
        <PreviewAccent className="w-20" />
        <PreviewLine tone="dark" className="mt-5 h-4 w-48 max-w-full" />
        <PreviewLine tone="dark" className="mt-2 h-4 w-36 max-w-full" />
        <PreviewLine className="mt-5 h-2 w-40 max-w-full" />
        <PreviewLine className="mt-2 h-2 w-36 max-w-full" />
        <PreviewButton className="mt-6 w-24" />
      </span>
    );
  }

  if (variant === "editorial") {
    return (
      <span className="block h-full pt-2">
        <PreviewAccent className="w-20" />
        <PreviewLine tone="dark" className="mt-4 h-4 w-4/5" />
        <PreviewLine tone="dark" className="mt-2 h-4 w-3/5" />
        <span className="mt-4 flex items-center gap-3">
          <span className="block h-3 w-3 rounded-full border border-slate-400" />
          <PreviewLine className="h-2 w-16" />
          <span className="block h-1 w-1 rounded-full bg-slate-400" />
          <span className="block h-3 w-3 rounded-sm border border-slate-400" />
          <PreviewLine className="h-2 w-20" />
        </span>
        <PreviewLine className="mt-5 h-2 w-4/5" />
        <PreviewLine className="mt-2 h-2 w-3/4" />
        <PreviewLine className="mt-2 h-2 w-2/3" />
        <PreviewLine className="mt-2 h-2 w-1/2" />
      </span>
    );
  }

  return (
    <span className="block h-full pt-2">
      <PreviewAccent className="w-16" />
      <PreviewLine tone="dark" className="mt-5 h-4 w-4/5" />
      <PreviewLine tone="dark" className="mt-2 h-4 w-2/3" />
      <PreviewLine className="mt-5 h-2 w-3/4" />
      <PreviewLine className="mt-2 h-2 w-2/3" />
      <PreviewButton className="mt-6 w-28" />
    </span>
  );
}

function TextLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "checklist") {
    return (
      <span className="block h-full pt-2">
        <PreviewLine tone="dark" className="h-4 w-3/5" />
        <PreviewLine className="mt-3 h-2 w-4/5" />
        {[0, 1, 2].map((item) => (
          <span key={item} className="mt-3 flex items-center gap-3">
            <span className="block h-4 w-4 rounded-full bg-[#0b63f6]/80" />
            <PreviewLine className={item === 2 ? "h-2 w-2/5" : "h-2 w-3/5"} />
          </span>
        ))}
      </span>
    );
  }

  if (variant === "intro") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewAccent className="w-14" />
        <PreviewLine tone="dark" className="mt-5 h-5 w-4/5" />
        <PreviewLine className="mt-4 h-2 w-full" />
        <PreviewLine className="mt-2 h-2 w-5/6" />
        <PreviewLine className="mt-2 h-2 w-2/3" />
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewLine tone="dark" className="h-4 w-2/5" />
        <PreviewLine className="mt-4 h-2 w-3/5" />
        <PreviewLine className="mt-2 h-2 w-1/2" />
      </span>
    );
  }

  return (
    <span className="block h-full pt-3">
      <PreviewLine tone="dark" className="h-4 w-2/3" />
      <PreviewLine className="mt-5 h-2 w-full" />
      <PreviewLine className="mt-2 h-2 w-5/6" />
      <PreviewLine className="mt-2 h-2 w-4/5" />
      <PreviewLine className="mt-5 h-2 w-2/3" />
      <PreviewLine className="mt-2 h-2 w-3/5" />
    </span>
  );
}

function ImageLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "wide") {
    return (
      <span className="block h-full">
        <PreviewImage className="h-28" />
        <PreviewLine className="mt-4 h-2 w-2/5" />
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span className="grid h-full grid-cols-[96px_minmax(0,1fr)] items-center gap-5">
        <PreviewImage className="h-24" />
        <span className="block">
          <PreviewLine tone="dark" className="h-4 w-2/3" />
          <PreviewLine className="mt-4 h-2 w-full" />
          <PreviewLine className="mt-2 h-2 w-4/5" />
          <PreviewLine className="mt-2 h-2 w-3/5" />
        </span>
      </span>
    );
  }

  if (variant === "feature") {
    return (
      <span className="grid h-full grid-cols-[minmax(0,1fr)_104px] items-center gap-5">
        <span className="block">
          <PreviewAccent className="w-14" />
          <PreviewLine tone="dark" className="mt-4 h-4 w-4/5" />
          <PreviewLine className="mt-4 h-2 w-3/4" />
          <PreviewLine className="mt-2 h-2 w-2/3" />
        </span>
        <PreviewImage className="h-28" />
      </span>
    );
  }

  return (
    <span className="block h-full">
      <PreviewImage className="h-24" />
      <PreviewLine className="mt-4 h-2 w-2/5" />
      <PreviewLine className="mt-2 h-2 w-1/3" />
    </span>
  );
}

function CtaLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "text") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewLine tone="dark" className="h-4 w-2/3" />
        <PreviewLine className="mt-4 h-2 w-4/5" />
        <PreviewLine className="mt-2 h-2 w-3/5" />
        <span className="mt-5 block h-2 w-24 rounded-full bg-[#0b63f6]/85" />
      </span>
    );
  }

  return (
    <span className="flex h-full flex-col justify-center">
      <PreviewLine tone="dark" className="h-4 w-3/5" />
      <PreviewLine className="mt-4 h-2 w-4/5" />
      <PreviewLine className="mt-2 h-2 w-2/3" />
      <PreviewButton className="mt-6 w-28" subtle={variant === "secondary"} />
    </span>
  );
}

function FaqLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "compact") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewLine tone="dark" className="h-4 w-3/5" />
        <PreviewQuestionRow className="mt-5" />
        <PreviewQuestionRow className="mt-2" short />
      </span>
    );
  }

  if (variant === "accordion") {
    return (
      <span className="block h-full pt-2">
        <PreviewLine tone="dark" className="h-4 w-2/3" />
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="mt-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
          >
            <PreviewLine className="h-2 w-3/5" />
            <span className="block h-3 w-3 rounded-full border border-slate-400" />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="block h-full pt-2">
      <PreviewLine tone="dark" className="h-4 w-2/3" />
      <PreviewQuestionRow className="mt-5" />
      <PreviewLine className="mt-3 h-2 w-5/6" />
      <PreviewLine className="mt-2 h-2 w-2/3" />
      <PreviewQuestionRow className="mt-4" short />
    </span>
  );
}

function CardsLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "compact") {
    return (
      <span className="grid h-full grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((item) => (
          <PreviewCard key={item} compact />
        ))}
      </span>
    );
  }

  if (variant === "feature") {
    return (
      <span className="grid h-full grid-cols-[1.1fr_0.9fr] gap-3">
        <PreviewCard featured />
        <span className="grid gap-3">
          <PreviewCard compact />
          <PreviewCard compact />
        </span>
      </span>
    );
  }

  return (
    <span className="grid h-full grid-cols-3 gap-3">
      <PreviewCard />
      <PreviewCard />
      <PreviewCard />
    </span>
  );
}

function ProofLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "stat") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewAccent className="w-14" />
        <PreviewLine tone="dark" className="mt-5 h-8 w-24" />
        <PreviewLine className="mt-4 h-2 w-4/5" />
        <PreviewLine className="mt-2 h-2 w-2/3" />
      </span>
    );
  }

  if (variant === "logo") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewLine tone="dark" className="h-4 w-3/5" />
        <span className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className="block h-10 rounded-md bg-slate-50 ring-1 ring-slate-200"
            />
          ))}
        </span>
        <PreviewLine className="mt-5 h-2 w-2/3" />
      </span>
    );
  }

  return (
    <span className="flex h-full flex-col justify-center">
      <PreviewAccent className="w-14" />
      <PreviewLine tone="dark" className="mt-5 h-3 w-4/5" />
      <PreviewLine tone="dark" className="mt-2 h-3 w-2/3" />
      <span className="mt-5 flex items-center gap-3">
        <span className="block h-8 w-8 rounded-full bg-slate-200" />
        <span className="block min-w-0 flex-1">
          <PreviewLine className="h-2 w-1/2" />
          <PreviewLine className="mt-2 h-2 w-2/5" />
        </span>
      </span>
    </span>
  );
}

function VideoLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "inline") {
    return (
      <span className="grid h-full grid-cols-[104px_minmax(0,1fr)] items-center gap-5">
        <PreviewVideo className="h-24" />
        <span className="block">
          <PreviewLine tone="dark" className="h-4 w-3/5" />
          <PreviewLine className="mt-4 h-2 w-full" />
          <PreviewLine className="mt-2 h-2 w-3/4" />
        </span>
      </span>
    );
  }

  return (
    <span className="block h-full">
      <PreviewVideo className={variant === "wide" ? "h-28" : "h-24"} />
      <PreviewLine className="mt-4 h-2 w-2/5" />
      {variant !== "wide" && <PreviewLine className="mt-2 h-2 w-1/3" />}
    </span>
  );
}

function LeadFormLayoutPreview({ variant }: { variant: BlockVariant }) {
  if (variant === "sidebar") {
    return (
      <span className="grid h-full grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] items-center gap-5">
        <span className="block">
          <PreviewLine tone="dark" className="h-4 w-4/5" />
          <PreviewLine className="mt-4 h-2 w-full" />
          <PreviewLine className="mt-2 h-2 w-3/4" />
        </span>
        <span className="grid gap-2">
          <PreviewField />
          <PreviewField />
          <PreviewButton className="w-24" />
        </span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className="flex h-full flex-col justify-center">
        <PreviewLine tone="dark" className="h-4 w-3/5" />
        <span className="mt-5 grid grid-cols-2 gap-2">
          <PreviewField />
          <PreviewField />
        </span>
        <PreviewButton className="mt-4 w-24" />
      </span>
    );
  }

  return (
    <span className="block h-full pt-1">
      <PreviewLine tone="dark" className="h-4 w-3/5" />
      <span className="mt-5 grid grid-cols-2 gap-2">
        <PreviewField />
        <PreviewField />
        <PreviewField />
        <PreviewField />
      </span>
      <PreviewButton className="mt-4 w-28" />
    </span>
  );
}

function PreviewAccent({ className = "" }: { className?: string }) {
  return (
    <span className={`block h-1.5 rounded-full bg-[#0b63f6]/85 ${className}`} />
  );
}

function PreviewLine({
  className = "",
  tone = "muted",
}: {
  className?: string;
  tone?: "dark" | "muted";
}) {
  const toneClass =
    tone === "dark"
      ? "bg-gradient-to-r from-slate-700 to-slate-500"
      : "bg-slate-200";

  return <span className={`block rounded-full ${toneClass} ${className}`} />;
}

function PreviewButton({
  className = "",
  subtle = false,
}: {
  className?: string;
  subtle?: boolean;
}) {
  return (
    <span
      className={`block h-8 rounded-full ${
        subtle
          ? "border border-[#0b63f6]/50 bg-white"
          : "bg-[#0b63f6]/85 shadow-sm"
      } ${className}`}
    />
  );
}

function PreviewImage({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative block overflow-hidden rounded-md bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-200 ${className}`}
    >
      <span className="absolute top-4 right-4 block h-5 w-5 rounded-full bg-slate-300/70" />
      <span className="absolute bottom-0 left-0 block h-3/5 w-3/5 rounded-tr-[28px] bg-slate-300/60" />
      <span className="absolute right-0 bottom-0 block h-2/5 w-2/5 rounded-tl-[24px] bg-slate-300/50" />
    </span>
  );
}

function PreviewVideo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-md bg-slate-100 ring-1 ring-slate-200 ${className}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <span className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-slate-500" />
      </span>
    </span>
  );
}

function PreviewField() {
  return (
    <span className="block h-8 rounded-md bg-slate-50 ring-1 ring-slate-200" />
  );
}

function PreviewQuestionRow({
  className = "",
  short = false,
}: {
  className?: string;
  short?: boolean;
}) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500">
        ?
      </span>
      <PreviewLine className={`h-2 ${short ? "w-2/5" : "w-3/5"}`} />
    </span>
  );
}

function PreviewCard({
  compact = false,
  featured = false,
}: {
  compact?: boolean;
  featured?: boolean;
}) {
  return (
    <span
      className={`block rounded-md border border-slate-200 bg-white shadow-sm ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <PreviewLine
        tone="dark"
        className={`${featured ? "h-4 w-3/4" : "h-3 w-2/3"}`}
      />
      <PreviewLine className={`${compact ? "mt-3" : "mt-4"} h-2 w-full`} />
      <PreviewLine className="mt-2 h-2 w-2/3" />
      {featured && <PreviewButton className="mt-5 w-20" />}
    </span>
  );
}

function SortableBlockEditor({
  block,
  index,
  blockNumber,
  blockCount,
  mediaAssets,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: PageBlock;
  index: number;
  blockNumber: number;
  blockCount: number;
  mediaAssets: SeoPageEditorMediaAsset[];
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BlockEditor
        block={block}
        blockNumber={blockNumber}
        isFirst={index === 0}
        isLast={index === blockCount - 1}
        isDragging={isDragging}
        dragHandle={
          <DragHandle
            label={`Reorder ${blockLabel(block.type)} content ${index + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
        }
        onChange={onChange}
        mediaAssets={mediaAssets}
        onMove={onMove}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    </div>
  );
}

function BlockEditor({
  block,
  blockNumber,
  isFirst,
  isLast,
  isDragging,
  dragHandle,
  mediaAssets,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: PageBlock;
  blockNumber: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  dragHandle: ReactNode;
  mediaAssets: SeoPageEditorMediaAsset[];
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const blockCompletionMessages = completionMessagesForBlock(block);
  const completionStatus =
    blockCompletionMessages.length > 0 ? "Needs content" : "Ready";
  const renderLegacyInlineSettings = false;

  return (
    <article
      id={`builder-block-${blockNumber}`}
      className={`group/editor relative scroll-mt-28 rounded-[12px] border border-transparent bg-transparent transition-all focus-within:border-[#0b63f6]/50 focus-within:bg-white/80 focus-within:ring-4 focus-within:ring-[#0b63f6]/5 ${
        isDragging
          ? "z-10 scale-[1.01] border-[#0b63f6] bg-white shadow-2xl"
          : "hover:border-slate-300 hover:bg-white/70"
      }`}
    >
      <BlockToolbar
        label={`Page content ${blockNumber}`}
        typeLabel={blockLabel(block.type)}
        variantLabel={blockVariantLabel(block)}
        variant={block.variant}
        variantOptions={blockVariantOptions(block.type)}
        description={blockSummary(block)}
        status={completionStatus}
        icon={block.type}
        isFirst={isFirst}
        isLast={isLast}
        dragHandle={dragHandle}
        onVariantChange={(variant) =>
          onChange(
            withEditorDefaultsForNewBlock(withBlockVariant(block, variant)),
          )
        }
        onMove={onMove}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />

      <div className="px-3 py-6 sm:px-4">
        <ResourcePageBlockView
          block={block}
          renderMode="editor"
          linkMode="disabled"
        />
      </div>

      {renderLegacyInlineSettings && (
        <details className="hidden">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Block settings
          </summary>
          <div className="mt-4 border-t border-slate-100 pt-4">
            {block.type === "rich_text" && (
              <div className="max-w-3xl px-3 py-7 sm:px-4">
                <label className="block">
                  <span className="sr-only">Eyebrow</span>
                  <input
                    value={block.props.eyebrow}
                    placeholder="Eyebrow"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, eyebrow: event.target.value },
                      })
                    }
                    className={eyebrowInputClass}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="sr-only">Heading</span>
                  <input
                    value={block.props.heading}
                    placeholder="Section heading"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, heading: event.target.value },
                      })
                    }
                    className={sectionHeadingInputClass}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="sr-only">Body</span>
                  <textarea
                    value={editableRichTextBodyText(block)}
                    placeholder="Write the page copy here."
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

            {block.type === "hero" && (
              <div className="max-w-4xl px-3 py-8 sm:px-4">
                <label className="block">
                  <span className="sr-only">Eyebrow</span>
                  <input
                    value={block.props.eyebrow}
                    placeholder="Eyebrow"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, eyebrow: event.target.value },
                      })
                    }
                    className={eyebrowInputClass}
                  />
                </label>
                <label className="mt-3 block">
                  <span className="sr-only">Heading</span>
                  <textarea
                    value={block.props.heading}
                    placeholder="Hero headline"
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
                <label className="mt-5 block max-w-3xl">
                  <span className="sr-only">Body</span>
                  <textarea
                    value={block.props.body}
                    placeholder="Hero body copy"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, body: event.target.value },
                      })
                    }
                    rows={3}
                    className={leadInputClass}
                  />
                </label>
                <div className="mt-7 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                    <span className="sr-only">CTA label</span>
                    <input
                      value={block.props.ctaLabel}
                      placeholder="CTA label"
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                      label="CTA href"
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
                </div>
                {block.variant === "split" && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Split hero media or proof
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      The split layout renders this approved media/proof area on
                      the right side of the hero.
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <TextInput
                        label="Media path or URL"
                        value={block.props.mediaSrc ?? ""}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, mediaSrc: value },
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
                      <TextInput
                        label="Media caption"
                        value={block.props.mediaCaption ?? ""}
                        onChange={(value) =>
                          onChange({
                            ...block,
                            props: { ...block.props, mediaCaption: value },
                          })
                        }
                      />
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
                  </div>
                )}
              </div>
            )}

            {block.type === "image" && (
              <figure className="px-3 py-4 sm:px-4">
                {block.props.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={block.props.src}
                    alt={block.props.altText}
                    className="aspect-video w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    Image preview
                  </div>
                )}
                <label className="mt-3 block">
                  <span className="sr-only">Caption</span>
                  <input
                    value={block.props.caption}
                    placeholder="Caption"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, caption: event.target.value },
                      })
                    }
                    className="focus:ring-brand-100 w-full bg-transparent text-sm text-slate-500 outline-none focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2"
                  />
                </label>
                <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    Image settings
                  </summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-slate-700">
                        Media library asset
                      </span>
                      <select
                        value={block.props.assetId ?? ""}
                        onChange={(event) => {
                          const asset = mediaAssets.find(
                            (item) => item.id === event.target.value,
                          );
                          onChange(
                            asset
                              ? applyMediaAssetToImageBlock(block, asset)
                              : {
                                  ...block,
                                  props: {
                                    ...block.props,
                                    assetId: undefined,
                                    src: "",
                                    altText: "",
                                    caption: "",
                                    sourceRightsNotes: "",
                                  },
                                },
                          );
                        }}
                        className={compactInputClass}
                      >
                        <option value="">Choose from media library</option>
                        {mediaAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.title}
                          </option>
                        ))}
                      </select>
                      {mediaAssets.length === 0 && (
                        <span className="mt-2 block text-xs leading-5 text-slate-500">
                          Add image assets in the media library before selecting
                          one here.
                        </span>
                      )}
                    </label>
                    <TextInput
                      label="Asset ID"
                      value={block.props.assetId ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            assetId: value || undefined,
                          },
                        })
                      }
                    />
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
                  </div>
                </details>
              </figure>
            )}

            {block.type === "cta" && (
              <div className="px-3 py-4 sm:px-4">
                <label className="inline-flex min-h-12 max-w-sm items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                  <span className="sr-only">CTA label</span>
                  <input
                    value={block.props.label}
                    placeholder="CTA label"
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
                <details className="mt-4 rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    Button settings
                  </summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <TextInput
                      label="Href"
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
                          props: {
                            ...block.props,
                            presetId: value || undefined,
                          },
                        })
                      }
                    />
                  </div>
                </details>
              </div>
            )}

            {block.type === "video" && (
              <div className="rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8]">
                <TextInput
                  label="Title"
                  value={block.props.title}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: { ...block.props, title: value },
                    })
                  }
                />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="URL"
                    value={block.props.url}
                    onChange={(value) =>
                      onChange({
                        ...block,
                        props: { ...block.props, url: value },
                      })
                    }
                  />
                  <TextInput
                    label="Caption"
                    value={block.props.caption}
                    onChange={(value) =>
                      onChange({
                        ...block,
                        props: { ...block.props, caption: value },
                      })
                    }
                  />
                </div>
              </div>
            )}

            {block.type === "faq" && (
              <div className="max-w-3xl px-3 py-4 sm:px-4">
                <label className="block">
                  <span className="sr-only">Heading</span>
                  <input
                    value={block.props.heading}
                    placeholder="FAQ heading"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, heading: event.target.value },
                      })
                    }
                    className={sectionHeadingInputClass}
                  />
                </label>
                <div className="mt-5 divide-y-2 divide-[#bfeeff] rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8]">
                  <div className="p-5">
                    <TextInput
                      label="Question"
                      value={block.props.items[0]?.question ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            items: updateFirstFaqItem(block.props.items, {
                              question: value,
                            }),
                          },
                        })
                      }
                    />
                    <TextAreaInput
                      label="Answer"
                      value={block.props.items[0]?.answer ?? ""}
                      onChange={(value) =>
                        onChange({
                          ...block,
                          props: {
                            ...block.props,
                            items: updateFirstFaqItem(block.props.items, {
                              answer: value,
                            }),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {block.type === "card_grid" && (
              <div className="px-3 py-4 sm:px-4">
                <label className="block">
                  <span className="sr-only">Heading</span>
                  <input
                    value={block.props.heading}
                    placeholder="Card grid heading"
                    onChange={(event) =>
                      onChange({
                        ...block,
                        props: { ...block.props, heading: event.target.value },
                      })
                    }
                    className={sectionHeadingInputClass}
                  />
                </label>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {block.props.cards.map((card, cardIndex) => (
                    <article
                      key={cardIndex}
                      className="rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8]"
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
                        label="Card link"
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
                      {cardCompletionMessages(card).length > 0 && (
                        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
                          {cardCompletionMessages(card).map((message) => (
                            <p key={message}>{message}</p>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                  <button
                    type="button"
                    className="hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-400 min-h-40 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-left text-sm font-semibold text-slate-600 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={block.props.cards.length >= 12}
                    onClick={() =>
                      onChange({
                        ...block,
                        props: {
                          ...block.props,
                          cards: [...block.props.cards, createBlankCard()],
                        },
                      })
                    }
                  >
                    Add card
                  </button>
                </div>
              </div>
            )}

            {block.type === "proof" && (
              <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                <TextInput
                  label="Eyebrow"
                  value={block.props.eyebrow}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      props: { ...block.props, eyebrow: value },
                    })
                  }
                />
                <label className="mt-3 block">
                  <span className="sr-only">Body</span>
                  <textarea
                    value={block.props.body}
                    placeholder="Proof quote or stat"
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
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <TextInput
                    label="Name"
                    value={block.props.name}
                    onChange={(value) =>
                      onChange({
                        ...block,
                        props: { ...block.props, name: value },
                      })
                    }
                  />
                  <TextInput
                    label="Context"
                    value={block.props.context}
                    onChange={(value) =>
                      onChange({
                        ...block,
                        props: { ...block.props, context: value },
                      })
                    }
                  />
                  <TextInput
                    label="Proof item ID"
                    value={block.props.proofItemId ?? ""}
                    onChange={(value) =>
                      onChange({
                        ...block,
                        props: {
                          ...block.props,
                          proofItemId: value || undefined,
                        },
                      })
                    }
                  />
                </div>
              </figure>
            )}

            {block.type === "lead_form" && (
              <div className="grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
                <div>
                  <label className="block">
                    <span className="sr-only">Heading</span>
                    <input
                      value={block.props.heading}
                      placeholder="Lead form heading"
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
                  <label className="mt-3 block">
                    <span className="sr-only">Body</span>
                    <textarea
                      value={block.props.body}
                      placeholder="Lead form copy"
                      onChange={(event) =>
                        onChange({
                          ...block,
                          props: { ...block.props, body: event.target.value },
                        })
                      }
                      rows={3}
                      className={bodyTextareaClass}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={disabledLeadFieldClass}>Full name</div>
                  <div className={disabledLeadFieldClass}>Email</div>
                  <div className={disabledLeadFieldClass}>Phone</div>
                  <div className={disabledLeadFieldClass}>Market</div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
                    <span className="sr-only">Submit label</span>
                    <input
                      value={block.props.submitLabel}
                      placeholder="Submit label"
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
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {blockCompletionMessages.length > 0 && (
        <CompletionHintPanel messages={blockCompletionMessages} />
      )}
    </article>
  );
}

function CompletionHintPanel({ messages }: { messages: string[] }) {
  return (
    <div className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

function BlockToolbar({
  label,
  typeLabel,
  variantLabel,
  variant,
  variantOptions,
  description,
  status,
  icon,
  isFirst,
  isLast,
  dragHandle,
  onVariantChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  label: string;
  typeLabel: string;
  variantLabel: string;
  variant: BlockVariant;
  variantOptions: BlockPickerVariantOption[];
  description: string;
  status: string;
  icon: PageBlock["type"];
  isFirst: boolean;
  isLast: boolean;
  dragHandle: ReactNode;
  onVariantChange: (variant: BlockVariant) => void;
  onMove: (direction: MoveDirection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <header
      className="absolute -top-5 right-0 left-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur transition-opacity group-focus-within/editor:opacity-100 group-hover/editor:opacity-100"
      title={description}
    >
      <div className="flex min-w-0 items-center gap-3">
        {dragHandle}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200/50 ring-inset"
          aria-hidden="true"
        >
          <BuilderGlyph name={icon} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {typeLabel}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100 ring-inset">
              {variantLabel}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                status === "Ready"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/50"
                  : "bg-amber-50 text-amber-700 ring-amber-200/50"
              }`}
            >
              {status}
            </span>
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`${label}-variant`}>
          {label} variation
        </label>
        <select
          id={`${label}-variant`}
          aria-label={`${label} variation`}
          value={variant}
          onChange={(event) =>
            onVariantChange(event.target.value as BlockVariant)
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all outline-none hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10"
        >
          {variantOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <IconButton
            icon="up"
            label={`${label} up`}
            disabled={isFirst}
            onClick={() => onMove("up")}
          />
          <IconButton
            icon="down"
            label={`${label} down`}
            disabled={isLast}
            onClick={() => onMove("down")}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <MoreActions label={`${label} actions`}>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={textareaClass}
      />
    </label>
  );
}

function DragHandle({
  label,
  attributes,
  listeners,
}: {
  label: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={dragHandleClass}
      {...attributes}
      {...listeners}
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
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="5" r="1" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="5" r="1" />
        <circle cx="15" cy="19" r="1" />
      </svg>
    </button>
  );
}

function IconButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: "up" | "down" | "left" | "right" | "more";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={iconButtonClass}
      disabled={disabled}
      onClick={onClick}
    >
      {icon === "up" && (
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
          <path d="m18 15-6-6-6 6" />
        </svg>
      )}
      {icon === "down" && (
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
      {icon === "left" && (
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
          <path d="m15 18-6-6 6-6" />
        </svg>
      )}
      {icon === "right" && (
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
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
      {icon === "more" && (
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
      )}
    </button>
  );
}

function MoreActions({
  label,
  children,
}: {
  label: string;
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
      <button
        type="button"
        aria-label={label}
        title={label}
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
    className: "h-4 w-4",
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

function applyMediaAssetToImageBlock(
  block: Extract<PageBlock, { type: "image" }>,
  asset: SeoPageEditorMediaAsset,
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

function parseInitialContent(page: SeoPage | undefined): PageContent {
  const parsed = pageContentSchema.safeParse(
    page?.draft_content ?? createEmptyPageContent(),
  );
  if (!parsed.success) return createEmptyPageContent();
  return parsed.data;
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

function isEmptyBuilderContent(content: PageContent) {
  return (
    content.sections.length === 0 ||
    content.sections.every((section) =>
      section.columns.every((column) => column.blocks.length === 0),
    )
  );
}

function layoutPresetSection(preset: LayoutPreset): PageSection {
  const sectionId = makeBuilderId("section");
  const leftColumnId = makeBuilderId("column");
  const rightColumnId = makeBuilderId("column");
  const textBlock = starterRichText(
    "Add a supporting section heading",
    "Use this section to explain the offer, objection, comparison point, or local context that supports the page goal.",
    "intro",
  );
  const imageBlock = starterImage();
  const ctaBlock = starterCta("Start an enquiry");

  if (preset === "image_left_text_right") {
    return {
      ...createPageSection(sectionId, leftColumnId),
      preset: "feature",
      columns: [
        {
          ...createPageColumn(leftColumnId),
          width: "1/2",
          blocks: [imageBlock],
        },
        {
          ...createPageColumn(rightColumnId),
          width: "1/2",
          blocks: [textBlock],
        },
      ],
    };
  }

  if (preset === "text_left_cta_right") {
    return {
      ...createPageSection(sectionId, leftColumnId),
      preset: "feature",
      columns: [
        {
          ...createPageColumn(leftColumnId),
          width: "2/3",
          blocks: [textBlock],
        },
        {
          ...createPageColumn(rightColumnId),
          width: "1/3",
          blocks: [ctaBlock],
        },
      ],
    };
  }

  return {
    ...createPageSection(sectionId, leftColumnId),
    preset: "feature",
    columns: [
      {
        ...createPageColumn(leftColumnId),
        width: "1/2",
        blocks: [textBlock],
      },
      {
        ...createPageColumn(rightColumnId),
        width: "1/2",
        blocks: [imageBlock],
      },
    ],
  };
}

function starterRichText(
  heading: string,
  body: string,
  variant: Extract<PageBlock, { type: "rich_text" }>["variant"] = "default",
): PageBlock {
  const block = createPageBlock("rich_text", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "rich_text" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      heading,
      body: { version: 1, nodes: [{ type: "paragraph", text: body }] },
    },
  };
}

function starterCta(
  label: string,
  variant: Extract<PageBlock, { type: "cta" }>["variant"] = "primary",
): PageBlock {
  const block = createPageBlock("cta", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "cta" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      label,
      href: "/apply",
      trackingName: slugify(label),
    },
  };
}

function starterImage(): PageBlock {
  const block = createPageBlock("image", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "image" }
  >;
  return {
    ...block,
    variant: "feature",
    props: {
      ...block.props,
      altText: "Describe the image before publishing",
      caption: "Choose a media asset and update the caption.",
    },
  };
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
  if (block.type === "cta" && !block.props.presetId) {
    const label = block.props.label || "Start an enquiry";
    return {
      ...block,
      props: {
        ...block.props,
        label,
        href: block.props.href || "/apply",
        trackingName:
          block.props.trackingName || trackingNameForLabel(label, "cta"),
      },
    };
  }

  if (block.type === "lead_form") {
    return {
      ...block,
      props: {
        ...block.props,
        trackingName:
          block.props.trackingName ||
          trackingNameForLabel(block.props.submitLabel, "lead-form"),
      },
    };
  }

  if (
    block.type === "rich_text" &&
    block.variant === "checklist" &&
    !hasEditorText(richTextDocumentPlainText(block.props.body))
  ) {
    return {
      ...block,
      props: {
        ...block.props,
        body: {
          version: 1,
          nodes: [{ type: "list", style: "bullet", items: ["", "", ""] }],
        },
      },
    };
  }

  if (
    block.type === "faq" &&
    (block.props.items.length === 0 || block.props.items.every(isBlankFaqItem))
  ) {
    const itemCount = block.variant === "accordion" ? 3 : 2;
    return {
      ...block,
      props: {
        ...block.props,
        items: Array.from({ length: itemCount }, () => ({
          question: "",
          answer: "",
        })),
      },
    };
  }

  if (
    block.type === "card_grid" &&
    (block.props.cards.length === 0 || block.props.cards.every(isBlankCard))
  ) {
    const cardCount = block.variant === "compact" ? 4 : 3;
    return {
      ...block,
      props: {
        ...block.props,
        cards: Array.from({ length: cardCount }, createBlankCard),
      },
    };
  }

  return block;
}

function trackingNameForLabel(
  label: string | null | undefined,
  fallback: string,
) {
  return slugify(label ?? "") || fallback;
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

  return block.props.body.nodes
    .map((node) => {
      if (node.type === "list") return node.items.join("\n");
      if (node.type === "paragraph" && "spans" in node) {
        return node.spans.map((span) => span.text).join("");
      }
      return node.text;
    })
    .filter((value) => value.length > 0)
    .join("\n");
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

function columnGridClass(count: number) {
  return resourceColumnGridClass(count);
}

type FaqBlock = Extract<PageBlock, { type: "faq" }>;
type FaqItem = FaqBlock["props"]["items"][number];
type CardGridBlock = Extract<PageBlock, { type: "card_grid" }>;
type CardItem = CardGridBlock["props"]["cards"][number];

function updateFirstFaqItem(
  items: FaqItem[],
  patch: Partial<FaqItem>,
): FaqItem[] {
  if (items.length === 0) {
    return [{ question: patch.question ?? "", answer: patch.answer ?? "" }];
  }
  return items.map((item, index) =>
    index === 0 ? { ...item, ...patch } : item,
  );
}

function createBlankCard(): CardItem {
  return { title: "", body: "", href: "" };
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
    if (!hasEditorText(block.props.body)) {
      messages.push("Add a short hero summary so the page has a clear lead.");
    }
    if (
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
    if (!hasEditorText(block.props.heading)) {
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

  if (block.type === "card_grid" && block.props.cards.length === 0) {
    messages.push("Add at least one card or remove this content.");
  }

  if (block.type === "proof" && !hasEditorText(block.props.body)) {
    messages.push("Add the proof quote or stat text.");
  }

  if (block.type === "lead_form") {
    if (!hasEditorText(block.props.heading)) {
      messages.push("Add a lead form heading.");
    }
    if (!hasEditorText(block.props.body)) {
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
    "inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-lg transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none";

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

const headlineInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-5xl leading-[0.95] font-black text-[#111111] uppercase outline-none transition placeholder:text-slate-300 hover:bg-white/55 focus:border-[#55b8e8] focus:bg-white focus:ring-4 focus:ring-[#55b8e8]/20 md:text-7xl";

const pageLeadInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl leading-8 font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 hover:bg-white/55 focus:border-[#55b8e8] focus:bg-white focus:ring-4 focus:ring-[#55b8e8]/20";

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
  "rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400 shadow-sm";

const compactInputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

const primaryButtonClass =
  "rounded-lg bg-[#0b63f6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0756d6] hover:shadow focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const miniButtonClass =
  "rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const menuButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none";

const dangerButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:text-red-700 focus-visible:ring-4 focus-visible:ring-red-100 focus-visible:outline-none text-left";

const dragHandleClass =
  "inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none active:cursor-grabbing";

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
