import { z } from "zod";
import {
  flattenBlocks,
  pageBlockSchema,
  pageContentSchema,
  richTextDocumentPlainText,
  type PageBlock,
  type PageContent,
  type RichTextDocument,
  type RichTextNode,
} from "@/lib/page-builder/blocks";
import {
  createPageBlock,
  createPageColumn,
  createPageSection,
  ensureEditablePageContent,
} from "@/lib/page-builder/content-ops";
import {
  slugify,
  trackingNameForLabel,
} from "@/lib/page-builder/editor-helpers";
import {
  isAiSafeImageSource,
  type ApplyOptions,
  type BlockToolSpec,
  type PageBuilderAiApplyResult,
  type PageBuilderAiClarification,
  type PageBuilderAiPendingDelete,
  type PageBuilderAiSeoPatch,
  type PageBuilderAiToolResult,
  addBlockInputSchema,
  addImageTextSectionInputSchema,
  addMediaBlockInputSchema,
  cardGridInputSchema,
  ctaInputSchema,
  deleteBlockInputSchema,
  faqInputSchema,
  heroInputSchema,
  imageTextSectionClarificationOptions,
  leadFormInputSchema,
  mediaInputSchema,
  mediaSourceClarificationOptions,
  proofInputSchema,
  reorderBlocksInputSchema,
  replacePageSectionsInputSchema,
  requestClarificationInputSchema,
  richTextBodyInputSchema,
  seoMetadataInputLimits,
  setSeoMetadataInputSchema,
} from "./ai-chat-schemas";

// The schema half moved to ./ai-chat-schemas. Re-exported here so this
// module's public surface is exactly what it was before the split.
export {
  PAGE_BUILDER_AI_MESSAGE_MAX_CHARS,
  addBlockInputSchema,
  imageTextSectionClarificationOptions,
  mediaSourceClarificationOptions,
  nonEmptyStringSchema,
  nullableStringSchema,
  pageBuilderAiChatRequestSchema,
  pageBuilderAiChatResponseSchema,
  pageBuilderAiContextSchema,
  safeHrefSchema,
  safeImageSourceSchema,
  safeMediaSourceSchema,
} from "./ai-chat-schemas";
export type {
  AiAddBlockType,
  BlockToolSpec,
  JsonSchemaObject,
  PageBuilderAiApplyResult,
  PageBuilderAiChatRequest,
  PageBuilderAiChatResponse,
  PageBuilderAiClarification,
  PageBuilderAiContext,
  PageBuilderAiFunctionTool,
  PageBuilderAiPendingDelete,
  PageBuilderAiSeoPatch,
  PageBuilderAiToolCall,
  PageBuilderAiToolResult,
} from "./ai-chat-schemas";

