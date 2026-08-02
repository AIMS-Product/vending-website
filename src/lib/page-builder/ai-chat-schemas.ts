import { z } from "zod";
import {
  pageContentSchema,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import {
  META_DESCRIPTION_LEGACY_MAX_LENGTH,
  META_DESCRIPTION_MAX_LENGTH,
} from "@/lib/page-builder/copy-standards";

/**
 * Request, response, and tool-input shapes for the page-builder AI chat, plus
 * the types they produce.
 *
 * Split out of ai-chat.ts, which was 1833 lines. This half only declares what
 * a valid message and a valid tool call look like and never touches page
 * content; the executor that acts on them stayed in ai-chat.ts, which
 * re-exports the same public names it always did, so no caller changed.
 */

export type PageBuilderAiFunctionTool = {
  type: "function";
  name: string;
  description: string;
  strict: true;
  parameters: JsonSchemaObject;
};

export type JsonSchemaObject = {
  type: "object";
  additionalProperties: false;
  required: string[];
  properties: Record<string, unknown>;
};

// The two source predicates the schemas below refine with. They only inspect
// a string, so they belong with the shapes rather than with the executor.
function isAiSafeMediaSource(value: string) {
  return (
    /^\/(?!\/).+\.(?:avif|webp|png|jpe?g|gif|svg|mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(
      value,
    ) || /^https?:\/\/.+/i.test(value)
  );
}

export function isAiSafeImageSource(value: string) {
  return (
    /^\/(?!\/).+\.(?:avif|webp|png|jpe?g|gif|svg)(?:[?#].*)?$/i.test(value) ||
    /^https:\/\/aacisvhkmsaabqdvdmmf\.supabase\.co\/storage\/v1\/object\/public\/.+/i.test(
      value,
    ) ||
    /^https:\/\/cdn\.prod\.website-files\.com\/.+/i.test(value)
  );
}

const blockIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{1,79}$/);

const nullableText = (max = 2000) =>
  z.string().trim().max(max).nullable().optional();

export const nullableStringSchema = (max: number) => ({
  type: ["string", "null"],
  maxLength: max,
});

export const nonEmptyStringSchema = (max: number) => ({
  type: "string",
  minLength: 1,
  maxLength: max,
});

export const safeHrefSchema = {
  type: ["string", "null"],
  maxLength: 500,
  pattern: "^(|/[^/].*|https?://.+)$",
};

export const safeMediaSourceSchema = {
  type: ["string", "null"],
  maxLength: 500,
  pattern:
    "^(|/[^/].*\\.(?:avif|webp|png|jpe?g|gif|svg|mp4|webm|mov|m4v)(?:[?#].*)?|https?://.+)$",
};

export const safeImageSourceSchema = {
  type: ["string", "null"],
  maxLength: 500,
  pattern:
    "^(|/[^/].*\\.(?:avif|webp|png|jpe?g|gif|svg)(?:[?#].*)?|https://aacisvhkmsaabqdvdmmf\\.supabase\\.co/storage/v1/object/public/.+|https://cdn\\.prod\\.website-files\\.com/.+)$",
};

export const imageTextSectionClarificationOptions = [
  "Paste an image URL",
  "Choose a media library image first",
  "Add the text section now",
];

export const mediaSourceClarificationOptions = [
  "Paste a media URL",
  "Choose from the media library first",
  "Add a text placeholder instead",
];

const pageBuilderAiChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(6000),
  })
  .strict();

export const pageBuilderAiContextSchema = z
  .object({
    pageId: z.uuid().nullable(),
    status: z.string().trim().max(80),
    title: z.string().trim().max(180),
    slug: z.string().trim().max(120),
    pageType: z.string().trim().max(80).default("resource"),
    templateKey: z.string().trim().max(120).default("blank"),
    targetKeyword: z.string().trim().max(180),
    seoTitle: z.string().trim().max(80),
    // Request context carries the page's existing stored value, so it uses the
    // legacy ceiling — pages with 156-180 char descriptions must still be able
    // to use AI chat. AI-written output is capped at the 155 target below.
    metaDescription: z.string().trim().max(META_DESCRIPTION_LEGACY_MAX_LENGTH),
    selectedBlockId: blockIdSchema.nullable().optional(),
    content: pageContentSchema,
    publishReadiness: z
      .object({
        blockers: z.array(z.string().trim().max(240)).max(20),
        warnings: z.array(z.string().trim().max(240)).max(20),
        opportunities: z.array(z.string().trim().max(240)).max(20),
      })
      .strict(),
  })
  .strict();

export const pageBuilderAiChatRequestSchema = z
  .object({
    messages: z.array(pageBuilderAiChatMessageSchema).min(1).max(16),
    context: pageBuilderAiContextSchema,
  })
  .strict();

const pageBuilderAiToolCallSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    input: z.unknown(),
  })
  .strict();

