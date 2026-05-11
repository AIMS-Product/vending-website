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
import {
  acceptAiSeoProposalBlocks,
  autosaveSeoPageDraft,
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
  ensureEditablePageContent,
  moveItem,
  reorderItemsById,
  type MoveDirection,
} from "@/lib/page-builder/content-ops";
import type { Tables } from "@/types/database";

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

type StarterTemplate = "service" | "location" | "comparison" | "faq";
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
  const [isSeoPanelOpen, setIsSeoPanelOpen] = useState(false);
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
  const canPublish = Boolean(page?.id);
  const publishDisabled = !canPublish || seoReadiness.blockers.length > 0;
  const primarySection = content.sections[0] ?? null;
  const primaryColumn = primarySection?.columns[0] ?? null;
  const usesSimpleBlockStack =
    content.sections.length <= 1 && (primarySection?.columns.length ?? 0) <= 1;
  const canUseStarterTemplates =
    !page?.id &&
    !hasEditorText(title) &&
    !hasEditorText(metaDescription) &&
    content.sections.every((section) =>
      section.columns.every((column) => column.blocks.length === 0),
    );
  const saveMessage =
    redirectError ??
    state.message ??
    (state.status === "error" ? "Save failed." : "Draft saved.");

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

  return (
    <form action={formAction}>
      {page?.id && <input type="hidden" name="id" value={page.id} />}
      <input type="hidden" name="draftContent" value={draftContentJson} />

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/pages"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Back to pages"
            >
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
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span className="sr-only">Back to pages</span>
            </Link>
            <div className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-slate-200 hover:bg-slate-50">
              <span className="text-sm text-slate-400">/resources/</span>
              <input
                name="slug"
                value={visibleSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                required
                aria-label="Slug"
                className="w-48 bg-transparent text-sm font-medium text-slate-700 transition-all outline-none placeholder:text-slate-300 focus:w-64"
                placeholder="page-slug"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {page?.status ?? "draft"}
            </span>
            <button
              type="button"
              className={`${smallButtonClass} ${readinessButtonClass(
                seoReadiness.status,
              )}`}
              onClick={() => setIsSeoPanelOpen(true)}
            >
              SEO: {seoReadiness.label}
            </button>
            <button className={secondaryButtonClass} name="intent" value="save">
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
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {(state.status !== "idle" ||
          savedFromRedirect ||
          redirectError ||
          autosave ||
          !canPublish) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
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
            {!canPublish && (
              <p className="text-slate-500">
                Create the draft before publishing.
              </p>
            )}
          </div>
        )}

        {canUseStarterTemplates && (
          <StarterTemplatePanel onUseTemplate={applyStarterTemplate} />
        )}

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
          onOpenSettings={() => setIsSeoPanelOpen(true)}
          mediaAssetCount={mediaAssets.length}
        />

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 bg-white">
            <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
              {targetKeyword && (
                <div className="bg-brand-50 text-brand-700 ring-brand-700/10 mb-4 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset">
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
                    <path d="M12 2v20" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  {targetKeyword}
                </div>
              )}
              <label className="block">
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
              <label className="mt-4 block max-w-3xl">
                <span className="sr-only">Meta description</span>
                <textarea
                  name="metaDescription"
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                  rows={3}
                  placeholder="Opening summary shown at the top of the page."
                  id="page-meta-description-field"
                  className={leadInputClass}
                />
              </label>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Content blocks
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add reusable content blocks in the order they should appear on
                  the page.
                </p>
              </div>
              <div className="relative" ref={layoutOptionsRef}>
                <button
                  type="button"
                  className={`${smallButtonClass} inline-flex items-center gap-2`}
                  onClick={() => setIsLayoutOptionsOpen(!isLayoutOptionsOpen)}
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
                  Layout options
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
                  <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 focus:outline-none">
                    <div className="px-3 py-2 text-xs font-medium tracking-wider text-slate-500 uppercase">
                      Add Layout Preset
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
                  handleBlockDragEnd(primarySection.id, primaryColumn.id, event)
                }
                onAddBlock={(type, variant) =>
                  addBlock(primarySection.id, primaryColumn.id, type, variant)
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
                onBlockRemove={(blockId) =>
                  removeBlock(primarySection.id, primaryColumn.id, blockId)
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
                  <div className="space-y-10">
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
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M3 9h18" />
                            <path d="M9 21V9" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          No content blocks
                        </h3>
                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                          Get started by adding a layout preset or a new content
                          block to build your page.
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
                          Add first block
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
                          onSectionRemove={() => removeSection(section.id)}
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
                            replaceBlock(section.id, columnId, blockId, next)
                          }
                          onBlockMove={(columnId, blockId, direction) =>
                            moveBlock(section.id, columnId, blockId, direction)
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
      </div>

      {isSeoPanelOpen && (
        <button
          type="button"
          aria-label="Close SEO settings"
          className="fixed inset-0 z-40 bg-slate-950/20"
          onClick={() => setIsSeoPanelOpen(false)}
        />
      )}
      <aside
        inert={!isSeoPanelOpen ? true : undefined}
        className={`fixed top-0 right-0 z-50 h-dvh w-full max-w-md bg-white shadow-2xl ring-1 ring-slate-900/5 transition-transform duration-300 ease-in-out ${
          isSeoPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isSeoPanelOpen}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              SEO Settings
            </h2>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setIsSeoPanelOpen(false)}
            >
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
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <SeoReadinessDetails summary={seoReadiness} />

            <div className="space-y-5 border-t border-slate-100 pt-6">
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
              <div className="block">
                <span className="text-sm font-semibold text-slate-900">
                  Meta description
                </span>
                <div className="mt-2 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
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
                    className="mt-0.5 shrink-0 text-slate-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  Edit this directly in the page header area.
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">
                  Canonical URL
                </span>
                <input
                  name="canonicalUrl"
                  value={canonicalUrl}
                  id="seo-canonical-url-field"
                  onChange={(event) => setCanonicalUrl(event.target.value)}
                  className={compactInputClass}
                  placeholder="https://..."
                />
              </label>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-700">
                  <input
                    name="noindex"
                    type="checkbox"
                    checked={noindex}
                    onChange={(event) => {
                      setNoindex(event.target.checked);
                      if (event.target.checked) setSitemapEnabled(false);
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0b63f6] focus:ring-[#0b63f6]"
                  />
                  <div>
                    <span className="block text-slate-900">
                      Noindex this page
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Hide from search engines
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
                      Help search engines find this page
                    </span>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          </div>
        </div>
      </aside>
      <input type="hidden" name="seoTitle" value={seoTitle} />
      <input type="hidden" name="targetKeyword" value={targetKeyword} />
      <input type="hidden" name="canonicalUrl" value={canonicalUrl} />
      {noindex && <input type="hidden" name="noindex" value="on" />}
      {sitemapEnabled && !noindex && (
        <input type="hidden" name="sitemapEnabled" value="on" />
      )}
    </form>
  );

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
      const nextBlock = createPageBlock(type, makeBuilderId("block"));

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

  function applyStarterTemplate(template: StarterTemplate) {
    const starter = starterTemplateFor(template);
    setTitle(starter.title);
    setSlug(slugify(starter.title));
    setSlugTouched(true);
    setTargetKeyword(starter.targetKeyword);
    setSeoTitle(starter.seoTitle);
    setMetaDescription(starter.metaDescription);
    setContent(starter.content);
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
        message: "Save the draft before inserting AI blocks.",
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
        message: "Could not insert AI proposal blocks.",
      });
    } finally {
      setIsAiInserting(false);
    }
  }
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
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
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
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
            SEO Command Centre
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${readinessPillClass(
                summary.status,
              )} ring-1 ring-black/5 ring-inset`}
            >
              {summary.label}
            </span>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                {summary.blockers.length} blockers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                {summary.warnings.length} warnings
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                {summary.opportunities.length} opportunities
              </span>
            </div>
          </div>
        </div>
        <div>
          <button
            type="button"
            className={`${smallButtonClass} inline-flex items-center gap-2`}
            onClick={onOpenSettings}
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
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Review SEO settings
          </button>
        </div>
      </div>

      <div className="grid gap-px border-y border-slate-100 bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        {summary.categories.map((category) => (
          <div
            key={category.category}
            className={`bg-white p-5 transition-colors hover:bg-slate-50 ${readinessCategoryClass(
              category.status,
            )}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {category.label}
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

      <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Action Items
            </h3>
            <span className="text-sm font-medium text-slate-500">
              Highest impact first
            </span>
          </div>

          {topFindings.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              No readiness findings on this draft. Review the public preview
              before publishing.
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-950">
              Builder support
            </h3>
            <div className="mt-3 grid gap-2">
              <Link
                href="/admin/media"
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white"
              >
                Media library
                <span className="mt-1 block text-xs leading-5 font-medium text-slate-500">
                  {mediaAssetCount > 0
                    ? `${mediaAssetCount} assets available for image blocks`
                    : "No assets yet. Add images, alt text, and rights notes."}
                </span>
              </Link>
              <Link
                href="/admin/libraries"
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white"
              >
                Content libraries
                <span className="mt-1 block text-xs leading-5 font-medium text-slate-500">
                  Manage CTA presets, approved claims, source excerpts, and
                  proof items.
                </span>
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  SEO agent
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Source-backed drafts stay separate until selected blocks are
                  inserted.
                </p>
              </div>
              <button
                type="button"
                className={miniButtonClass}
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
                className={`mt-3 rounded-md bg-white px-3 py-2 text-xs leading-5 ring-1 ${
                  aiProposalResult.status === "error"
                    ? "text-red-700 ring-red-100"
                    : "text-emerald-700 ring-emerald-100"
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
      </div>

      {(internalLinkSuggestions.length > 0 || linkSuggestionMessage) && (
        <div className="mx-4 mb-4 rounded-lg border border-sky-100 bg-sky-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Internal link suggestions
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Add relevant links from the copy that already exists on this
                page.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
              {internalLinkSuggestions.length} available
            </span>
          </div>

          {linkSuggestionMessage && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-sky-100">
              {linkSuggestionMessage}
            </p>
          )}

          {internalLinkSuggestions.length > 0 && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {internalLinkSuggestions.slice(0, 4).map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-sky-100"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    Link {suggestion.anchorText}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {suggestion.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs break-all text-sky-700">
                      {suggestion.targetPath}
                    </span>
                    <button
                      type="button"
                      className={miniButtonClass}
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

const starterTemplateOptions: Array<{
  id: StarterTemplate;
  label: string;
  description: string;
  blocks: string;
}> = [
  {
    id: "service",
    label: "Service page",
    description: "A general offer page with proof, FAQ, and conversion CTA.",
    blocks: "Hero · Text · FAQ · CTA",
  },
  {
    id: "location",
    label: "Location page",
    description: "A local-market page with lead capture and service details.",
    blocks: "Hero · Text · Cards · Form",
  },
  {
    id: "comparison",
    label: "Comparison page",
    description: "A decision page for buyers comparing options.",
    blocks: "Hero · Cards · Proof · CTA",
  },
  {
    id: "faq",
    label: "FAQ page",
    description: "A support-heavy page for objections and search questions.",
    blocks: "Text · FAQ · CTA",
  },
];

const layoutPresetOptions: Array<{
  id: LayoutPreset;
  label: string;
  description: string;
}> = [
  {
    id: "full_width_hero",
    label: "Full-width hero",
    description: "Add a single hero block across the page width.",
  },
  {
    id: "full_width_text",
    label: "Full-width text",
    description: "Add a single rich-text block for long-form copy.",
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
    description: "Pair explanatory copy with a focused conversion block.",
  },
];

function StarterTemplatePanel({
  onUseTemplate,
}: {
  onUseTemplate: (template: StarterTemplate) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="bg-brand-50 text-brand-700 inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold">
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
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
              <path d="M2 7h20" />
              <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
            </svg>
            Starter Templates
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            Pick a page shape to start
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            You can always edit the blocks later.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {starterTemplateOptions.map((template) => (
          <button
            key={template.id}
            type="button"
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-[#0b63f6]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
            onClick={() => onUseTemplate(template.id)}
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-[#0b63f6]/10 group-hover:text-[#0b63f6]">
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
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <span className="text-base font-semibold text-slate-900 transition-colors group-hover:text-[#0b63f6]">
              {template.label}
            </span>
            <span className="mt-1 flex-1 text-sm text-slate-500">
              {template.description}
            </span>
            <span className="mt-4 block rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {template.blocks}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

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
        className={miniButtonClass}
        onClick={() => onAddSuggestedBlock(suggestedBlock.type)}
      >
        {suggestedBlock.label}
      </button>
    );
  }

  if (requiresSeoSettings(finding)) {
    return (
      <button
        type="button"
        className={miniButtonClass}
        onClick={onOpenSettings}
      >
        Open SEO settings
      </button>
    );
  }

  if (anchor) {
    return (
      <a href={anchor} className={miniButtonClass}>
        Go to field
      </a>
    );
  }

  return (
    <span className="text-xs font-medium text-slate-500">
      Review the highlighted area in the editor.
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
    return { type: "image", label: "Add image block" };
  }
  if (
    finding.code === "missing_faq_opportunity" ||
    finding.code === "empty_faq_block"
  ) {
    return { type: "faq", label: "Add FAQ block" };
  }
  if (
    finding.code === "missing_conversion_block" ||
    finding.code === "empty_cta_label" ||
    finding.code === "empty_cta_link"
  ) {
    return { type: "cta", label: "Add CTA block" };
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
      return `Block ${blockNumber} · ${friendlyFieldName(propName)} ${
        Number(childIndex) + 1
      } ${readableProp}`;
    }
    return `Block ${blockNumber} · ${readableProp}`;
  }
  return friendlyFieldName(finding.path);
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
              ? "Review selected blocks before inserting them into the page."
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
            {isInserting ? "Inserting..." : "Insert selected blocks"}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-violet-50 px-2 py-2">
          <p className="text-lg font-semibold text-slate-950">
            {proposal.proposal.blocks.length}
          </p>
          <p className="text-[11px] font-medium text-slate-500">Blocks</p>
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
          Review block changes · {selectableCount} safe to insert
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
  if (block.type === "image") return block.props.altText || "Image block";
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

function SeoReadinessDetails({ summary }: { summary: SeoReadinessSummary }) {
  const findings = [
    ...summary.blockers,
    ...summary.warnings,
    ...summary.opportunities,
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase">
            Readiness
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            {summary.label}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${readinessPillClass(
            summary.status,
          )}`}
        >
          {summary.blockers.length} / {summary.warnings.length} /{" "}
          {summary.opportunities.length}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>{summary.metrics.visibleWordCount} words</span>
        <span>{summary.metrics.blockCount} blocks</span>
        <span>{summary.metrics.internalLinkCount} links</span>
        <span>{summary.metrics.faqItemCount} FAQs</span>
      </div>

      {findings.length > 0 ? (
        <div className="mt-4 space-y-3">
          {findings.map((finding, index) => (
            <div
              key={`${finding.code}-${finding.path}-${index}`}
              className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  {finding.severity}
                </span>
                <span className="text-xs text-slate-400">
                  {friendlyFindingLocation(finding)}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {finding.message}
              </p>
              {friendlyEvidenceText(finding) && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {friendlyEvidenceText(finding)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No SEO readiness findings on this draft.
        </p>
      )}
    </div>
  );
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
      className={`relative rounded-xl border border-slate-300 bg-slate-50/80 p-4 shadow-sm ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-3 text-xs shadow-[inset_4px_0_0_#0b63f6]">
        <div className="flex min-w-0 items-center gap-3">
          <DragHandle
            label={`Reorder section ${sectionIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-[#0b63f6] uppercase">
              Section
            </p>
            <h3 className="text-sm font-semibold text-slate-950">
              Section {sectionIndex + 1}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Page layout area · {section.columns.length}{" "}
              {section.columns.length === 1 ? "column" : "columns"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            className={smallButtonClass}
            disabled={section.columns.length >= 4}
            onClick={onAddColumn}
          >
            Add column
          </button>
          <MoreActions label={`Section ${sectionIndex + 1} actions`}>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={onSectionRemove}
            >
              Remove section
            </button>
          </MoreActions>
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
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Add a column before adding blocks.
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
        <div className="space-y-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {column.blocks.length === 0 ? (
            <BlockPicker onAddBlock={onAddBlock} />
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
      className={`relative min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-[inset_0_0_0_1px_#f1f5f9] ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-100/80 px-3 py-3 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <DragHandle
            label={`Reorder column ${columnIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Column
            </p>
            <h4 className="text-sm font-semibold text-slate-900">
              Column {columnIndex + 1}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Content lane · {column.blocks.length}{" "}
              {column.blocks.length === 1 ? "block" : "blocks"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            icon="up"
            label={`Move column ${columnIndex + 1} up`}
            disabled={columnIndex === 0}
            onClick={() => onColumnMove("up")}
          />
          <IconButton
            icon="down"
            label={`Move column ${columnIndex + 1} down`}
            disabled={columnIndex === columnCount - 1}
            onClick={() => onColumnMove("down")}
          />
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
      </header>

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
          <div className="space-y-6">
            {column.blocks.length === 0 ? (
              <BlockPicker onAddBlock={onAddBlock} />
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
  return (
    <details className="rounded-lg border border-dashed border-slate-300 bg-white p-4 shadow-[inset_0_0_0_1px_#f8fafc]">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Add content block
        <span className="ml-2 text-xs font-medium text-slate-500">
          Choose the content type for this column.
        </span>
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blockPickerOptions.map((option) => (
          <article
            key={option.type}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <span className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200"
                aria-hidden="true"
              >
                <BuilderGlyph name={option.type} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {option.description}
                </span>
              </span>
            </span>
            <div className="mt-3">
              <BlockPreviewSkeleton type={option.type} />
            </div>
            <div className="mt-3 grid gap-2">
              {option.variants.map((variant) => (
                <button
                  key={`${option.type}-${variant.id}`}
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#0b63f6]/30 hover:bg-[#f7fbff] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                  onClick={() => onAddBlock(option.type, variant.id)}
                >
                  <span className="block text-xs font-semibold text-slate-900">
                    {variant.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                    {variant.description}
                  </span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

function BlockPreviewSkeleton({ type }: { type: PageBlock["type"] }) {
  if (type === "hero") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="bg-brand-200 h-2 w-16 rounded" />
        <div className="h-4 w-4/5 rounded bg-slate-300" />
        <div className="h-3 w-2/3 rounded bg-slate-200" />
        <div className="bg-brand-400 h-5 w-20 rounded-full" />
      </div>
    );
  }
  if (type === "image") {
    return (
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="aspect-video rounded-md border border-dashed border-slate-300 bg-white" />
        <div className="mt-2 h-2 w-1/2 rounded bg-slate-200" />
      </div>
    );
  }
  if (type === "lead_form") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="h-3 w-3/4 rounded bg-slate-300" />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
          <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
          <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
          <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
        </div>
        <div className="bg-brand-400 h-5 w-20 rounded-full" />
      </div>
    );
  }
  if (type === "card_grid") {
    return (
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-50 p-3">
        <SkeletonCard miniature />
        <SkeletonCard miniature />
        <SkeletonCard miniature />
      </div>
    );
  }
  if (type === "faq") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="h-3 w-2/3 rounded bg-slate-300" />
        <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
        <div className="h-5 rounded bg-white ring-1 ring-slate-200" />
      </div>
    );
  }
  if (type === "proof") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-100 p-3">
        <div className="bg-brand-200 h-3 w-16 rounded" />
        <div className="h-3 w-4/5 rounded bg-slate-400" />
        <div className="h-3 w-2/3 rounded bg-slate-300" />
      </div>
    );
  }
  if (type === "video") {
    return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="grid aspect-video place-items-center rounded-md bg-slate-200">
          <div className="h-5 w-5 rounded-full bg-white" />
        </div>
        <div className="h-2 w-2/3 rounded bg-slate-200" />
      </div>
    );
  }
  if (type === "cta") {
    return (
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="bg-brand-400 h-6 w-24 rounded-full" />
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="h-3 w-3/4 rounded bg-slate-300" />
      <div className="h-2 w-full rounded bg-slate-200" />
      <div className="h-2 w-2/3 rounded bg-slate-200" />
    </div>
  );
}

function SkeletonCard({ miniature = false }: { miniature?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white ${
        miniature ? "h-12 p-2" : "p-5"
      }`}
    >
      <div className="h-3 w-3/4 rounded bg-slate-200" />
      {!miniature && (
        <>
          <div className="mt-3 h-2 w-full rounded bg-slate-100" />
          <div className="mt-2 h-2 w-2/3 rounded bg-slate-100" />
        </>
      )}
    </div>
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
  onRemove,
}: {
  block: PageBlock;
  index: number;
  blockNumber: number;
  blockCount: number;
  mediaAssets: SeoPageEditorMediaAsset[];
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
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
            label={`Reorder ${blockLabel(block.type)} block ${index + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
        }
        onChange={onChange}
        mediaAssets={mediaAssets}
        onMove={onMove}
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
  onRemove: () => void;
}) {
  const blockCompletionMessages = completionMessagesForBlock(block);
  const completionStatus =
    blockCompletionMessages.length > 0 ? "Needs content" : "Ready";

  return (
    <article
      id={`builder-block-${blockNumber}`}
      className={`relative scroll-mt-28 rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-[#0b63f6]/50 focus-within:ring-4 focus-within:ring-[#0b63f6]/5 ${
        isDragging
          ? "z-10 scale-[1.01] border-[#0b63f6] shadow-2xl"
          : "hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <BlockToolbar
        label={`Block ${blockNumber}`}
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
          onChange(withBlockVariant(block, variant))
        }
        onMove={onMove}
        onRemove={onRemove}
      />

      {block.type === "rich_text" && (
        <div className="max-w-3xl rounded-2xl px-4 py-5">
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
              value={bodyText(block)}
              placeholder="Write the page copy here."
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    body: {
                      version: 1,
                      nodes: [{ type: "paragraph", text: event.target.value }],
                    },
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
        <div className="max-w-4xl rounded-2xl px-4 py-8">
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
            <label className="bg-brand-500 inline-flex max-w-xs rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm">
              <span className="sr-only">CTA label</span>
              <input
                value={block.props.ctaLabel}
                placeholder="CTA label"
                onChange={(event) =>
                  onChange({
                    ...block,
                    props: { ...block.props, ctaLabel: event.target.value },
                  })
                }
                className="w-full min-w-24 bg-transparent text-white outline-none placeholder:text-white/70"
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
                label="CTA tracking"
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
        </div>
      )}

      {block.type === "image" && (
        <figure className="rounded-2xl px-4 py-4">
          {block.props.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.props.src}
              alt={block.props.altText}
              className="aspect-video w-full rounded-xl border border-slate-200 object-cover shadow-sm"
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
                    Add image assets in the media library before selecting one
                    here.
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
        <div className="rounded-xl bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="CTA label"
              value={block.props.label}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: { ...block.props, label: value },
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
              label="Tracking name"
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
        </div>
      )}

      {block.type === "video" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <TextInput
            label="Title"
            value={block.props.title}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, title: value } })
            }
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput
              label="URL"
              value={block.props.url}
              onChange={(value) =>
                onChange({ ...block, props: { ...block.props, url: value } })
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
        <div className="max-w-3xl rounded-2xl px-4 py-4">
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
          <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
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
        <div className="rounded-2xl px-4 py-4">
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
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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
        <figure className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, eyebrow: value } })
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
                onChange({ ...block, props: { ...block.props, name: value } })
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
          </div>
        </figure>
      )}

      {block.type === "lead_form" && (
        <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div>
            <label className="block">
              <span className="sr-only">Heading</span>
              <input
                value={block.props.heading}
                placeholder="Lead form heading"
                onChange={(event) =>
                  onChange({
                    ...block,
                    props: { ...block.props, heading: event.target.value },
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
            <label className="bg-brand-500 inline-flex max-w-xs rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm">
              <span className="sr-only">Submit label</span>
              <input
                value={block.props.submitLabel}
                placeholder="Submit label"
                onChange={(event) =>
                  onChange({
                    ...block,
                    props: { ...block.props, submitLabel: event.target.value },
                  })
                }
                className="w-full min-w-24 bg-transparent text-white outline-none placeholder:text-white/70"
              />
            </label>
            <TextInput
              label="Tracking name"
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
  onRemove: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-slate-100 bg-white px-4 py-3 text-xs">
      <div className="flex min-w-0 items-center gap-3">
        {dragHandle}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/50 ring-inset"
          aria-hidden="true"
        >
          <BuilderGlyph name={icon} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {label}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {typeLabel}
            </span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100 ring-inset">
              {variantLabel}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                status === "Ready"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/50"
                  : "bg-amber-50 text-amber-700 ring-amber-200/50"
              }`}
            >
              {status}
            </span>
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold text-slate-900">
            {description}
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
        <MoreActions label={`${label} actions`}>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onRemove}
          >
            Remove block
          </button>
        </MoreActions>
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
      <BuilderGlyph name="grip" />
    </button>
  );
}

function IconButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: "up" | "down" | "more";
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
      <BuilderGlyph name={icon} />
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
  return (
    <details className="relative">
      <summary
        aria-label={label}
        title={label}
        className={`${iconButtonClass} list-none [&::-webkit-details-marker]:hidden`}
      >
        <BuilderGlyph name="more" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
        {children}
      </div>
    </details>
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
    "Use this text block to explain the offer, objection, comparison point, or local context that supports the page goal.",
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

function starterTemplateFor(template: StarterTemplate): {
  title: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  content: PageContent;
} {
  if (template === "location") {
    return {
      title: "Vending Services in Your Market",
      targetKeyword: "vending services",
      seoTitle: "Vending Services for Local Businesses",
      metaDescription:
        "Build a local vending services page with market fit, service details, and a clear lead form for qualified enquiries.",
      content: starterContent([
        starterHero(
          "Bring reliable vending services to your location",
          "Use this page to explain the customer segment, service promise, and next step for local buyers.",
          "Request local vending support",
          "split",
        ),
        starterRichText(
          "Who this vending service supports",
          "Describe the site type, expected foot traffic, product needs, and how the vending offer helps the location.",
          "intro",
        ),
        starterCards("Common location needs", [
          {
            title: "Staff convenience",
            body: "Explain how the service supports employees, visitors, or students.",
            href: "/contact",
          },
          {
            title: "Product mix",
            body: "Summarise the drinks, snacks, or healthy options that suit this market.",
            href: "/apply",
          },
          {
            title: "Service expectations",
            body: "Set expectations for restocking, maintenance, and support.",
            href: "/case-studies",
          },
        ]),
        starterLeadForm(),
      ]),
    };
  }

  if (template === "comparison") {
    return {
      title: "Compare Vending Options Before You Buy",
      targetKeyword: "vending machine options",
      seoTitle: "Compare Vending Machine Options Before You Buy",
      metaDescription:
        "Create a comparison page that helps buyers weigh purchase paths, operating support, and next steps before choosing a vending option.",
      content: starterContent([
        starterHero(
          "Compare vending options before you commit",
          "Use this page to make the tradeoffs clear and help buyers choose a realistic next step.",
          "Compare options",
          "editorial",
        ),
        starterCards(
          "What buyers should compare",
          [
            {
              title: "Upfront cost",
              body: "Explain the capital needed and what is included in each option.",
              href: "/apply",
            },
            {
              title: "Operating support",
              body: "Clarify training, servicing, supplier access, and route planning support.",
              href: "/contact",
            },
            {
              title: "Growth flexibility",
              body: "Show how each option supports starting small or expanding later.",
              href: "/case-studies",
            },
          ],
          "feature",
        ),
        starterProof("stat"),
        starterCta("Get comparison guidance", "secondary"),
      ]),
    };
  }

  if (template === "faq") {
    return {
      title: "Vending Questions Answered",
      targetKeyword: "vending questions",
      seoTitle: "Common Vending Questions Answered",
      metaDescription:
        "Create a question-led resource page that answers search objections and gives readers a clear next step.",
      content: starterContent([
        starterRichText(
          "Answers for common vending questions",
          "Use this introduction to frame who the answers are for and what decision the page helps them make.",
          "intro",
        ),
        starterFaq("Common vending questions", "accordion"),
        starterCta("Talk to a vending specialist", "text"),
      ]),
    };
  }

  return {
    title: "Vending Services for Growing Locations",
    targetKeyword: "vending services",
    seoTitle: "Vending Services for Growing Locations",
    metaDescription:
      "Create a service page with a clear offer, supporting detail, FAQs, and a conversion path for qualified vending enquiries.",
    content: starterContent([
      starterHero(
        "Vending services built around your location",
        "Use this page to explain the offer, qualify the customer, and guide them toward the next step.",
        "Start a vending enquiry",
      ),
      starterRichText(
        "What the service includes",
        "Describe the setup process, product planning, servicing expectations, and what makes this page relevant to the target search.",
        "checklist",
      ),
      starterFaq("Questions buyers usually ask"),
      starterCta("Request vending guidance"),
    ]),
  };
}

function starterContent(blocks: PageBlock[]): PageContent {
  const sectionId = makeBuilderId("section");
  const columnId = makeBuilderId("column");

  return {
    version: 1,
    sections: [
      {
        ...createPageSection(sectionId, columnId),
        columns: [
          {
            ...createPageColumn(columnId),
            blocks,
          },
        ],
      },
    ],
  };
}

function starterHero(
  heading: string,
  body: string,
  ctaLabel: string,
  variant: Extract<PageBlock, { type: "hero" }>["variant"] = "standard",
): PageBlock {
  const block = createPageBlock("hero", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "hero" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      eyebrow: "Resource guide",
      heading,
      body,
      ctaLabel,
      ctaHref: "/apply",
      ctaTrackingName: slugify(ctaLabel),
    },
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

function starterCards(
  heading: string,
  cards: Extract<PageBlock, { type: "card_grid" }>["props"]["cards"],
  variant: Extract<PageBlock, { type: "card_grid" }>["variant"] = "standard",
): PageBlock {
  const block = createPageBlock("card_grid", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "card_grid" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      heading,
      cards,
    },
  };
}

function starterFaq(
  heading: string,
  variant: Extract<PageBlock, { type: "faq" }>["variant"] = "standard",
): PageBlock {
  const block = createPageBlock("faq", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "faq" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      heading,
      items: [
        {
          question: "What should this page answer first?",
          answer:
            "Replace this with the most important search objection or buyer question for this topic.",
        },
      ],
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

function starterProof(
  variant: Extract<PageBlock, { type: "proof" }>["variant"] = "quote",
): PageBlock {
  const block = createPageBlock("proof", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "proof" }
  >;
  return {
    ...block,
    variant,
    props: {
      ...block.props,
      eyebrow: "Proof point",
      body: "Replace this with an approved claim, testimonial, or source-backed stat.",
      name: "Approved source",
      context: "Content library",
    },
  };
}

function starterLeadForm(): PageBlock {
  const block = createPageBlock("lead_form", makeBuilderId("block")) as Extract<
    PageBlock,
    { type: "lead_form" }
  >;
  return {
    ...block,
    variant: "standard",
    props: {
      ...block.props,
      heading: "Request vending support",
      body: "Share the market, location type, and timeline so the team can qualify the next step.",
      submitLabel: "Request support",
      trackingName: "request-support",
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
  if (!variant) return block;
  return withBlockVariant(block, variant);
}

function withBlockVariant(block: PageBlock, variant: BlockVariant): PageBlock {
  return { ...block, variant } as PageBlock;
}

function bodyText(block: Extract<PageBlock, { type: "rich_text" }>) {
  return richTextDocumentPlainText(block.props.body);
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
  if (block.type === "hero") return "Hero block missing headline";
  if (block.type === "rich_text") return "Text block missing heading";
  if (block.type === "image") return "Image block missing media";
  if (block.type === "cta") return "CTA block missing button copy";
  if (block.type === "faq") return "FAQ block missing question";
  if (block.type === "card_grid") return "Card grid missing heading";
  if (block.type === "proof") return "Proof block missing quote or stat";
  if (block.type === "video") return "Video block missing title";
  return "Lead form missing heading";
}

function columnGridClass(count: number) {
  if (count <= 1) return "grid gap-8";
  return "grid gap-8 md:grid-cols-2";
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
      messages.push("Choose an image or remove this image block.");
    }
    if (!hasEditorText(block.props.altText)) {
      messages.push("Add descriptive alt text for this image.");
    }
  }

  if (block.type === "video" && !hasEditorText(block.props.url)) {
    messages.push("Add a video URL or remove this video block.");
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
    messages.push("Add at least one card or remove this card block.");
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
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "needs_work") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "opportunities") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function readinessCategoryClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "shadow-[inset_3px_0_0_#dc2626]";
  if (status === "needs_work") return "shadow-[inset_3px_0_0_#d97706]";
  if (status === "opportunities") return "shadow-[inset_3px_0_0_#0284c7]";
  return "shadow-[inset_3px_0_0_#059669]";
}

function findingDotClass(severity: "blocker" | "warning" | "opportunity") {
  if (severity === "blocker") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

const headlineInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-2 text-4xl font-semibold tracking-tight text-slate-950 outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10 md:text-5xl";

const leadInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-2 text-lg leading-8 text-slate-600 outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10";

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
  "rounded-md bg-[#0b63f6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "rounded-md bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const miniButtonClass =
  "rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none";

const dragHandleClass =
  "inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none active:cursor-grabbing";

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