export function applyPageBuilderAiToolCalls({
  content,
  toolCalls,
  makeBlockId,
}: ApplyOptions): PageBuilderAiApplyResult {
  let workingContent = ensureEditablePageContent(content);
  const seoPatch: PageBuilderAiSeoPatch = {};
  const results: PageBuilderAiToolResult[] = [];
  const highlightedBlockIds = new Set<string>();
  let pendingDelete: PageBuilderAiPendingDelete | null = null;
  let clarification: PageBuilderAiClarification | null = null;

  for (const toolCall of toolCalls) {
    const blockTool = findBlockToolSpec(
      collectBlockToolSpecs(workingContent),
      toolCall.name,
    );

    if (blockTool) {
      const next = applyDynamicBlockEdit(blockTool.block, toolCall.input);
      if (!next.ok) {
        results.push({
          status: "failed",
          toolName: toolCall.name,
          blockId: blockTool.blockId,
          message: next.message,
        });
        continue;
      }

      workingContent = replaceBlockById(
        workingContent,
        blockTool.blockId,
        next.block,
      );
      highlightedBlockIds.add(blockTool.blockId);
      results.push({
        status: "applied",
        toolName: toolCall.name,
        blockId: blockTool.blockId,
        message: `Updated ${blockTool.label}.`,
      });
      continue;
    }

    if (toolCall.name === "add_block") {
      const parsed = addBlockInputSchema.safeParse(
        normalizeAddBlockInput(toolCall.input),
      );
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const block = createAiBlock(parsed.data, makeBlockId());
      workingContent = appendBlockToPrimaryColumn(workingContent, block);
      highlightedBlockIds.add(block.id);
      results.push({
        status: "applied",
        toolName: toolCall.name,
        blockId: block.id,
        message: `Added ${blockLabel(block)}.`,
      });
      continue;
    }

    if (toolCall.name === "add_image_text_section") {
      const parsed = addImageTextSectionInputSchema.safeParse(
        normalizeImageTextSectionInput(toolCall.input),
      );
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const imageUrl = parsed.data.imageUrl?.trim() ?? "";
      if (!imageUrl) {
        clarification = { options: imageTextSectionClarificationOptions };
        results.push({
          status: "queued",
          toolName: toolCall.name,
          message:
            "Choose an image source before adding the image and text section.",
        });
        continue;
      }

      const nextSection = createImageTextSection(parsed.data, makeBlockId);
      const textBlock = nextSection.columns
        .flatMap((column) => column.blocks)
        .find((block) => block.type === "rich_text");
      const imageBlock = nextSection.columns
        .flatMap((column) => column.blocks)
        .find((block) => block.type === "image");

      workingContent = appendSectionToContent(workingContent, nextSection);
      if (textBlock) highlightedBlockIds.add(textBlock.id);
      if (imageBlock) highlightedBlockIds.add(imageBlock.id);
      results.push({
        status: "applied",
        toolName: toolCall.name,
        blockId: imageBlock?.id ?? textBlock?.id,
        message:
          "Added a paired image and text section. Review image alt text and rights notes before publishing.",
      });
      continue;
    }

    if (toolCall.name === "add_media_block") {
      const parsed = addMediaBlockInputSchema.safeParse(
        normalizeMediaBlockInput(toolCall.input),
      );
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const mediaUrl = parsed.data.url?.trim() ?? "";
      if (!mediaUrl) {
        clarification = { options: mediaSourceClarificationOptions };
        results.push({
          status: "queued",
          toolName: toolCall.name,
          message: "Choose a media source before adding this block.",
        });
        continue;
      }

      const block = createAiMediaBlock(parsed.data, makeBlockId());
      workingContent = appendBlockToPrimaryColumn(workingContent, block);
      highlightedBlockIds.add(block.id);
      results.push({
        status: "applied",
        toolName: toolCall.name,
        blockId: block.id,
        message: `Added ${blockLabel(block)}.`,
      });
      continue;
    }

    if (toolCall.name === "replace_page_sections") {
      const parsed = replacePageSectionsInputSchema.safeParse(
        normalizeReplacePageSectionsInput(toolCall.input),
      );
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      if (
        flattenBlocks(workingContent).length > 0 &&
        !parsed.data.replaceExisting
      ) {
        clarification = {
          options: [
            "Keep existing blocks and expand them",
            "Replace existing blocks with a new full draft",
          ],
        };
        results.push({
          status: "queued",
          toolName: toolCall.name,
          message:
            "Choose whether to expand the existing blocks or replace them with a new full draft.",
        });
        continue;
      }

      workingContent = createReplacementPageContent(
        workingContent,
        parsed.data,
        makeBlockId,
      );
      flattenBlocks(workingContent).forEach((block) =>
        highlightedBlockIds.add(block.id),
      );
      const blockCount = flattenBlocks(workingContent).length;
      results.push({
        status: "applied",
        toolName: toolCall.name,
        message: `Rebuilt page body with ${blockCount} blocks across ${workingContent.sections.length} sections.`,
      });
      continue;
    }

    if (toolCall.name === "set_seo_metadata") {
      const parsed = setSeoMetadataInputSchema.safeParse(
        normalizeSeoMetadataInput(toolCall.input),
      );
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const patch = parsed.data;
      if (patch.title !== undefined && patch.title !== null) {
        seoPatch.title = patch.title;
      }
      if (patch.slug !== undefined && patch.slug !== null) {
        seoPatch.slug = slugify(patch.slug);
      }
      if (patch.targetKeyword !== undefined && patch.targetKeyword !== null) {
        seoPatch.targetKeyword = patch.targetKeyword;
      }
      if (patch.seoTitle !== undefined && patch.seoTitle !== null) {
        seoPatch.seoTitle = patch.seoTitle;
      }
      if (
        patch.metaDescription !== undefined &&
        patch.metaDescription !== null
      ) {
        seoPatch.metaDescription = patch.metaDescription;
      }
      results.push({
        status: "applied",
        toolName: toolCall.name,
        message: "Updated SEO metadata fields.",
      });
      continue;
    }

    if (toolCall.name === "reorder_blocks") {
      const parsed = reorderBlocksInputSchema.safeParse(toolCall.input);
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const reordered = reorderBlocks(workingContent, parsed.data.blockIds);
      if (!reordered.ok) {
        results.push(failedTool(toolCall.name, reordered.message));
        continue;
      }
      workingContent = reordered.content;
      parsed.data.blockIds.forEach((id) => highlightedBlockIds.add(id));
      results.push({
        status: "applied",
        toolName: toolCall.name,
        message: `Reordered ${parsed.data.blockIds.length} blocks.`,
      });
      continue;
    }

    if (toolCall.name === "delete_block") {
      const parsed = deleteBlockInputSchema.safeParse(toolCall.input);
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      const block = flattenBlocks(workingContent).find(
        (entry) => entry.id === parsed.data.blockId,
      );
      if (!block) {
        results.push(failedTool(toolCall.name, "Block no longer exists."));
        continue;
      }
      pendingDelete = {
        blockId: parsed.data.blockId,
        blockLabel: blockLabel(block),
        reason: parsed.data.reason ?? "",
      };
      results.push({
        status: "queued",
        toolName: toolCall.name,
        blockId: parsed.data.blockId,
        message: `Queued deletion confirmation for ${blockLabel(block)}.`,
      });
      continue;
    }

    if (toolCall.name === "request_clarification") {
      const parsed = requestClarificationInputSchema.safeParse(toolCall.input);
      if (!parsed.success) {
        results.push(failedTool(toolCall.name, firstIssue(parsed.error)));
        continue;
      }
      clarification = { options: parsed.data.options };
      results.push({
        status: "queued",
        toolName: toolCall.name,
        message: "Asked for a clarification choice.",
      });
      continue;
    }

    results.push(failedTool(toolCall.name, "Unknown AI tool."));
  }

  return {
    content: workingContent,
    seoPatch,
    results,
    pendingDelete,
    clarification,
    highlightedBlockIds: [...highlightedBlockIds],
  };
}