export const PAGE_BUILDER_AI_MESSAGE_MAX_CHARS = 6000;
const PAGE_BUILDER_AI_MAX_TOOL_CALLS = 20;

export const pageBuilderAiChatResponseSchema = z
  .object({
    message: z.string().trim().max(PAGE_BUILDER_AI_MESSAGE_MAX_CHARS),
    toolCalls: z
      .array(pageBuilderAiToolCallSchema)
      .max(PAGE_BUILDER_AI_MAX_TOOL_CALLS),
    source: z.enum(["model", "intent-fallback"]).optional(),
  })
  .strict();

export type PageBuilderAiContext = z.infer<typeof pageBuilderAiContextSchema>;
export type PageBuilderAiChatRequest = z.infer<
  typeof pageBuilderAiChatRequestSchema
>;
export type PageBuilderAiToolCall = z.infer<typeof pageBuilderAiToolCallSchema>;
export type PageBuilderAiChatResponse = z.infer<
  typeof pageBuilderAiChatResponseSchema
>;

export type PageBuilderAiSeoPatch = Partial<{
  title: string;
  slug: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
}>;

export type PageBuilderAiToolResult = {
  status: "applied" | "queued" | "failed";
  toolName: string;
  message: string;
  blockId?: string;
};

export type PageBuilderAiPendingDelete = {
  blockId: string;
  blockLabel: string;
  reason: string;
};

export type PageBuilderAiClarification = {
  options: string[];
};

export type PageBuilderAiApplyResult = {
  content: PageContent;
  seoPatch: PageBuilderAiSeoPatch;
  results: PageBuilderAiToolResult[];
  pendingDelete: PageBuilderAiPendingDelete | null;
  clarification: PageBuilderAiClarification | null;
  highlightedBlockIds: string[];
};

export type ApplyOptions = {
  content: PageContent;
  toolCalls: PageBuilderAiToolCall[];
  makeBlockId: () => string;
};

export type BlockToolSpec = {
  name: string;
  blockId: string;
  label: string;
  block: PageBlock;
};

export const richTextBodyInputSchema = z
  .object({
    eyebrow: nullableText(80),
    heading: nullableText(180),
    body: nullableText(2000),
    bulletItems: z
      .array(z.string().trim().max(300))
      .max(12)
      .nullable()
      .optional(),
  })
  .strict();

export const heroInputSchema = z
  .object({
    eyebrow: nullableText(80),
    headline: nullableText(180),
    body: nullableText(500),
    ctaLabel: nullableText(80),
    ctaHref: nullableText(500),
  })
  .strict();

export const faqInputSchema = z
  .object({
    heading: nullableText(160),
    items: z
      .array(
        z
          .object({
            question: z.string().trim().max(240),
            answer: z.string().trim().max(1200),
          })
          .strict(),
      )
      .max(12)
      .nullable()
      .optional(),
  })
  .strict();

export const cardGridInputSchema = z
  .object({
    heading: nullableText(160),
    cards: z
      .array(
        z
          .object({
            title: z.string().trim().max(140),
            body: z.string().trim().max(500),
            href: nullableText(500),
            linkLabel: nullableText(80),
          })
          .strict(),
      )
      .max(12)
      .nullable()
      .optional(),
  })
  .strict();

export const ctaInputSchema = z
  .object({
    label: nullableText(80),
    href: nullableText(500),
  })
  .strict();

