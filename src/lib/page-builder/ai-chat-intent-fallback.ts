import "server-only";

import { flattenBlocks } from "@/lib/page-builder/blocks";
import { selectPageGuide } from "@/lib/page-builder/ai-page-guides";
import { SEO_COPY_STANDARDS } from "@/lib/page-builder/copy-standards";
import {
  humanBlockType,
  objectInput,
  type AiAddBlockType,
  type PageBuilderAiChatRequest,
  type PageBuilderAiChatResponse,
  type PageBuilderAiContext,
  type PageBuilderAiToolCall,
} from "@/lib/page-builder/ai-chat";
import {
  addBlockFallbackToolCall,
  addImageTextSectionToolCall,
  addMediaBlockToolCall,
  completePageDraftSeoMetadataToolCall,
  completePageDraftToolCall,
  imageTextSectionClarificationToolCall,
  intentTopic,
  mediaSourceClarificationToolCall,
} from "@/lib/page-builder/ai-chat-draft-copy";

export function normalizePageBuilderAiChatResponseForIntent(
  request: PageBuilderAiChatRequest,
  response: PageBuilderAiChatResponse,
): PageBuilderAiChatResponse {
  const fallback = intentFallbackToolCall(request, response);
  if (!fallback) return response;
  return fallback;
}

function intentFallbackToolCall(
  request: PageBuilderAiChatRequest,
  response: PageBuilderAiChatResponse,
): PageBuilderAiChatResponse | null {
  const latestUserMessage = latestUserMessageFrom(request.messages);
  if (!latestUserMessage) return null;

  const fallback = resolveIntentFallbackAction(
    latestUserMessage,
    request.context,
    response,
  );
  if (!fallback) return null;

  return applyIntentFallbackAction(fallback, response);
}

type IntentFallbackAction = {
  mode: "append" | "replace";
  message: string;
  toolCalls: PageBuilderAiToolCall[];
};

function latestUserMessageFrom(messages: PageBuilderAiChatRequest["messages"]) {
  return [...messages].reverse().find((message) => message.role === "user")
    ?.content;
}

function resolveIntentFallbackAction(
  message: string,
  context: PageBuilderAiContext,
  response: PageBuilderAiChatResponse,
): IntentFallbackAction | null {
  return (
    completePageDraftFallbackAction(message, context, response) ??
    imageTextSectionFallbackAction(message, context, response) ??
    mediaBlockFallbackAction(message, context, response) ??
    addBlockFallbackAction(message, context, response)
  );
}

function completePageDraftFallbackAction(
  message: string,
  context: PageBuilderAiContext,
  response: PageBuilderAiChatResponse,
): IntentFallbackAction | null {
  if (!isCompletePageDraftIntent(message)) return null;
  const replaceExisting = isFullPageReplaceIntent(message);
  if (flattenBlocks(context.content).length > 0 && !replaceExisting) {
    return null;
  }
  const responseHasMetadataTool = responseHasTool(response, [
    "set_seo_metadata",
  ]);
  const metadataFallback = (
    responseHasMetadataTool
      ? responseNeedsSeoMetadataFallback(response, context.targetKeyword)
      : currentSeoMetadataNeedsFallback(context)
  )
    ? completePageDraftSeoMetadataToolCall(
        intentTopic(message, context),
        context,
      )
    : null;
  const replacementTool = response.toolCalls.find(
    (toolCall) => toolCall.name === "replace_page_sections",
  );
  if (
    replacementTool &&
    replacePageSectionsNeedsSeoQualityFallback(
      replacementTool.input,
      context.targetKeyword,
    )
  ) {
    const pageGuide = selectPageGuide({
      pageType: context.pageType,
      templateKey: context.templateKey,
      title: context.title,
      slug: context.slug,
      targetKeyword: context.targetKeyword,
      seoTitle: context.seoTitle,
      metaDescription: context.metaDescription,
      content: context.content,
      latestUserMessage: message,
    });

    // The model's replace_page_sections failed the quality gate, so it must
    // be dropped, not appended after: applying it first would fill the page
    // and turn the review-safe draft into a keep/replace clarification. Keep
    // the model's metadata call when it passed its own check.
    const preservedMetadata =
      responseHasMetadataTool && !metadataFallback
        ? response.toolCalls.filter(
            (toolCall) => toolCall.name === "set_seo_metadata",
          )
        : [];

    return replaceWithFallback(
      "Rebuilt the page body with a review-safe SEO draft.",
      [
        ...preservedMetadata,
        metadataFallback,
        completePageDraftToolCall(
          intentTopic(message, context),
          pageGuide,
          replaceExisting,
        ),
      ].filter((toolCall): toolCall is PageBuilderAiToolCall =>
        Boolean(toolCall),
      ),
    );
  }
  if (responseHasContentTool(response)) {
    return metadataFallback
      ? appendWithFallback(
          "Updated SEO metadata with review-safe copy.",
          metadataFallback,
        )
      : null;
  }

  const pageGuide = selectPageGuide({
    pageType: context.pageType,
    templateKey: context.templateKey,
    title: context.title,
    slug: context.slug,
    targetKeyword: context.targetKeyword,
    seoTitle: context.seoTitle,
    metaDescription: context.metaDescription,
    content: context.content,
    latestUserMessage: message,
  });

  return appendWithFallback(
    "Built the page body draft.",
    [
      metadataFallback,
      completePageDraftToolCall(
        intentTopic(message, context),
        pageGuide,
        replaceExisting,
      ),
    ].filter((toolCall): toolCall is PageBuilderAiToolCall =>
      Boolean(toolCall),
    ),
  );
}