export function formatPageBuilderAiToolResultSummary(
  result: PageBuilderAiApplyResult,
) {
  if (result.results.length === 0) return "";
  return result.results.map((entry) => entry.message).join(" ");
}

export function collectBlockToolSpecs(content: PageContent): BlockToolSpec[] {
  return flattenBlocks(content).map((block, index) => ({
    name: blockToolName(block.id, index),
    blockId: block.id,
    label: blockLabel(block),
    block,
  }));
}

const dynamicBlockToolPattern = /^edit_block_\d+_(.+)$/;

function findBlockToolSpec(
  specs: BlockToolSpec[],
  toolName: string,
): BlockToolSpec | undefined {
  const exact = specs.find((spec) => spec.name === toolName);
  if (exact) return exact;

  // Tool names bake in the block's flatten index, but earlier tool calls in
  // the same batch (add_block, reorder_blocks) shift later indexes. Fall back
  // to the sanitized block-id suffix so the model's remaining edits still
  // resolve to the right block.
  const suffix = toolName.match(dynamicBlockToolPattern)?.[1];
  if (!suffix) return undefined;
  const matches = specs.filter(
    (spec) => spec.name.match(dynamicBlockToolPattern)?.[1] === suffix,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function applyDynamicBlockEdit(
  block: PageBlock,
  input: unknown,
): { ok: true; block: PageBlock } | { ok: false; message: string } {
  if (block.type === "hero") {
    const parsed = heroInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        eyebrow: nextText(parsed.data.eyebrow, block.props.eyebrow),
        heading: nextText(parsed.data.headline, block.props.heading),
        body: nextText(parsed.data.body, block.props.body),
        ctaLabel: nextText(parsed.data.ctaLabel, block.props.ctaLabel),
        ctaHref: nextText(parsed.data.ctaHref, block.props.ctaHref),
        ctaTrackingName:
          parsed.data.ctaLabel === undefined || parsed.data.ctaLabel === null
            ? block.props.ctaTrackingName
            : trackingNameForLabel(parsed.data.ctaLabel, "hero-cta"),
      },
    });
  }

  if (block.type === "rich_text") {
    const parsed = richTextBodyInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        eyebrow: nextText(parsed.data.eyebrow, block.props.eyebrow),
        heading: nextText(parsed.data.heading, block.props.heading),
        body: nextRichTextDocument(block.props.body, parsed.data),
      },
    });
  }

  if (block.type === "faq") {
    const parsed = faqInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        heading: nextText(parsed.data.heading, block.props.heading),
        items: parsed.data.items ?? block.props.items,
      },
    });
  }

  if (block.type === "card_grid") {
    const parsed = cardGridInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        heading: nextText(parsed.data.heading, block.props.heading),
        cards: normalizeCardGridCards(parsed.data.cards) ?? block.props.cards,
      },
    });
  }

  if (block.type === "cta") {
    const parsed = ctaInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    const label = nextText(parsed.data.label, block.props.label);
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        label,
        href: nextText(parsed.data.href, block.props.href),
        trackingName:
          parsed.data.label === undefined || parsed.data.label === null
            ? block.props.trackingName
            : trackingNameForLabel(label, "cta"),
      },
    });
  }

  if (block.type === "proof") {
    const parsed = proofInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        eyebrow: nextText(parsed.data.eyebrow, block.props.eyebrow),
        body: nextText(parsed.data.body, block.props.body),
        name: nextText(parsed.data.name, block.props.name),
        context: nextText(parsed.data.context, block.props.context),
      },
    });
  }

  if (block.type === "lead_form") {
    const parsed = leadFormInputSchema.safeParse(
      normalizeDynamicBlockInput(block.type, input),
    );
    if (!parsed.success)
      return { ok: false, message: firstIssue(parsed.error) };
    const submitLabel = nextText(
      parsed.data.submitLabel,
      block.props.submitLabel,
    );
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        heading: nextText(parsed.data.heading, block.props.heading),
        body: nextText(parsed.data.body, block.props.body),
        submitLabel,
        trackingName:
          parsed.data.submitLabel === undefined ||
          parsed.data.submitLabel === null
            ? block.props.trackingName
            : trackingNameForLabel(submitLabel, "lead-form"),
      },
    });
  }

  const parsed = mediaInputSchema.safeParse(
    normalizeDynamicBlockInput(block.type, input),
  );
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  if (block.type === "video") {
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        title: nextText(parsed.data.title, block.props.title),
        url: nextText(parsed.data.url, block.props.url),
        caption: nextText(parsed.data.caption, block.props.caption),
      },
    });
  }
  if (block.type === "image") {
    // The tool schema advertises `url` as editable, so honor it — but only
    // for sources that pass the same allowlist as new media blocks. Silently
    // ignoring the field would report "applied" for an edit that never
    // happened.
    const nextSrc = parsed.data.url?.trim() ?? "";
    if (nextSrc && !isAiSafeImageSource(nextSrc)) {
      return {
        ok: false,
        message: "Use an internal image path or an approved remote image URL.",
      };
    }
    const replacingSrc = Boolean(nextSrc) && nextSrc !== block.props.src;
    return parseBlock({
      ...block,
      props: {
        ...block.props,
        ...(replacingSrc ? { src: nextSrc, assetId: undefined } : {}),
        altText: nextText(parsed.data.altText, block.props.altText),
        caption: nextText(parsed.data.caption, block.props.caption),
      },
    });
  }

  return { ok: false, message: "Unsupported block type." };
}

