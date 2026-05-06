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
import {
  autosaveSeoPageDraft,
  saveSeoPage,
  type PageAutosaveResult,
  type PageEditorActionState,
} from "@/app/admin/pages/actions";
import {
  createEmptyPageContent,
  pageContentSchema,
  type PageBlock,
  type PageColumn,
  type PageContent,
  type PageSection,
} from "@/lib/page-builder/blocks";
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

type SeoPageEditorFormProps = {
  page?: SeoPage;
  savedFromRedirect?: boolean;
  redirectError?: string;
};

const initialState: PageEditorActionState = { status: "idle" };
export function SeoPageEditorForm({
  page,
  savedFromRedirect = false,
  redirectError,
}: SeoPageEditorFormProps) {
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
  const [isSeoPanelOpen, setIsSeoPanelOpen] = useState(false);
  const autosaveReady = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visibleSlug = slugTouched ? slug : slugify(title);
  const draftContentJson = useMemo(() => JSON.stringify(content), [content]);
  const canPublish = Boolean(page?.id);
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
    <form action={formAction} className="bg-slate-100">
      {page?.id && <input type="hidden" name="id" value={page.id} />}
      <input type="hidden" name="draftContent" value={draftContentJson} />

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/admin/pages"
            className="text-brand-600 hover:text-brand-500 text-sm font-medium"
          >
            Back to pages
          </Link>
          <div className="flex min-w-0 flex-1 justify-center px-2">
            <label className="flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="shrink-0">/resources/</span>
              <input
                name="slug"
                value={visibleSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                required
                aria-label="Slug"
                className="min-w-0 flex-1 bg-transparent font-mono text-slate-800 outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {page?.status ?? "draft"}
            </span>
            <button
              type="button"
              className={smallButtonClass}
              onClick={() => setIsSeoPanelOpen(true)}
            >
              SEO settings
            </button>
            <button className={primaryButtonClass} name="intent" value="save">
              Save draft
            </button>
            <button
              className={primaryButtonClass}
              name="intent"
              value="publish"
              disabled={!canPublish}
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
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
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

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-slate-50">
            <div className="mx-auto max-w-5xl px-6 py-14 lg:px-10">
              {targetKeyword && (
                <p className="text-brand-500 text-sm font-semibold tracking-wide uppercase">
                  {targetKeyword}
                </p>
              )}
              <label className="mt-3 block">
                <span className="sr-only">Title</span>
                <textarea
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  rows={2}
                  placeholder="Page headline"
                  className={headlineInputClass}
                />
              </label>
              <label className="mt-5 block max-w-3xl">
                <span className="sr-only">Meta description</span>
                <textarea
                  name="metaDescription"
                  value={metaDescription}
                  onChange={(event) => setMetaDescription(event.target.value)}
                  rows={3}
                  placeholder="Opening summary shown at the top of the page."
                  className={leadInputClass}
                />
              </label>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-6 py-14 lg:px-10">
            <div className="mb-8 flex justify-end">
              <button
                type="button"
                className={smallButtonClass}
                onClick={addSection}
              >
                Add section
              </button>
            </div>

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
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                      Add a section to begin.
                    </div>
                  ) : (
                    content.sections.map((section, index) => (
                      <SortableSectionEditor
                        key={section.id}
                        section={section}
                        sectionIndex={index}
                        sectionCount={content.sections.length}
                        sensors={sensors}
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
                        onAddBlock={(columnId, type) =>
                          addBlock(section.id, columnId, type)
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
        className={`fixed top-0 right-0 z-50 h-dvh w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-200 ${
          isSeoPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isSeoPanelOpen}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-950">SEO settings</h2>
          <button
            type="button"
            className={miniButtonClass}
            onClick={() => setIsSeoPanelOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              Target keyword
            </span>
            <input
              name="targetKeyword"
              value={targetKeyword}
              onChange={(event) => setTargetKeyword(event.target.value)}
              className={compactInputClass}
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              SEO title
            </span>
            <input
              name="seoTitle"
              value={seoTitle}
              onChange={(event) => setSeoTitle(event.target.value)}
              className={compactInputClass}
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              Meta description
            </span>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
              Edit this in the page header.
            </p>
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">
              Canonical URL
            </span>
            <input
              name="canonicalUrl"
              value={canonicalUrl}
              onChange={(event) => setCanonicalUrl(event.target.value)}
              className={compactInputClass}
            />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
            <input
              name="noindex"
              type="checkbox"
              checked={noindex}
              onChange={(event) => {
                setNoindex(event.target.checked);
                if (event.target.checked) setSitemapEnabled(false);
              }}
              className="mt-1"
            />
            Noindex this page
          </label>
          <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
            <input
              name="sitemapEnabled"
              type="checkbox"
              checked={sitemapEnabled}
              disabled={noindex}
              onChange={(event) => setSitemapEnabled(event.target.checked)}
              className="mt-1"
            />
            Include in sitemap
          </label>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              SERP preview
            </p>
            <p className="text-brand-700 mt-3 text-sm font-semibold">
              {seoTitle || title || "SEO title"}
            </p>
            <p className="mt-1 text-xs break-all text-emerald-700">
              www.vendingpreneurs.com/resources/{visibleSlug || "slug"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {metaDescription || "Meta description preview."}
            </p>
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

  function addSection() {
    const sectionId = makeBuilderId("section");
    setContent((current) => ({
      ...current,
      sections: [
        ...current.sections,
        createPageSection(sectionId, makeBuilderId("column")),
      ],
    }));
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

  function addBlock(
    sectionId: string,
    columnId: string,
    type: PageBlock["type"],
  ) {
    setContent((current) =>
      updateColumn(current, sectionId, columnId, (column) => ({
        ...column,
        blocks: [
          ...column.blocks,
          createPageBlock(type, makeBuilderId("block")),
        ],
      })),
    );
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
}

function SortableSectionEditor({
  section,
  sectionIndex,
  sectionCount,
  sensors,
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
  onAddBlock: (columnId: string, type: PageBlock["type"]) => void;
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
      className={`group/section relative rounded-2xl border border-dashed border-transparent ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-full bg-white/90 p-2 text-xs opacity-100 shadow-sm ring-1 ring-slate-200 transition lg:absolute lg:-top-5 lg:right-0 lg:z-10 lg:opacity-0 lg:group-hover/section:opacity-100 lg:focus-within:opacity-100">
        <div className="flex items-center gap-3">
          <DragHandle
            label={`Reorder section ${sectionIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <h3 className="text-xs font-semibold text-slate-600">
            Section {sectionIndex + 1}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={miniButtonClass}
            disabled={sectionIndex === 0}
            onClick={() => onSectionMove("up")}
          >
            Up
          </button>
          <button
            type="button"
            className={miniButtonClass}
            disabled={sectionIndex === sectionCount - 1}
            onClick={() => onSectionMove("down")}
          >
            Down
          </button>
          <button
            type="button"
            className={smallButtonClass}
            disabled={section.columns.length >= 4}
            onClick={onAddColumn}
          >
            Add column
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onSectionRemove}
          >
            Remove
          </button>
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
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
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
                  onBlockDragEnd={(event) =>
                    onBlockDragEnd(section.id, column.id, event)
                  }
                  onColumnMove={(direction) =>
                    onColumnMove(column.id, direction)
                  }
                  onColumnRemove={() => onColumnRemove(column.id)}
                  onAddBlock={(type) => onAddBlock(column.id, type)}
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

function SortableColumnEditor({
  column,
  columnIndex,
  columnCount,
  sensors,
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
  onBlockDragEnd: (event: DragEndEvent) => void;
  onColumnMove: (direction: MoveDirection) => void;
  onColumnRemove: () => void;
  onAddBlock: (type: PageBlock["type"]) => void;
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
      className={`group/column relative min-w-0 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-full bg-white/90 p-2 text-xs opacity-100 shadow-sm ring-1 ring-slate-200 transition lg:absolute lg:-top-5 lg:left-0 lg:z-10 lg:opacity-0 lg:group-hover/column:opacity-100 lg:focus-within:opacity-100">
        <div className="flex items-center gap-3">
          <DragHandle
            label={`Reorder column ${columnIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <h4 className="text-xs font-semibold text-slate-600">
            Column {columnIndex + 1}
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={miniButtonClass}
            disabled={columnIndex === 0}
            onClick={() => onColumnMove("up")}
          >
            Up
          </button>
          <button
            type="button"
            className={miniButtonClass}
            disabled={columnIndex === columnCount - 1}
            onClick={() => onColumnMove("down")}
          >
            Down
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onColumnRemove}
          >
            Remove
          </button>
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
          <div className="space-y-8">
            {column.blocks.length === 0 ? (
              <BlockPicker onAddBlock={onAddBlock} />
            ) : (
              <>
                {column.blocks.map((block, blockIndex) => (
                  <SortableBlockEditor
                    key={block.id}
                    block={block}
                    index={blockIndex}
                    blockCount={column.blocks.length}
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

const blockPickerOptions: Array<{ type: PageBlock["type"]; label: string }> = [
  { type: "hero", label: "Hero" },
  { type: "rich_text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "cta", label: "CTA" },
  { type: "faq", label: "FAQ" },
  { type: "card_grid", label: "Cards" },
  { type: "proof", label: "Proof" },
  { type: "video", label: "Video" },
  { type: "lead_form", label: "Form" },
];

function BlockPicker({
  onAddBlock,
}: {
  onAddBlock: (type: PageBlock["type"]) => void;
}) {
  return (
    <details className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        Add block
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blockPickerOptions.map((option) => (
          <button
            key={option.type}
            type="button"
            className="hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-400 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => onAddBlock(option.type)}
          >
            <BlockPreviewSkeleton type={option.type} />
            <span className="mt-3 block text-sm font-semibold text-slate-800">
              {option.label}
            </span>
          </button>
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
  blockCount,
  onChange,
  onMove,
  onRemove,
}: {
  block: PageBlock;
  index: number;
  blockCount: number;
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
        index={index}
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
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}

function BlockEditor({
  block,
  index,
  isFirst,
  isLast,
  isDragging,
  dragHandle,
  onChange,
  onMove,
  onRemove,
}: {
  block: PageBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  dragHandle: ReactNode;
  onChange: (block: PageBlock) => void;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={`group/block hover:outline-brand-200 focus-within:outline-brand-300 relative rounded-2xl outline outline-1 outline-transparent transition ${
        isDragging ? "outline-brand-300 bg-white shadow-xl" : ""
      }`}
    >
      <BlockToolbar
        label={`${index + 1}. ${blockLabel(block.type)}`}
        isFirst={isFirst}
        isLast={isLast}
        dragHandle={dragHandle}
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
        <div className="rounded-2xl px-4 py-4">
          <label className={ctaClass(block.variant)}>
            <span className="sr-only">Label</span>
            <input
              value={block.props.label}
              placeholder="CTA label"
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, label: event.target.value },
                })
              }
              className={`bg-transparent outline-none ${
                block.variant === "primary"
                  ? "text-white placeholder:text-white/70"
                  : "text-inherit"
              }`}
            />
          </label>
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
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <TextInput
                label="Card title"
                value={block.props.cards[0]?.title ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      cards: updateFirstCard(block.props.cards, {
                        title: value,
                      }),
                    },
                  })
                }
              />
              <TextAreaInput
                label="Card body"
                value={block.props.cards[0]?.body ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      cards: updateFirstCard(block.props.cards, {
                        body: value,
                      }),
                    },
                  })
                }
              />
              <TextInput
                label="Card href"
                value={block.props.cards[0]?.href ?? ""}
                onChange={(value) =>
                  onChange({
                    ...block,
                    props: {
                      ...block.props,
                      cards: updateFirstCard(block.props.cards, {
                        href: value,
                      }),
                    },
                  })
                }
              />
            </div>
            <SkeletonCard />
            <SkeletonCard />
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
    </article>
  );
}

function BlockToolbar({
  label,
  isFirst,
  isLast,
  dragHandle,
  onMove,
  onRemove,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  dragHandle: ReactNode;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
}) {
  return (
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-full bg-white/95 p-2 text-xs opacity-100 shadow-sm ring-1 ring-slate-200 transition lg:absolute lg:-top-5 lg:right-3 lg:z-10 lg:opacity-0 lg:group-hover/block:opacity-100 lg:focus-within:opacity-100">
      <div className="flex items-center gap-2">
        {dragHandle}
        <span className="font-semibold text-slate-600">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={miniButtonClass}
          disabled={isFirst}
          onClick={() => onMove("up")}
        >
          Up
        </button>
        <button
          type="button"
          className={miniButtonClass}
          disabled={isLast}
          onClick={() => onMove("down")}
        >
          Down
        </button>
        <button type="button" className={dangerButtonClass} onClick={onRemove}>
          Remove
        </button>
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
      Drag
    </button>
  );
}

function parseInitialContent(page: SeoPage | undefined): PageContent {
  const parsed = pageContentSchema.safeParse(
    page?.draft_content ?? createEmptyPageContent(),
  );
  if (!parsed.success) return createEmptyPageContent();
  return parsed.data;
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

function bodyText(block: Extract<PageBlock, { type: "rich_text" }>) {
  return block.props.body.nodes
    .map((node) => {
      if (node.type === "list") return node.items.join("\n");
      return node.text;
    })
    .join("\n\n");
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

function columnGridClass(count: number) {
  if (count <= 1) return "grid gap-8";
  return "grid gap-8 md:grid-cols-2";
}

function ctaClass(variant: Extract<PageBlock, { type: "cta" }>["variant"]) {
  const base =
    "inline-flex rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2";
  if (variant === "secondary") {
    return `${base} border border-slate-300 bg-white text-slate-800`;
  }
  if (variant === "text") {
    return "inline-flex text-sm font-semibold text-brand-600";
  }
  return `${base} bg-brand-500 text-white`;
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

function updateFirstCard(
  cards: CardItem[],
  patch: Partial<CardItem>,
): CardItem[] {
  if (cards.length === 0) {
    return [
      {
        title: patch.title ?? "",
        body: patch.body ?? "",
        href: patch.href ?? "",
      },
    ];
  }
  return cards.map((card, index) =>
    index === 0 ? { ...card, ...patch } : card,
  );
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

const headlineInputClass =
  "focus:ring-brand-100 w-full resize-none rounded-xl border border-transparent bg-transparent px-1 py-1 text-4xl font-semibold tracking-tight text-slate-950 outline-none transition placeholder:text-slate-400 hover:bg-white/60 focus:bg-white focus:px-3 focus:py-2 focus:ring-2 md:text-5xl";

const leadInputClass =
  "focus:ring-brand-100 w-full resize-none rounded-xl border border-transparent bg-transparent px-1 py-1 text-lg leading-8 text-slate-600 outline-none transition placeholder:text-slate-400 hover:bg-white/60 focus:bg-white focus:px-3 focus:py-2 focus:ring-2";

const eyebrowInputClass =
  "focus:ring-brand-100 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold tracking-wide text-brand-500 uppercase outline-none transition placeholder:text-brand-300 focus:bg-white focus:ring-2";

const heroHeadingInputClass =
  "focus:ring-brand-100 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1 text-3xl font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 md:text-4xl";

const sectionHeadingInputClass =
  "focus:ring-brand-100 w-full rounded-xl border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 md:text-3xl";

const bodyTextareaClass =
  "focus:ring-brand-100 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1 text-base leading-8 text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2";

const disabledLeadFieldClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-400 shadow-sm";

const compactInputClass =
  "focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:ring-2";

const textareaClass =
  "focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm transition outline-none focus:ring-2";

const primaryButtonClass =
  "rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const miniButtonClass =
  "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50";

const dragHandleClass =
  "cursor-grab rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:cursor-grabbing";
