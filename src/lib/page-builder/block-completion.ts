import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";
import {
  richTextDocumentPlainText,
  type PageBlock,
} from "@/lib/page-builder/blocks";

type CardGridBlock = Extract<PageBlock, { type: "card_grid" }>;
type CardItem = CardGridBlock["props"]["cards"][number];

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

function cardCompletionMessages(card: CardItem) {
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