function createAiBlock(
  input: z.infer<typeof addBlockInputSchema>,
  id: string,
): PageBlock {
  const block = createPageBlock(input.blockType, id);

  if (block.type === "hero") {
    const ctaLabel = normalizedCreationText(input.ctaLabel, 80);
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        heading: normalizedCreationText(input.title, 180),
        body: normalizedCreationText(input.body, 500),
        ctaLabel,
        ctaHref: normalizeAiHref(input.ctaHref),
        ctaTrackingName: trackingNameForLabel(ctaLabel, "hero-cta"),
      },
    });
  }

  if (block.type === "rich_text") {
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        heading: normalizedCreationText(input.title, 180),
        body: buildRichTextDocument(
          normalizedCreationText(input.body, 2000),
          input.bulletItems,
        ),
      },
    });
  }

  if (block.type === "faq") {
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        heading: normalizedCreationText(input.title, 160, "Questions"),
        items: normalizeCreationFaqItems(input.faqItems),
      },
    });
  }

  if (block.type === "card_grid") {
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        heading: normalizedCreationText(input.title, 160),
        cards:
          normalizeCardGridCards(normalizeCreationCardItems(input.cards)) ??
          (input.bulletItems ?? []).map((item) => ({
            title: truncateAiText(item, 140),
            body: "",
            href: "",
          })),
      },
    });
  }

  if (block.type === "cta") {
    const label =
      normalizedCreationText(input.ctaLabel, 80) ||
      normalizedCreationText(input.title, 80, "Get started");
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        label,
        href: normalizeAiHref(input.ctaHref) || "/apply",
        trackingName: trackingNameForLabel(label, "cta"),
      },
    });
  }

  if (block.type === "proof") {
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        eyebrow: normalizedCreationText(input.title, 80),
        body: normalizedCreationText(input.body, 800),
      },
    });
  }

  if (block.type === "lead_form") {
    const submitLabel = normalizedCreationText(
      input.ctaLabel,
      80,
      block.props.submitLabel,
    );
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        heading: normalizedCreationText(input.title, 160),
        body: normalizedCreationText(input.body, 500),
        submitLabel,
        trackingName: trackingNameForLabel(submitLabel, "lead-form"),
      },
    });
  }

  throw new Error(`Unsupported AI block type: ${input.blockType}`);
}

function normalizedCreationText(
  value: string | null | undefined,
  maxLength: number,
  fallback = "",
) {
  const normalized = normalizeNullableText(value, maxLength);
  return normalized === undefined || normalized === null
    ? fallback
    : normalized;
}