export const proofInputSchema = z
  .object({
    eyebrow: nullableText(80),
    body: nullableText(800),
    name: nullableText(120),
    context: nullableText(160),
  })
  .strict();

export const leadFormInputSchema = z
  .object({
    heading: nullableText(160),
    body: nullableText(500),
    submitLabel: nullableText(80),
  })
  .strict();

export const mediaInputSchema = z
  .object({
    title: nullableText(140),
    url: nullableText(500),
    altText: nullableText(180),
    caption: nullableText(240),
  })
  .strict();

const nullableSafeImageSource = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.length === 0 || isAiSafeImageSource(value), {
    message: "Use an internal image path or an approved remote image URL.",
  })
  .nullable()
  .optional();

const nullableSafeMediaSource = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.length === 0 || isAiSafeMediaSource(value), {
    message: "Use an internal media path or an http(s) URL.",
  })
  .nullable()
  .optional();

export const addBlockInputSchema = z
  .object({
    blockType: z.enum([
      "hero",
      "rich_text",
      "faq",
      "card_grid",
      "cta",
      "proof",
      "lead_form",
    ]),
    title: nullableText(180),
    body: nullableText(2000),
    bulletItems: z
      .array(z.string().trim().max(300))
      .max(12)
      .nullable()
      .optional(),
    faqItems: z
      .array(
        z
          .object({
            question: z.string().trim().max(240),
            answer: z.string().trim().max(1200),
          })
          .strict(),
      )
      .max(12)
      .nullable()
      .optional(),
    cards: z
      .array(
        z
          .object({
            title: z.string().trim().max(140),
            body: z.string().trim().max(500),
            href: nullableText(500),
            linkLabel: nullableText(80),
          })
          .strict(),
      )
      .max(12)
      .nullable()
      .optional(),
    ctaLabel: nullableText(80),
    ctaHref: nullableText(500),
  })
  .strict();

export type AiAddBlockType = z.infer<typeof addBlockInputSchema>["blockType"];

export const addImageTextSectionInputSchema = z
  .object({
    heading: nullableText(180),
    body: nullableText(2000),
    bulletItems: z
      .array(z.string().trim().max(300))
      .max(12)
      .nullable()
      .optional(),
    imageUrl: nullableSafeImageSource,
    imageAltText: nullableText(180),
    imageCaption: nullableText(240),
    sourceRightsNotes: nullableText(500),
    imagePosition: z.enum(["left", "right"]).default("right"),
  })
  .strict();

export const addMediaBlockInputSchema = z
  .object({
    mediaType: z.enum(["image", "video"]),
    title: nullableText(140),
    url: nullableSafeMediaSource,
    altText: nullableText(180),
    caption: nullableText(240),
    sourceRightsNotes: nullableText(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const url = value.url?.trim() ?? "";
    if (!url) return;
    if (value.mediaType === "image" && !isAiSafeImageSource(url)) {
      ctx.addIssue({
        code: "custom",
        message: "Use an internal image path or an approved remote image URL.",
        path: ["url"],
      });
    }
  });

export const replacePageSectionsInputSchema = z
  .object({
    replaceExisting: z.boolean().optional().default(false),
    sections: z
      .array(
        z
          .object({
            title: nullableText(180),
            blocks: z.array(addBlockInputSchema).min(1).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const setSeoMetadataInputSchema = z
  .object({
    title: nullableText(180),
    slug: nullableText(120),
    targetKeyword: nullableText(180),
    seoTitle: nullableText(80),
    metaDescription: nullableText(META_DESCRIPTION_MAX_LENGTH),
  })
  .strict();

export const seoMetadataInputLimits = {
  title: 180,
  slug: 120,
  targetKeyword: 180,
  seoTitle: 80,
  metaDescription: META_DESCRIPTION_MAX_LENGTH,
} as const;

export const reorderBlocksInputSchema = z
  .object({
    blockIds: z.array(blockIdSchema).min(1).max(80),
  })
  .strict();

export const deleteBlockInputSchema = z
  .object({
    blockId: blockIdSchema,
    reason: z.string().trim().max(240).nullable().optional(),
  })
  .strict();

export const requestClarificationInputSchema = z
  .object({
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
  })
  .strict();
