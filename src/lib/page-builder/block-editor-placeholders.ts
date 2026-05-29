import type { PageBlock } from "@/lib/page-builder/blocks";
import { ctaBlockDescriptor } from "@/lib/page-builder/block-descriptors";

export const blockEditorPlaceholders = {
  eyebrow: "Eyebrow",
  sectionHeading: "Section heading",
  heroHeadline: "Hero headline",
  heroBody: "Hero body copy",
  ctaLabel: "CTA label",
  richTextBody: "Write the page copy here.",
  checklistBody: "Add checklist items, one per line.",
  faqHeading: "FAQ heading",
  faqQuestion: "Question",
  faqAnswer: "Answer",
  cardGridHeading: "Card grid heading",
  cardTitle: "Card title",
  cardBody: "Card body",
  proofEyebrow: "Eyebrow",
  proofQuote: "Proof quote or stat",
  proofName: "Name",
  proofContext: "Context",
  leadFormHeading: "Lead form heading",
  leadFormBody: "Lead form copy",
  submitLabel: "Submit label",
  imageCaption: "Caption",
  mediaCaption: "Media caption",
  videoTitle: "Video title",
  videoCaption: "Video caption",
} as const;

export function richTextBodyPlaceholder(variant: PageBlock["variant"]) {
  return variant === "checklist"
    ? blockEditorPlaceholders.checklistBody
    : blockEditorPlaceholders.richTextBody;
}

export const blockCanvasPlaceholders = {
  hero: {
    eyebrow: blockEditorPlaceholders.eyebrow,
    heading: blockEditorPlaceholders.heroHeadline,
    body: blockEditorPlaceholders.heroBody,
    ctaLabel: blockEditorPlaceholders.ctaLabel,
    mediaCaption: blockEditorPlaceholders.mediaCaption,
  },
  rich_text: {
    eyebrow: blockEditorPlaceholders.eyebrow,
    heading: blockEditorPlaceholders.sectionHeading,
    body: blockEditorPlaceholders.richTextBody,
    checklistBody: blockEditorPlaceholders.checklistBody,
  },
  image: {
    caption: blockEditorPlaceholders.imageCaption,
    dropLabel: "Drop or upload an image",
    dropHint: "Saved to the media library automatically.",
  },
  video: {
    title: blockEditorPlaceholders.videoTitle,
    caption: blockEditorPlaceholders.videoCaption,
  },
  cta: ctaBlockDescriptor.editor.canvasPlaceholders,
  faq: {
    heading: blockEditorPlaceholders.faqHeading,
    question: blockEditorPlaceholders.faqQuestion,
    answer: blockEditorPlaceholders.faqAnswer,
  },
  card_grid: {
    heading: blockEditorPlaceholders.cardGridHeading,
    title: blockEditorPlaceholders.cardTitle,
    body: blockEditorPlaceholders.cardBody,
  },
  proof: {
    eyebrow: blockEditorPlaceholders.proofEyebrow,
    body: blockEditorPlaceholders.proofQuote,
    name: blockEditorPlaceholders.proofName,
    context: blockEditorPlaceholders.proofContext,
  },
  lead_form: {
    heading: blockEditorPlaceholders.leadFormHeading,
    body: blockEditorPlaceholders.leadFormBody,
    submitLabel: blockEditorPlaceholders.submitLabel,
  },
} as const satisfies Record<PageBlock["type"], Record<string, string>>;