function normalizeCreationFaqItems(
  items: z.infer<typeof addBlockInputSchema>["faqItems"],
) {
  return (items ?? []).slice(0, 12).map((item) => ({
    question: truncateAiText(item.question, 240),
    answer: truncateAiText(item.answer, 1200),
  }));
}

function normalizeCreationCardItems(
  cards: z.infer<typeof addBlockInputSchema>["cards"],
) {
  if (!cards) return null;
  return cards.slice(0, 12).map((card) => ({
    title: truncateAiText(card.title, 140),
    body: truncateAiText(card.body, 500),
    href: card.href,
    linkLabel: normalizedCreationText(card.linkLabel, 80),
  }));
}

function createAiMediaBlock(
  input: z.infer<typeof addMediaBlockInputSchema>,
  id: string,
): PageBlock {
  const block = createPageBlock(input.mediaType, id);
  const url = input.url?.trim() ?? "";

  if (block.type === "image") {
    const altText =
      input.altText?.trim() ||
      input.caption?.trim() ||
      input.title?.trim() ||
      "Supporting image";

    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        src: url,
        altText,
        caption: input.caption ?? "",
        sourceRightsNotes: input.sourceRightsNotes ?? "",
      },
    });
  }

  if (block.type === "video") {
    return pageBlockSchema.parse({
      ...block,
      props: {
        ...block.props,
        title: input.title ?? "Video",
        url,
        caption: input.caption ?? "",
      },
    });
  }

  throw new Error(`Unsupported AI media block type: ${input.mediaType}`);
}

function createReplacementPageContent(
  current: PageContent,
  input: z.infer<typeof replacePageSectionsInputSchema>,
  makeBlockId: () => string,
): PageContent {
  return pageContentSchema.parse({
    version: 1,
    chrome: current.chrome,
    sections: input.sections.map((sectionInput, sectionIndex) => {
      const section = createPageSection(
        generatedAiId("section", makeBlockId),
        generatedAiId(`column_${sectionIndex + 1}`, makeBlockId),
      );
      return {
        ...section,
        columns: section.columns.map((column, columnIndex) =>
          columnIndex === 0
            ? {
                ...column,
                blocks: sectionInput.blocks.map((blockInput) =>
                  createAiBlock(blockInput, makeBlockId()),
                ),
              }
            : column,
        ),
      };
    }),
  });
}

function createImageTextSection(
  input: z.infer<typeof addImageTextSectionInputSchema>,
  makeBlockId: () => string,
) {
  const section = createPageSection(
    generatedAiId("section", makeBlockId),
    generatedAiId("column_text", makeBlockId),
  );
  const textColumnId =
    section.columns[0]?.id ?? generatedAiId("column_text", makeBlockId);
  const imageColumnId = generatedAiId("column_image", makeBlockId);
  const heading = input.heading ?? "";
  const imageUrl = input.imageUrl?.trim() ?? "";
  const imageAltText =
    input.imageAltText?.trim() ||
    input.imageCaption?.trim() ||
    heading ||
    "Supporting image";

  const textBlock = pageBlockSchema.parse({
    ...createPageBlock("rich_text", generatedAiId("text", makeBlockId)),
    variant: "intro",
    props: {
      eyebrow: "",
      heading,
      body: buildRichTextDocument(input.body, input.bulletItems),
    },
  });
  const imageBlock = pageBlockSchema.parse({
    ...createPageBlock("image", generatedAiId("image", makeBlockId)),
    variant: "standard",
    props: {
      src: imageUrl,
      altText: imageAltText,
      caption: input.imageCaption ?? "",
      sourceRightsNotes: input.sourceRightsNotes ?? "",
    },
  });
  const textColumn = {
    id: textColumnId,
    width: "1/2" as const,
    blocks: [textBlock],
  };
  const imageColumn = {
    id: imageColumnId,
    width: "1/2" as const,
    blocks: [imageBlock],
  };

  return {
    ...section,
    preset: "feature" as const,
    columns:
      input.imagePosition === "left"
        ? [imageColumn, textColumn]
        : [textColumn, imageColumn],
  };
}

function appendSectionToContent(
  content: PageContent,
  section: PageContent["sections"][number],
): PageContent {
  if (flattenBlocks(content).length === 0) {
    return {
      ...content,
      sections: [section],
    };
  }

  return {
    ...ensureEditablePageContent(content),
    sections: [...ensureEditablePageContent(content).sections, section],
  };
}

