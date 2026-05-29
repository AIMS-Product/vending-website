import type {
  PageBlock,
  PageColumn,
  PageContent,
  PageSection,
} from "@/lib/page-builder/blocks";
import { pageBlockSchema } from "@/lib/page-builder/blocks";
import { createDescriptorPageBlock } from "@/lib/page-builder/block-descriptors";

export type MoveDirection = "up" | "down";

export function createEditablePageContent(
  sectionId = "section_1",
  columnId = "column_1",
): PageContent {
  return {
    version: 1,
    sections: [createPageSection(sectionId, columnId)],
  };
}

export function ensureEditablePageContent(content: PageContent): PageContent {
  if (content.sections.length > 0) return content;
  return createEditablePageContent();
}

export function createPageSection(
  id: string,
  columnId = `${id}_column_1`,
): PageSection {
  return {
    id,
    preset: "standard",
    background: "default",
    spacing: "standard",
    columns: [createPageColumn(columnId)],
  };
}

export function createPageColumn(id: string): PageColumn {
  return {
    id,
    width: "1/1",
    blocks: [],
  };
}

export function createPageBlock(
  type: PageBlock["type"],
  id: string,
): PageBlock {
  const descriptorBlock = createDescriptorPageBlock(type, id);
  if (descriptorBlock) return descriptorBlock;

  if (type === "hero") {
    return {
      id,
      type: "hero",
      variant: "standard",
      props: {
        eyebrow: "",
        heading: "",
        body: "",
        ctaLabel: "",
        ctaHref: "",
        ctaTrackingName: "",
        mediaSrc: "",
        mediaAltText: "",
        mediaCaption: "",
        proofText: "",
      },
    };
  }

  if (type === "rich_text") {
    return {
      id,
      type: "rich_text",
      variant: "default",
      props: {
        eyebrow: "",
        heading: "",
        body: { version: 1, nodes: [{ type: "paragraph", text: "" }] },
      },
    };
  }

  if (type === "image") {
    return {
      id,
      type: "image",
      variant: "standard",
      props: {
        src: "",
        altText: "",
        caption: "",
        sourceRightsNotes: "",
      },
    };
  }

  if (type === "video") {
    return {
      id,
      type: "video",
      variant: "standard",
      props: {
        title: "",
        url: "",
        caption: "",
      },
    };
  }

  if (type === "faq") {
    return {
      id,
      type: "faq",
      variant: "standard",
      props: {
        heading: "",
        items: [{ question: "", answer: "" }],
      },
    };
  }

  if (type === "card_grid") {
    return {
      id,
      type: "card_grid",
      variant: "standard",
      props: {
        heading: "",
        cards: [{ title: "", body: "", href: "" }],
      },
    };
  }

  if (type === "proof") {
    return {
      id,
      type: "proof",
      variant: "quote",
      props: {
        proofItemId: undefined,
        eyebrow: "",
        body: "",
        name: "",
        context: "",
      },
    };
  }

  if (type === "lead_form") {
    return {
      id,
      type: "lead_form",
      variant: "standard",
      props: {
        heading: "",
        body: "",
        submitLabel: "",
        trackingName: "",
      },
    };
  }

  const ctaBlock = createDescriptorPageBlock("cta", id);
  if (!ctaBlock) {
    throw new Error(`Unsupported page block type: ${type}`);
  }
  return ctaBlock;
}

export function duplicatePageBlock(block: PageBlock, id: string): PageBlock {
  return pageBlockSchema.parse({
    ...cloneBlockValue(block),
    id,
  });
}

export function moveItem<T>(
  items: T[],
  index: number,
  direction: MoveDirection,
) {
  if (index < 0 || index >= items.length) return items;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  return moveItemToIndex(items, index, target);
}

export function moveItemToIndex<T>(
  items: T[],
  index: number,
  targetIndex: number,
) {
  if (index < 0 || index >= items.length) return items;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  if (index === targetIndex) return items;

  const next = [...items];
  const [moved] = next.splice(index, 1);
  if (!moved) return items;
  next.splice(targetIndex, 0, moved);
  return next;
}

export function reorderItemsById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
) {
  if (activeId === overId) return items;
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1) return items;

  const next = [...items];
  const [moved] = next.splice(activeIndex, 1);
  if (!moved) return items;
  next.splice(overIndex, 0, moved);
  return next;
}

function cloneBlockValue(block: PageBlock): PageBlock {
  return JSON.parse(JSON.stringify(block)) as PageBlock;
}