function imageTextSectionFallbackAction(
  message: string,
  context: PageBuilderAiContext,
  response: PageBuilderAiChatResponse,
): IntentFallbackAction | null {
  if (!isImageTextSectionIntent(message)) return null;
  if (responseHasTool(response, ["add_image_text_section"])) return null;

  const imageUrl = extractMediaSource(message);
  if (!imageUrl) {
    if (responseHasTool(response, ["request_clarification"])) return null;
    return replaceWithFallback(
      "I can add the image and text section, but I need the image source first.",
      imageTextSectionClarificationToolCall(),
    );
  }

  return appendWithFallback(
    "Added a paired image and text section.",
    addImageTextSectionToolCall(intentTopic(message, context), imageUrl),
  );
}

function mediaBlockFallbackAction(
  message: string,
  context: PageBuilderAiContext,
  response: PageBuilderAiChatResponse,
): IntentFallbackAction | null {
  const mediaType = detectMediaBlockIntent(message);
  if (!mediaType) return null;
  if (responseHasTool(response, ["add_media_block"])) return null;

  const mediaUrl = extractMediaSource(message);
  if (!mediaUrl) {
    if (responseHasTool(response, ["request_clarification"])) return null;
    return replaceWithFallback(
      `I can add the ${mediaType} block, but I need the media source first.`,
      mediaSourceClarificationToolCall(),
    );
  }

  return appendWithFallback(
    `Added a ${mediaType} block.`,
    addMediaBlockToolCall(mediaType, intentTopic(message, context), mediaUrl),
  );
}

function addBlockFallbackAction(
  message: string,
  context: PageBuilderAiContext,
  response: PageBuilderAiChatResponse,
): IntentFallbackAction | null {
  const blockType = detectAddBlockIntent(message);
  if (!blockType) return null;
  if (responseHasContentTool(response)) return null;

  return appendWithFallback(
    `Added ${humanBlockType(blockType)}.`,
    addBlockFallbackToolCall(blockType, message, context),
  );
}

function replaceWithFallback(
  message: string,
  toolCall: PageBuilderAiToolCall | PageBuilderAiToolCall[],
): IntentFallbackAction {
  return { mode: "replace", message, toolCalls: arrayToolCalls(toolCall) };
}

function appendWithFallback(
  message: string,
  toolCall: PageBuilderAiToolCall | PageBuilderAiToolCall[],
): IntentFallbackAction {
  return { mode: "append", message, toolCalls: arrayToolCalls(toolCall) };
}

function applyIntentFallbackAction(
  fallback: IntentFallbackAction,
  response: PageBuilderAiChatResponse,
) {
  return fallbackResponse(
    fallback.message,
    fallback.toolCalls,
    fallback.mode === "append" ? response : undefined,
  );
}

function arrayToolCalls(
  toolCall: PageBuilderAiToolCall | PageBuilderAiToolCall[],
) {
  return Array.isArray(toolCall) ? toolCall : [toolCall];
}