function appendBlockToPrimaryColumn(
  content: PageContent,
  block: PageBlock,
): PageContent {
  const editable = ensureEditablePageContent(content);
  const firstSection = editable.sections[0] ?? createPageSection("section_ai");
  const firstColumn = firstSection.columns[0] ?? createPageColumn("column_ai");

  return {
    ...editable,
    sections: editable.sections.map((section, sectionIndex) =>
      sectionIndex === 0
        ? {
            ...section,
            columns:
              section.columns.length === 0
                ? [{ ...firstColumn, blocks: [block] }]
                : section.columns.map((column, columnIndex) =>
                    columnIndex === 0
                      ? { ...column, blocks: [...column.blocks, block] }
                      : column,
                  ),
          }
        : section,
    ),
  };
}

function generatedAiId(prefix: string, makeBlockId: () => string) {
  return `${prefix}_${makeBlockId()}`
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 79);
}

function normalizeAddBlockInput(input: unknown) {
  const source = objectInput(input);
  if (!source) return input;

  return {
    blockType: source.blockType,
    title: normalizeNullableText(source.title, 180),
    body: normalizeNullableText(source.body, 2000),
    bulletItems: normalizeNullableTextArray(source.bulletItems, 12, 300),
    faqItems: normalizeFaqItems(source.faqItems, 12),
    cards: normalizeCardItems(source.cards, 12),
    ctaLabel: normalizeNullableText(source.ctaLabel, 80),
    ctaHref: normalizeNullableText(source.ctaHref, 500),
  };
}

function normalizeImageTextSectionInput(input: unknown) {
  const source = objectInput(input);
  if (!source) return input;

  return {
    heading: normalizeNullableText(source.heading, 180),
    body: normalizeNullableText(source.body, 2000),
    bulletItems: normalizeNullableTextArray(source.bulletItems, 12, 300),
    imageUrl: normalizeNullableText(source.imageUrl, 500),
    imageAltText: normalizeNullableText(source.imageAltText, 180),
    imageCaption: normalizeNullableText(source.imageCaption, 240),
    sourceRightsNotes: normalizeNullableText(source.sourceRightsNotes, 500),
    imagePosition:
      source.imagePosition === "left" || source.imagePosition === "right"
        ? source.imagePosition
        : undefined,
  };
}

function normalizeMediaBlockInput(input: unknown) {
  const source = objectInput(input);
  if (!source) return input;

  return {
    mediaType: source.mediaType,
    title: normalizeNullableText(source.title, 140),
    url: normalizeNullableText(source.url, 500),
    altText: normalizeNullableText(source.altText, 180),
    caption: normalizeNullableText(source.caption, 240),
    sourceRightsNotes: normalizeNullableText(source.sourceRightsNotes, 500),
  };
}

function normalizeReplacePageSectionsInput(input: unknown) {
  const source = objectInput(input);
  if (!source) return input;

  return {
    replaceExisting:
      typeof source.replaceExisting === "boolean"
        ? source.replaceExisting
        : undefined,
    sections: Array.isArray(source.sections)
      ? source.sections.slice(0, 12).map((section) => {
          const sectionSource = objectInput(section);
          if (!sectionSource) return section;
          return {
            title: normalizeNullableText(sectionSource.title, 180),
            blocks: Array.isArray(sectionSource.blocks)
              ? sectionSource.blocks.slice(0, 12).map(normalizeAddBlockInput)
              : sectionSource.blocks,
          };
        })
      : source.sections,
  };
}

function normalizeDynamicBlockInput(
  blockType: PageBlock["type"],
  input: unknown,
) {
  const source = objectInput(input);
  if (!source) return input;

  if (blockType === "hero") {
    return {
      eyebrow: normalizeNullableText(source.eyebrow, 80),
      headline: normalizeNullableText(source.headline, 180),
      body: normalizeNullableText(source.body, 500),
      ctaLabel: normalizeNullableText(source.ctaLabel, 80),
      ctaHref: normalizeNullableText(source.ctaHref, 500),
    };
  }

  if (blockType === "rich_text") {
    return {
      eyebrow: normalizeNullableText(source.eyebrow, 80),
      heading: normalizeNullableText(source.heading, 180),
      body: normalizeNullableText(source.body, 2000),
      bulletItems: normalizeNullableTextArray(source.bulletItems, 12, 300),
    };
  }

  if (blockType === "faq") {
    return {
      heading: normalizeNullableText(source.heading, 160),
      items: normalizeFaqItems(source.items, 12),
    };
  }

  if (blockType === "card_grid") {
    return {
      heading: normalizeNullableText(source.heading, 160),
      cards: normalizeCardItems(source.cards, 12),
    };
  }

  if (blockType === "cta") {
    return {
      label: normalizeNullableText(source.label, 80),
      href: normalizeNullableText(source.href, 500),
    };
  }

  if (blockType === "proof") {
    return {
      eyebrow: normalizeNullableText(source.eyebrow, 80),
      body: normalizeNullableText(source.body, 800),
      name: normalizeNullableText(source.name, 120),
      context: normalizeNullableText(source.context, 160),
    };
  }

  if (blockType === "lead_form") {
    return {
      heading: normalizeNullableText(source.heading, 160),
      body: normalizeNullableText(source.body, 500),
      submitLabel: normalizeNullableText(source.submitLabel, 80),
    };
  }

  return {
    title: normalizeNullableText(source.title, 140),
    url: normalizeNullableText(source.url, 500),
    altText: normalizeNullableText(source.altText, 180),
    caption: normalizeNullableText(source.caption, 240),
  };
}

function normalizeSeoMetadataInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const source = input as Record<string, unknown>;
  const normalized: Partial<
    Record<keyof typeof seoMetadataInputLimits, string | null>
  > = {};

  for (const [field, limit] of Object.entries(seoMetadataInputLimits) as Array<
    [keyof typeof seoMetadataInputLimits, number]
  >) {
    const value = source[field];
    if (value === undefined) continue;
    if (value === null) {
      normalized[field] = null;
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      normalized[field] = truncateAiText(String(value), limit);
    }
  }

  return normalized;
}

function truncateAiText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const hardCut = trimmed.slice(0, maxLength).trimEnd();
  const wordCut = hardCut.replace(/\s+\S*$/u, "").trimEnd();
  return wordCut || hardCut;
}

export function objectInput(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return truncateAiText(String(value), maxLength);
  }
  return undefined;
}

function normalizeNullableTextArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return value;

  return value
    .slice(0, maxItems)
    .flatMap((item) =>
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
        ? [truncateAiText(String(item), maxLength)]
        : [],
    );
}

function normalizeFaqItems(value: unknown, maxItems: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return value;

  return value.slice(0, maxItems).flatMap((item) => {
    const source = objectInput(item);
    if (!source) return [];
    return [
      {
        question: normalizeNullableText(source.question, 240) ?? "",
        answer: normalizeNullableText(source.answer, 1200) ?? "",
      },
    ];
  });
}

function normalizeCardItems(value: unknown, maxItems: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return value;

  return value.slice(0, maxItems).flatMap((item) => {
    const source = objectInput(item);
    if (!source) return [];
    return [
      {
        title: normalizeNullableText(source.title, 140) ?? "",
        body: normalizeNullableText(source.body, 500) ?? "",
        href: normalizeNullableText(source.href, 500),
        linkLabel: normalizeNullableText(source.linkLabel, 80),
      },
    ];
  });
}

function reorderBlocks(
  content: PageContent,
  blockIds: string[],
): { ok: true; content: PageContent } | { ok: false; message: string } {
  const blocks = flattenBlocks(content);
  const currentIds = blocks.map((block) => block.id);
  const requested = new Set(blockIds);

  if (requested.size !== blockIds.length) {
    return { ok: false, message: "Reorder contains duplicate block IDs." };
  }
  if (
    currentIds.length !== blockIds.length ||
    currentIds.some((id) => !requested.has(id))
  ) {
    return {
      ok: false,
      message: "Reorder must include every current block ID exactly once.",
    };
  }

  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const ordered = blockIds.flatMap((id) => {
    const block = blocksById.get(id);
    return block ? [block] : [];
  });
  let nextIndex = 0;

  return {
    ok: true,
    content: {
      ...content,
      sections: content.sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => {
          const count = column.blocks.length;
          const nextBlocks = ordered.slice(nextIndex, nextIndex + count);
          nextIndex += count;
          return { ...column, blocks: nextBlocks };
        }),
      })),
    },
  };
}

function replaceBlockById(
  content: PageContent,
  blockId: string,
  nextBlock: PageBlock,
): PageContent {
  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        blocks: column.blocks.map((block) =>
          block.id === blockId ? nextBlock : block,
        ),
      })),
    })),
  };
}

function parseBlock(
  candidate: PageBlock,
): { ok: true; block: PageBlock } | { ok: false; message: string } {
  const parsed = pageBlockSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, block: parsed.data };
  return { ok: false, message: firstIssue(parsed.error) };
}

function nextText(
  next: string | null | undefined,
  current: string | undefined,
) {
  return next === undefined || next === null ? (current ?? "") : next;
}

function normalizeCardGridCards(
  cards:
    | Array<{
        title: string;
        body: string;
        href?: string | null;
        linkLabel?: string | null;
      }>
    | null
    | undefined,
) {
  if (!cards) return null;
  return cards.map((card) => ({
    title: card.title,
    body: card.body,
    href: normalizeAiHref(card.href),
    ...(card.linkLabel ? { linkLabel: card.linkLabel } : {}),
  }));
}

