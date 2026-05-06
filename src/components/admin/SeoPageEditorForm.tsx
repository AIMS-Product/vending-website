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
};

const initialState: PageEditorActionState = { status: "idle" };

export function SeoPageEditorForm({
  page,
  savedFromRedirect = false,
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
      }).then(setAutosave);
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
    <form
      action={formAction}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      {page?.id && <input type="hidden" name="id" value={page.id} />}
      <input type="hidden" name="draftContent" value={draftContentJson} />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/pages"
            className="text-brand-600 hover:text-brand-500 text-sm font-medium"
          >
            Back to pages
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {page?.status ?? "draft"}
          </span>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Slug</span>
          <input
            name="slug"
            value={visibleSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
            className={`${inputClass} font-mono text-sm`}
          />
        </label>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Content structure
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Drag rows, columns, and blocks or use the keyboard reorder
                controls.
              </p>
            </div>
            <button
              type="button"
              className={smallButtonClass}
              onClick={addSection}
            >
              Add section
            </button>
          </header>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={content.sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-5 p-5">
                {content.sections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
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
        </section>
      </div>

      <aside className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Save</h2>
          {(state.status !== "idle" || savedFromRedirect) && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                state.status === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {state.message ?? "Draft saved."}
            </p>
          )}
          {autosave && (
            <p className="mt-3 text-xs text-slate-500">
              {autosave.status === "saved"
                ? `Autosaved ${formatTime(autosave.savedAt)}`
                : autosave.message}
            </p>
          )}
          <div className="mt-5 grid gap-2">
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
          {!canPublish && (
            <p className="mt-3 text-xs text-slate-500">
              Create the draft before publishing.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">SEO</h2>
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
            <textarea
              name="metaDescription"
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
              rows={4}
              className={textareaClass}
            />
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
      className={`rounded-lg border border-slate-200 bg-slate-50/60 p-4 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DragHandle
            label={`Reorder section ${sectionIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <h3 className="text-sm font-semibold text-slate-950">
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
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => onColumnDragEnd(section.id, event)}
      >
        <SortableContext
          items={section.columns.map((column) => column.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-4">
            {section.columns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
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
      className={`rounded-lg border border-slate-200 bg-white p-4 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <DragHandle
            label={`Reorder column ${columnIndex + 1}`}
            attributes={attributes}
            listeners={listeners}
          />
          <h4 className="text-sm font-semibold text-slate-950">
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("hero")}
        >
          Add hero
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("rich_text")}
        >
          Add text
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("image")}
        >
          Add image
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("cta")}
        >
          Add CTA
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("faq")}
        >
          Add FAQ
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("card_grid")}
        >
          Add cards
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("proof")}
        >
          Add proof
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("video")}
        >
          Add video
        </button>
        <button
          type="button"
          className={smallButtonClass}
          onClick={() => onAddBlock("lead_form")}
        >
          Add form
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onBlockDragEnd}
      >
        <SortableContext
          items={column.blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {column.blocks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Add a block to this column.
              </div>
            ) : (
              column.blocks.map((block, blockIndex) => (
                <SortableBlockEditor
                  key={block.id}
                  block={block}
                  index={blockIndex}
                  blockCount={column.blocks.length}
                  onChange={(next) => onBlockChange(block.id, next)}
                  onMove={(direction) => onBlockMove(block.id, direction)}
                  onRemove={() => onBlockRemove(block.id)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
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
      className={`rounded-lg border border-slate-200 bg-slate-50/70 p-4 ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {dragHandle}
          <h5 className="text-sm font-semibold text-slate-950">
            {index + 1}. {blockLabel(block.type)}
          </h5>
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
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </header>

      {block.type === "rich_text" && (
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Eyebrow</span>
            <input
              value={block.props.eyebrow}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, eyebrow: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Heading</span>
            <input
              value={block.props.heading}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, heading: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Body</span>
            <textarea
              value={bodyText(block)}
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
              className={textareaClass}
            />
          </label>
        </div>
      )}

      {block.type === "hero" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, eyebrow: value } })
            }
          />
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, heading: value } })
            }
          />
          <TextInput
            label="Body"
            value={block.props.body}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, body: value } })
            }
          />
          <TextInput
            label="CTA label"
            value={block.props.ctaLabel}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, ctaLabel: value } })
            }
          />
          <TextInput
            label="CTA href"
            value={block.props.ctaHref}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, ctaHref: value } })
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
      )}

      {block.type === "image" && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Asset ID</span>
            <input
              value={block.props.assetId ?? ""}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    assetId: event.target.value || undefined,
                  },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Image path or URL
            </span>
            <input
              value={block.props.src}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, src: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Alt text</span>
            <input
              value={block.props.altText}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, altText: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Rights notes
            </span>
            <input
              value={block.props.sourceRightsNotes}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    sourceRightsNotes: event.target.value,
                  },
                })
              }
              className={compactInputClass}
            />
          </label>
        </div>
      )}

      {block.type === "cta" && (
        <div className="grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Preset ID
            </span>
            <input
              value={block.props.presetId ?? ""}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    presetId: event.target.value || undefined,
                  },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Label</span>
            <input
              value={block.props.label}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, label: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Href</span>
            <input
              value={block.props.href}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, href: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Tracking name
            </span>
            <input
              value={block.props.trackingName}
              onChange={(event) =>
                onChange({
                  ...block,
                  props: { ...block.props, trackingName: event.target.value },
                })
              }
              className={compactInputClass}
            />
          </label>
        </div>
      )}

      {block.type === "video" && (
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            label="Title"
            value={block.props.title}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, title: value } })
            }
          />
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
              onChange({ ...block, props: { ...block.props, caption: value } })
            }
          />
        </div>
      )}

      {block.type === "faq" && (
        <div className="grid gap-4">
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, heading: value } })
            }
          />
          <TextInput
            label="Question"
            value={block.props.items[0]?.question ?? ""}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: [
                    {
                      question: value,
                      answer: block.props.items[0]?.answer ?? "",
                    },
                  ],
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
                  items: [
                    {
                      question: block.props.items[0]?.question ?? "",
                      answer: value,
                    },
                  ],
                },
              })
            }
          />
        </div>
      )}

      {block.type === "card_grid" && (
        <div className="grid gap-4">
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, heading: value } })
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput
              label="Card title"
              value={block.props.cards[0]?.title ?? ""}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: [
                      {
                        title: value,
                        body: block.props.cards[0]?.body ?? "",
                        href: block.props.cards[0]?.href ?? "",
                      },
                    ],
                  },
                })
              }
            />
            <TextInput
              label="Card body"
              value={block.props.cards[0]?.body ?? ""}
              onChange={(value) =>
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    cards: [
                      {
                        title: block.props.cards[0]?.title ?? "",
                        body: value,
                        href: block.props.cards[0]?.href ?? "",
                      },
                    ],
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
                    cards: [
                      {
                        title: block.props.cards[0]?.title ?? "",
                        body: block.props.cards[0]?.body ?? "",
                        href: value,
                      },
                    ],
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {block.type === "proof" && (
        <div className="grid gap-4 md:grid-cols-2">
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
          <TextInput
            label="Eyebrow"
            value={block.props.eyebrow}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, eyebrow: value } })
            }
          />
          <TextInput
            label="Body"
            value={block.props.body}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, body: value } })
            }
          />
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
              onChange({ ...block, props: { ...block.props, context: value } })
            }
          />
        </div>
      )}

      {block.type === "lead_form" && (
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Heading"
            value={block.props.heading}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, heading: value } })
            }
          />
          <TextInput
            label="Body"
            value={block.props.body}
            onChange={(value) =>
              onChange({ ...block, props: { ...block.props, body: value } })
            }
          />
          <TextInput
            label="Submit label"
            value={block.props.submitLabel}
            onChange={(value) =>
              onChange({
                ...block,
                props: { ...block.props, submitLabel: value },
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
        </div>
      )}
    </article>
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

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-2xl font-semibold text-slate-950 shadow-sm transition outline-none focus:ring-2";

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