function isCompletePageDraftIntent(message: string) {
  const text = message.toLowerCase();
  const asksToCreate =
    /\b(create|draft|build|generate|write|make|rebuild|replace|overwrite|regenerate|redo|rework)\b/.test(
      text,
    ) || /\bfrom scratch\b/.test(text);
  const mentionsPage = /\b(page|landing page|seo page|resource|draft)\b/.test(
    text,
  );
  const broadTopic = /\b(about|for|on|around)\b/.test(text);
  return asksToCreate && mentionsPage && broadTopic;
}

function isFullPageReplaceIntent(message: string) {
  const text = message.toLowerCase();
  const asksForReplacement =
    /\b(rebuild|replace|overwrite|regenerate|redo|rework|start over)\b/.test(
      text,
    ) || /\bfrom scratch\b/.test(text);
  const mentionsWholePage =
    /\b(page|draft|body|content|copy|blocks?|sections?)\b/.test(text);
  return asksForReplacement && mentionsWholePage;
}

function isImageTextSectionIntent(message: string) {
  const text = message.toLowerCase();
  const asksToAdd = isAddRequest(text);
  const mentionsImage = /\b(image|photo|picture|visual|media)\b/.test(text);
  const mentionsText = /\b(text|copy|content|paragraph|words|body)\b/.test(
    text,
  );
  const mentionsSection = /\b(section|block|row|area)\b/.test(text);

  return asksToAdd && mentionsImage && mentionsText && mentionsSection;
}

function detectMediaBlockIntent(message: string): "image" | "video" | null {
  const text = message.toLowerCase();
  if (!isAddRequest(text)) return null;
  if (/\b(video|youtube|vimeo|embed|clip)\b/.test(text)) return "video";
  if (/\b(image|photo|picture|visual|media)\b/.test(text)) return "image";
  return null;
}