function normalizeAiHref(href: string | null | undefined) {
  const trimmed = href?.trim() ?? "";
  if (trimmed.startsWith("#")) return "";
  return trimmed;
}

function nextRichTextDocument(
  current: RichTextDocument,
  input: z.infer<typeof richTextBodyInputSchema>,
): RichTextDocument {
  // Strict tool schemas tell the model "pass null for any field that should
  // stay unchanged" — honor that here like nextText does. Rebuilding the
  // document from flattened plain text would destroy headings, lists, and
  // span formatting on a routine heading-only edit.
  const body = input.body ?? null;
  const bulletItems = input.bulletItems ?? null;
  if (body === null && bulletItems === null) return current;
  if (body !== null && bulletItems !== null) {
    return buildRichTextDocument(body, bulletItems);
  }

  if (body !== null) {
    // New prose, existing lists untouched.
    const listNodes = current.nodes.filter((node) => node.type === "list");
    const text = body.trim();
    const nodes: RichTextNode[] = [
      ...(text ? [{ type: "paragraph", text } as const] : []),
      ...listNodes,
    ];
    if (nodes.length === 0) nodes.push({ type: "paragraph", text: "" });
    return { version: 1, nodes };
  }

  // New bullet items, existing prose untouched.
  const proseNodes = current.nodes.filter((node) => node.type !== "list");
  const items = (bulletItems ?? []).filter((item) => item.trim().length > 0);
  const nodes: RichTextNode[] = [...proseNodes];
  if (items.length > 0) nodes.push({ type: "list", style: "bullet", items });
  if (nodes.length === 0) nodes.push({ type: "paragraph", text: "" });
  return { version: 1, nodes };
}

function buildRichTextDocument(
  body: string | null | undefined,
  bulletItems: string[] | null | undefined,
): RichTextDocument {
  const nodes: RichTextNode[] = [];
  const text = body?.trim();
  if (text) nodes.push({ type: "paragraph", text });
  const items = (bulletItems ?? []).filter((item) => item.trim().length > 0);
  if (items.length > 0) nodes.push({ type: "list", style: "bullet", items });
  if (nodes.length === 0) nodes.push({ type: "paragraph", text: "" });
  return { version: 1, nodes };
}

function blockToolName(blockId: string, index: number) {
  const safeId = blockId.replace(/[^A-Za-z0-9_-]/g, "_");
  const prefix = `edit_block_${index + 1}_`;
  return `${prefix}${safeId}`.slice(0, 64);
}

function blockLabel(block: PageBlock) {
  const title = summarizeBlockTitle(block);
  return title
    ? `${humanBlockType(block.type)} "${title}"`
    : humanBlockType(block.type);
}

function summarizeBlockTitle(block: PageBlock) {
  if (block.type === "hero") return block.props.heading;
  if (block.type === "rich_text") return block.props.heading;
  if (block.type === "faq") return block.props.heading;
  if (block.type === "card_grid") return block.props.heading;
  if (block.type === "cta") return block.props.label;
  if (block.type === "proof") return block.props.name || block.props.eyebrow;
  if (block.type === "lead_form") return block.props.heading;
  if (block.type === "image") return block.props.altText || block.props.caption;
  return block.props.title;
}

export function humanBlockType(type: PageBlock["type"]) {
  if (type === "faq") return "FAQ";
  if (type === "cta") return "CTA";
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function summarizeBlock(block: PageBlock) {
  const text =
    block.type === "hero"
      ? [
          block.props.eyebrow,
          block.props.heading,
          block.props.body,
          block.props.ctaLabel,
        ]
      : block.type === "rich_text"
        ? [
            block.props.eyebrow,
            block.props.heading,
            richTextDocumentPlainText(block.props.body),
          ]
        : block.type === "faq"
          ? [
              block.props.heading,
              ...block.props.items.flatMap((item) => [
                item.question,
                item.answer,
              ]),
            ]
          : block.type === "card_grid"
            ? [
                block.props.heading,
                ...block.props.cards.flatMap((card) => [card.title, card.body]),
              ]
            : block.type === "cta"
              ? [block.props.label, block.props.href]
              : block.type === "proof"
                ? [
                    block.props.eyebrow,
                    block.props.body,
                    block.props.name,
                    block.props.context,
                  ]
                : block.type === "lead_form"
                  ? [
                      block.props.heading,
                      block.props.body,
                      block.props.submitLabel,
                    ]
                  : block.type === "image"
                    ? [block.props.altText, block.props.caption]
                    : [block.props.title, block.props.caption];

  return text
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function failedTool(
  toolName: string,
  message: string,
): PageBuilderAiToolResult {
  return { status: "failed", toolName, message };
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid tool input.";
}
