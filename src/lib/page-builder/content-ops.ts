import type {
  PageBlock,
  PageColumn,
  PageContent,
  PageSection,
} from "@/lib/page-builder/blocks";

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
        heading: "Frequently asked questions",
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
        heading: "Ready to start?",
        body: "",
        submitLabel: "Submit application",
        trackingName: "",
      },
    };
  }

  return {
    id,
    type: "cta",
    variant: "primary",
    props: {
      presetId: undefined,
      label: "Apply now",
      href: "/apply",
      trackingName: "",
    },
  };
}

export function moveItem<T>(
  items: T[],
  index: number,
  direction: MoveDirection,
) {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
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