function detectAddBlockIntent(message: string): AiAddBlockType | null {
  const text = message.toLowerCase();
  if (!isAddRequest(text)) return null;

  const checks: Array<[AiAddBlockType, RegExp]> = [
    [
      "lead_form",
      /\b(lead form|enquiry form|inquiry form|contact form|application form|signup form|sign-up form|form block)\b/,
    ],
    [
      "card_grid",
      /\b(card grid|cards?|tiles?|grid|comparison|options|services list|benefits grid|feature grid)\b/,
    ],
    ["faq", /\b(faq|faqs|q&a|questions?|answers?|question and answer)\b/],
    [
      "cta",
      /\b(cta|call to action|button|contact button|booking button|enquiry button|inquiry button)\b/,
    ],
    [
      "proof",
      /\b(proof|testimonial|quote|stat|evidence|social proof|case proof|trust block)\b/,
    ],
    [
      "hero",
      /\b(hero|headline|opening|page opener|top section|above the fold)\b/,
    ],
    [
      "rich_text",
      /\b(text block|text section|copy block|body copy|paragraph|article section|intro copy|rich text|content section|written section)\b/,
    ],
  ];

  return checks.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function isAddRequest(text: string) {
  return /\b(add|create|insert|make|build|put|include|draft|generate|write|compose|give me)\b/.test(
    text,
  );
}

function extractMediaSource(message: string) {
  const external = message.match(/https?:\/\/[^\s'")]+/i)?.[0];
  if (external) return cleanMediaSource(external);
  const internal = message.match(
    /\/[^\s'")]+\.(?:avif|webp|png|jpe?g|gif|svg|mp4|webm|mov|m4v)(?:[?#][^\s'")]*)?/i,
  )?.[0];
  return internal ? cleanMediaSource(internal) : "";
}

function cleanMediaSource(value: string) {
  return value.replace(/[.,;!?]+$/g, "");
}

export type ReplacementSeoDraftQualityAssessment = {
  needsFallback: boolean;
  reasons: string[];
  metrics: {
    blockCount: number;
    cardCount: number;
    emptyVisibleBlock: boolean;
    exactKeywordCount: number;
    faqCount: number;
    riskMatches: string[];
    unsupportedBlockType: boolean;
    wordCount: number;
  };
};

function replacePageSectionsNeedsSeoQualityFallback(
  input: unknown,
  targetKeyword: string,
) {
  return assessReplacementSeoDraftQuality(input, targetKeyword).needsFallback;
}

export function assessReplacementSeoDraftQuality(
  input: unknown,
  targetKeyword: string,
): ReplacementSeoDraftQualityAssessment {
  const source = objectInput(input);
  const sections = Array.isArray(source?.sections) ? source.sections : [];
  const blocks = sections.flatMap((section) => {
    const sectionSource = objectInput(section);
    return Array.isArray(sectionSource?.blocks) ? sectionSource.blocks : [];
  });

  let cardCount = 0;
  let faqCount = 0;
  const textParts: string[] = [];
  let unsupportedBlockType = false;
  let emptyVisibleBlock = false;

  for (const block of blocks) {
    const blockSource = objectInput(block);
    if (!blockSource) {
      unsupportedBlockType = true;
      continue;
    }
    const blockQuality = replacementBlockSeoQuality(blockSource);
    unsupportedBlockType ||= blockQuality.unsupportedBlockType;
    emptyVisibleBlock ||= blockQuality.emptyVisibleBlock;
    textParts.push(...blockQuality.textParts);
    cardCount = Math.max(cardCount, blockQuality.cardCount);
    faqCount = Math.max(faqCount, blockQuality.faqCount);
  }

  const text = textParts.join(" ");
  const lower = text.toLowerCase();
  const wordCount = text.match(/[A-Za-z0-9']+/g)?.length ?? 0;

  const normalizedTarget = targetKeyword.trim().toLowerCase();
  const exactKeywordCount = normalizedTarget
    ? lower.split(normalizedTarget).length - 1
    : 0;
  const riskMatches = seoQualityRiskPatterns()
    .filter((pattern) => pattern.test(lower))
    .map((pattern) => pattern.source);

  const draftTier = SEO_COPY_STANDARDS.completeDraft;
  const reasons: string[] = [];
  if (blocks.length < draftTier.minBlocks) reasons.push("too_few_blocks");
  if (unsupportedBlockType) reasons.push("unsupported_block_type");
  if (emptyVisibleBlock) reasons.push("empty_visible_block");
  if (cardCount < draftTier.minCards) reasons.push("too_few_cards");
  if (faqCount < draftTier.minFaqItems) reasons.push("too_few_faqs");
  if (wordCount < draftTier.minVisibleWords) reasons.push("too_few_words");
  if (normalizedTarget) {
    if (exactKeywordCount > draftTier.maxExactKeywordMentions) {
      reasons.push("keyword_overuse");
    }
  }
  if (riskMatches.length > 0) reasons.push("review_risk_language");

  return {
    needsFallback: reasons.length > 0,
    reasons,
    metrics: {
      blockCount: blocks.length,
      cardCount,
      emptyVisibleBlock,
      exactKeywordCount,
      faqCount,
      riskMatches,
      unsupportedBlockType,
      wordCount,
    },
  };
}

const replacementBlockTypes = new Set([
  "hero",
  "rich_text",
  "faq",
  "card_grid",
  "cta",
  "proof",
  "lead_form",
]);

function replacementBlockSeoQuality(blockSource: Record<string, unknown>) {
  const blockType =
    typeof blockSource.blockType === "string" ? blockSource.blockType : "";
  const textParts: string[] = [];
  let cardCount = 0;
  let faqCount = 0;

  if (!replacementBlockTypes.has(blockType)) {
    return {
      cardCount,
      emptyVisibleBlock: true,
      faqCount,
      textParts,
      unsupportedBlockType: true,
    };
  }

  pushReplacementText(textParts, blockSource.title);
  pushReplacementText(textParts, blockSource.body);
  pushReplacementText(textParts, blockSource.ctaLabel);
  const bulletItems = Array.isArray(blockSource.bulletItems)
    ? blockSource.bulletItems
    : [];
  for (const item of bulletItems) pushReplacementText(textParts, item);

  const cards = Array.isArray(blockSource.cards) ? blockSource.cards : [];
  cardCount = cards.length;
  for (const card of cards) {
    const cardSource = objectInput(card);
    if (!cardSource) continue;
    pushReplacementText(textParts, cardSource.title);
    pushReplacementText(textParts, cardSource.body);
    pushReplacementText(textParts, cardSource.linkLabel);
  }

  const faqItems = Array.isArray(blockSource.faqItems)
    ? blockSource.faqItems
    : [];
  faqCount = faqItems.length;
  for (const item of faqItems) {
    const faqSource = objectInput(item);
    if (!faqSource) continue;
    pushReplacementText(textParts, faqSource.question);
    pushReplacementText(textParts, faqSource.answer);
  }

  return {
    cardCount,
    emptyVisibleBlock: textParts.join(" ").trim().length === 0,
    faqCount,
    textParts,
    unsupportedBlockType: false,
  };
}

function pushReplacementText(textParts: string[], value: unknown) {
  if (typeof value === "string" && value.trim()) textParts.push(value);
}

function seoQualityRiskPatterns() {
  return [
    /\btarget keyword\b/,
    /\bexact phrase\b/,
    /\bsearch intent\b/,
    /\bthis seo page\b/,
    /\bappears throughout\b/,
    /\bfree consultation\b/,
    /\bmonthly fee\b/,
    /\bcost savings?\b/,
    /\bcuts? costs?\b/,
    /\bboosts? employee satisfaction\b/,
    /\b\d+\s*[–-]\s*\d+\s*(?:m²|sqm|square metres?|square meters?)\b/,
    /\bsquare metres?\b/,
    /\bsquare meters?\b/,
    /\bdedicated teams?\b/,
    /\bmonthly usage reports?\b/,
    /\blocal [a-z ]*flavou?rs?\b/,
    /\b24-?hour\b/,
    /\bguarantee(?:d|s)?\b/,
    /\bfull compliance\b/,
    /\bfood safety standards?\b/,
  ];
}

function responseNeedsSeoMetadataFallback(
  response: PageBuilderAiChatResponse,
  targetKeyword: string,
) {
  const metadataCalls = response.toolCalls.filter(
    (toolCall) => toolCall.name === "set_seo_metadata",
  );
  if (metadataCalls.length === 0) return false;

  return metadataCalls.some((toolCall) => {
    const input = objectInput(toolCall.input);
    if (!input) return true;
    const callTargetKeyword =
      typeof input.targetKeyword === "string" ? input.targetKeyword : "";
    const normalizedTarget = (callTargetKeyword || targetKeyword)
      .trim()
      .toLowerCase();
    const seoTitle = typeof input.seoTitle === "string" ? input.seoTitle : "";
    const metaDescription =
      typeof input.metaDescription === "string" ? input.metaDescription : "";
    const combined = `${seoTitle} ${metaDescription}`.toLowerCase();
    if (
      normalizedTarget &&
      metaDescription &&
      !metaDescription.toLowerCase().includes(normalizedTarget)
    ) {
      return true;
    }
    return seoMetadataHasRiskyClaims(combined);
  });
}

function currentSeoMetadataNeedsFallback(context: PageBuilderAiContext) {
  const targetKeyword = context.targetKeyword.trim().toLowerCase();
  const metaDescription = context.metaDescription.trim().toLowerCase();
  if (
    targetKeyword &&
    metaDescription &&
    !metaDescription.includes(targetKeyword)
  ) {
    return true;
  }
  return seoMetadataHasRiskyClaims(
    `${context.seoTitle} ${context.metaDescription}`.toLowerCase(),
  );
}

function seoMetadataHasRiskyClaims(text: string) {
  return [
    /\bfree consultation\b/,
    /\bmonthly fee\b/,
    /\bcost savings?\b/,
    /\bcuts? costs?\b/,
    /\bboosts? employee satisfaction\b/,
    /\bguarantee(?:d|s)?\b/,
    /\b\d+\s*[–-]\s*\d+\s*(?:m²|sqm|square metres?|square meters?)\b/,
    /\bdedicated teams?\b/,
    /\bmonthly usage reports?\b/,
    /\b24-?hour\b/,
    /\bfull compliance\b/,
    /\bfood safety standards?\b/,
  ].some((pattern) => pattern.test(text));
}

function responseHasTool(response: PageBuilderAiChatResponse, names: string[]) {
  return response.toolCalls.some((toolCall) => names.includes(toolCall.name));
}

function responseHasContentTool(response: PageBuilderAiChatResponse) {
  return response.toolCalls.some(
    (toolCall) =>
      toolCall.name.startsWith("edit_block_") ||
      [
        "add_block",
        "add_media_block",
        "add_image_text_section",
        "replace_page_sections",
        "reorder_blocks",
        "delete_block",
      ].includes(toolCall.name),
  );
}

function fallbackResponse(
  message: string,
  toolCalls: PageBuilderAiToolCall[],
  response?: PageBuilderAiChatResponse,
): PageBuilderAiChatResponse {
  return {
    message: response?.message || message,
    toolCalls: [...(response?.toolCalls ?? []), ...toolCalls],
    source: "intent-fallback",
  };
}
