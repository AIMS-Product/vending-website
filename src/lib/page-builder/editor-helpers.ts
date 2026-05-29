import {
  CARD_GRID_MAX_CARDS,
  FAQ_MAX_ITEMS,
  createEmptyPageContent,
  pageContentSchema,
  richTextDocumentPlainText,
  type PageBlock,
  type PageColumn,
  type PageContent,
  type PageSection,
} from "@/lib/page-builder/blocks";
import {
  blockPickerOptions,
  type BlockVariant,
} from "@/lib/page-builder/block-options";
import {
  createPageBlock,
  type MoveDirection,
} from "@/lib/page-builder/content-ops";
import {
  isBlockFieldVisible,
  withDefaultFieldVisibility,
} from "@/lib/page-builder/block-field-visibility";
import {
  parseStructuredDataSettings,
  type StructuredDataSettings,
} from "@/lib/page-builder/structured-data-settings";
import type { Tables } from "@/types/database";

export type SeoPageEditorPage = Tables<"seo_pages">;

export type BuilderBlockEntry = {
  sectionId: string;
  columnId: string;
  block: PageBlock;
  blockNumber: number;
  sectionNumber: number;
  columnNumber: number;
};

export type EditorDraftSettings = {
  slug: string;
  title: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataSettings: StructuredDataSettings;
};

export type FaqBlock = Extract<PageBlock, { type: "faq" }>;
export type FaqItem = FaqBlock["props"]["items"][number];
export type CardGridBlock = Extract<PageBlock, { type: "card_grid" }>;
export type CardItem = CardGridBlock["props"]["cards"][number];

export function parseInitialContent(
  page: SeoPageEditorPage | undefined,
): PageContent {
  const parsed = pageContentSchema.safeParse(
    page?.draft_content ?? createEmptyPageContent(),
  );
  if (!parsed.success) return createEmptyPageContent();
  return parsed.data;
}

export function parsePublishedContent(
  page: SeoPageEditorPage | undefined,
): PageContent | null {
  if (!page?.published_content) return null;
  const parsed = pageContentSchema.safeParse(page.published_content);
  if (!parsed.success) return null;
  return parsed.data;
}

export function parseInitialDraftSettings(
  page: SeoPageEditorPage | undefined,
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
    structuredDataSettings: parseStructuredDataSettings(
      settings.structuredDataSettings ?? page.structured_data_settings,
    ),
  };
}

export function collectBuilderBlockEntries(
  content: PageContent,
): BuilderBlockEntry[] {
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

export function updateSection(
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

export function updateColumn(
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

export function createPageBlockWithVariant(
  type: PageBlock["type"],
  id: string,
  variant?: BlockVariant,
) {
  const block = createPageBlock(type, id);
  const variantBlock = variant ? withBlockVariant(block, variant) : block;
  return withEditorDefaultsForNewBlock(variantBlock);
}

export function withBlockVariant(
  block: PageBlock,
  variant: BlockVariant,
): PageBlock {
  return { ...block, variant } as PageBlock;
}

export function withEditorDefaultsForNewBlock(block: PageBlock): PageBlock {
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

export function trackingNameForLabel(
  label: string | null | undefined,
  fallback: string,
) {
  return slugify(label ?? "") || fallback;
}

export function articleFor(label: string) {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

export function syncedTrackingName({
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

export function bodyText(block: Extract<PageBlock, { type: "rich_text" }>) {
  return richTextDocumentPlainText(block.props.body);
}

export function editableRichTextBodyText(
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

export function richTextBodyFromEditableText(
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

export function shouldEditRichTextAsList(
  block: Extract<PageBlock, { type: "rich_text" }>,
) {
  return (
    block.variant === "checklist" ||
    block.props.body.nodes.some((node) => node.type === "list")
  );
}

export function blockVariantOptions(type: PageBlock["type"]) {
  return (
    blockPickerOptions.find((option) => option.type === type)?.variants ?? []
  );
}

export function blockVariantLabel(block: PageBlock) {
  const option = blockVariantOptions(block.type).find(
    (variant) => variant.id === block.variant,
  );
  return option?.label ?? humanizeVariant(block.variant);
}

export function humanizeVariant(variant: BlockVariant) {
  return String(variant)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function blockLabel(type: PageBlock["type"]) {
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

export function blockSummary(block: PageBlock) {
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

export function updateFaqItem(
  items: FaqItem[],
  itemIndex: number,
  patch: Partial<FaqItem>,
): FaqItem[] {
  const nextItems = items.length > 0 ? items : [{ question: "", answer: "" }];

  return nextItems.map((item, index) =>
    index === itemIndex ? { ...item, ...patch } : item,
  );
}

export function removeFaqItem(items: FaqItem[], itemIndex: number): FaqItem[] {
  const nextItems = items.filter((_, index) => index !== itemIndex);
  return nextItems.length > 0 ? nextItems : [{ question: "", answer: "" }];
}

export function appendBlankFaq(items: FaqItem[]): FaqItem[] {
  if (items.length >= FAQ_MAX_ITEMS) return items;
  return [...items, { question: "", answer: "" }];
}

export function createBlankCard(): CardItem {
  return { title: "", body: "", href: "", linkLabel: "" };
}

export function appendBlankCard(cards: CardItem[]): CardItem[] {
  if (cards.length >= CARD_GRID_MAX_CARDS) return cards;
  return [...cards, createBlankCard()];
}

export function cardItemKey(blockId: string, cardIndex: number) {
  return `${blockId}-card-${cardIndex}`;
}

export function isBlankFaqItem(item: FaqItem) {
  return !hasEditorText(item.question) && !hasEditorText(item.answer);
}

export function isBlankCard(card: CardItem) {
  return (
    !hasEditorText(card.title) &&
    !hasEditorText(card.body) &&
    !hasEditorText(card.href) &&
    !hasEditorText(card.linkLabel)
  );
}

export function updateCard(
  cards: CardItem[],
  cardIndex: number,
  patch: Partial<CardItem>,
): CardItem[] {
  return cards.map((card, index) =>
    index === cardIndex ? { ...card, ...patch } : card,
  );
}

export function removeCard(cards: CardItem[], cardIndex: number): CardItem[] {
  return cards.filter((_, index) => index !== cardIndex);
}

export function completionMessagesForBlock(block: PageBlock) {
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

export function cardCompletionMessages(card: CardItem) {
  const messages: string[] = [];
  if (!hasEditorText(card.title)) messages.push("Add a card title.");
  if (!hasEditorText(card.body)) messages.push("Add a short card description.");
  if (!hasEditorText(card.href)) {
    messages.push("No link set; this card will not send visitors anywhere.");
  }
  return messages;
}

export function hasEditorText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function aiBlockReviewTitle(block: PageBlock) {
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

export function aiBlockReviewBody(block: PageBlock) {
  if (block.type === "hero") return block.props.body;
  if (block.type === "rich_text") {
    return richTextDocumentPlainText(block.props.body);
  }
  if (block.type === "card_grid") return block.props.cards[0]?.body ?? "";
  if (block.type === "faq") return block.props.items[0]?.question ?? "";
  if (block.type === "lead_form") return block.props.body;
  if (block.type === "proof") return block.props.context;
  if (block.type === "image") return block.props.caption;
  if (block.type === "video") return block.props.caption;
  return block.props.href;
}

export type { MoveDirection };

function stringSetting(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
