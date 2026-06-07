import { z } from "zod";
import { ctaBlockDescriptor } from "@/lib/page-builder/block-descriptors";
import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";

export type PageBuilderValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type PageInternalLink = {
  blockIndex: number;
  href: string;
  path: string;
  label: string;
};

export type PagePublishMeta = {
  slug: string | null | undefined;
  title: string | null | undefined;
  seoTitle: string | null | undefined;
  metaDescription: string | null | undefined;
  canonicalUrl?: string | null | undefined;
  noindex: boolean;
  sitemapEnabled: boolean;
};

export const CARD_GRID_MAX_CARDS = 12;
export const FAQ_MAX_ITEMS = 12;

const blockIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{1,79}$/, "Use a stable block id.");

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120, "Slug is too long.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must use lowercase letters, numbers, and hyphens.",
  );

const safeInternalPathSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Use a root-relative path.",
  });

const safeHrefSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || isSafeHref(value), {
    message: "Use an internal path or an http(s) URL.",
  });

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value ?? "");

const blockFieldVisibilitySchema = z
  .object({
    eyebrow: z.boolean().optional(),
    heading: z.boolean().optional(),
    body: z.boolean().optional(),
    cta: z.boolean().optional(),
    mediaCaption: z.boolean().optional(),
    caption: z.boolean().optional(),
    title: z.boolean().optional(),
    name: z.boolean().optional(),
    context: z.boolean().optional(),
  })
  .strict()
  .optional();

const richTextSpanSchema = z
  .object({
    text: z.string().max(1000),
    href: safeHrefSchema.optional(),
  })
  .strict();

const richTextNodeSchema = z.union([
  z
    .object({
      type: z.literal("paragraph"),
      text: z.string().trim().max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("paragraph"),
      spans: z.array(richTextSpanSchema).max(40),
    })
    .strict(),
  z
    .object({
      type: z.literal("heading"),
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      text: z.string().trim().max(180),
    })
    .strict(),
  z
    .object({
      type: z.literal("list"),
      style: z.enum(["bullet", "numbered"]).default("bullet"),
      items: z.array(z.string().trim().max(300)).max(12),
    })
    .strict(),
]);

export const richTextDocumentSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(richTextNodeSchema).max(30),
  })
  .strict();

const richTextBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("rich_text"),
    variant: z
      .enum(["default", "intro", "compact", "checklist"])
      .default("default"),
    props: z
      .object({
        eyebrow: optionalTrimmedText(80),
        heading: optionalTrimmedText(180),
        body: richTextDocumentSchema,
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const heroBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("hero"),
    variant: z
      .enum(["standard", "split", "compact", "editorial"])
      .default("standard"),
    props: z
      .object({
        eyebrow: optionalTrimmedText(80),
        heading: z.string().trim().max(180),
        body: optionalTrimmedText(500),
        ctaLabel: optionalTrimmedText(80),
        ctaHref: safeHrefSchema.optional().default(""),
        ctaTrackingName: optionalTrimmedText(120),
        mediaAssetId: z.uuid().optional(),
        mediaSrc: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || isSafeMediaSource(value), {
            message: "Use an internal path or an http(s) media URL.",
          })
          .optional(),
        mediaAltText: z.string().trim().max(180).optional(),
        mediaCaption: z.string().trim().max(240).optional(),
        proofText: z.string().trim().max(240).optional(),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const imageBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("image"),
    variant: z
      .enum(["standard", "wide", "inline", "feature"])
      .default("standard"),
    props: z
      .object({
        assetId: z.uuid().optional(),
        src: z
          .string()
          .trim()
          .optional()
          .transform((value) => value ?? "")
          .refine((value) => value.length === 0 || isSafeMediaSource(value), {
            message: "Use an internal path or an http(s) media URL.",
          }),
        altText: optionalTrimmedText(180),
        caption: optionalTrimmedText(240),
        sourceRightsNotes: optionalTrimmedText(500),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict()
      .refine((props) => Boolean(props.assetId || props.src), {
        message: "Image block needs an asset or source path.",
        path: ["src"],
      }),
  })
  .strict();

const videoBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("video"),
    variant: z.enum(["standard", "wide", "inline"]).default("standard"),
    props: z
      .object({
        assetId: z.uuid().optional(),
        title: optionalTrimmedText(140),
        url: safeHrefSchema,
        thumbnailAssetId: z.uuid().optional(),
        thumbnailSrc: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || isSafeMediaSource(value), {
            message: "Use an internal path or an http(s) media URL.",
          })
          .optional(),
        thumbnailAltText: z.string().trim().max(180).optional(),
        caption: optionalTrimmedText(240),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const ctaBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("cta"),
    variant: z.enum(["primary", "secondary", "text"]).default("primary"),
    props: z
      .object({
        presetId: z.uuid().optional(),
        label: z.string().trim().max(80),
        href: safeHrefSchema,
        trackingName: optionalTrimmedText(120),
      })
      .strict(),
  })
  .strict();

const faqBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("faq"),
    variant: z.enum(["standard", "compact", "accordion"]).default("standard"),
    props: z
      .object({
        heading: optionalTrimmedText(160),
        items: z
          .array(
            z
              .object({
                question: z.string().trim().max(240),
                answer: z.string().trim().max(1200),
              })
              .strict(),
          )
          .max(FAQ_MAX_ITEMS),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const cardGridBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("card_grid"),
    variant: z.enum(["standard", "compact", "feature"]).default("standard"),
    props: z
      .object({
        heading: optionalTrimmedText(160),
        cards: z
          .array(
            z
              .object({
                title: z.string().trim().max(140),
                body: z.string().trim().max(500),
                href: safeHrefSchema.optional().default(""),
                linkLabel: z.string().trim().max(80).optional(),
              })
              .strict(),
          )
          .max(CARD_GRID_MAX_CARDS),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const proofBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("proof"),
    variant: z.enum(["quote", "stat", "logo"]).default("quote"),
    props: z
      .object({
        proofItemId: z.uuid().optional(),
        eyebrow: optionalTrimmedText(80),
        body: z.string().trim().max(800),
        name: optionalTrimmedText(120),
        context: optionalTrimmedText(160),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

const leadFormBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("lead_form"),
    variant: z.enum(["standard", "compact", "sidebar"]).default("standard"),
    props: z
      .object({
        heading: optionalTrimmedText(160),
        body: optionalTrimmedText(500),
        submitLabel: z.string().trim().max(80).default("Submit application"),
        trackingName: optionalTrimmedText(120),
        fieldVisibility: blockFieldVisibilitySchema,
      })
      .strict(),
  })
  .strict();

export const pageBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  richTextBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  ctaBlockSchema,
  faqBlockSchema,
  cardGridBlockSchema,
  proofBlockSchema,
  leadFormBlockSchema,
]);

const pageColumnSchema = z
  .object({
    id: blockIdSchema,
    width: z.enum(["1/1", "1/2", "1/3", "2/3"]).default("1/1"),
    blocks: z.array(pageBlockSchema).max(30),
  })
  .strict();

const pageSectionSchema = z
  .object({
    id: blockIdSchema,
    preset: z.enum(["standard", "narrow", "feature"]).default("standard"),
    background: z.enum(["default", "muted", "brand"]).default("default"),
    spacing: z.enum(["compact", "standard", "spacious"]).default("standard"),
    columns: z.array(pageColumnSchema).max(4),
  })
  .strict();

const pageChromeSchema = z
  .object({
    showHeader: z.boolean().default(true),
    showFooter: z.boolean().default(true),
  })
  .strict();

export const pageContentSchema = z
  .object({
    version: z.literal(1),
    chrome: pageChromeSchema.optional(),
    sections: z.array(pageSectionSchema).max(40),
  })
  .strict();

export type RichTextDocument = z.infer<typeof richTextDocumentSchema>;
export type RichTextNode = z.infer<typeof richTextNodeSchema>;
export type RichTextSpan = z.infer<typeof richTextSpanSchema>;
export type PageBlock = z.infer<typeof pageBlockSchema>;
export type PageColumn = z.infer<typeof pageColumnSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageChromeSettings = z.infer<typeof pageChromeSchema>;
export type PageContent = z.infer<typeof pageContentSchema>;
export type CardGridCard = Extract<
  PageBlock,
  { type: "card_grid" }
>["props"]["cards"][number];

const defaultPageChromeSettings: PageChromeSettings = {
  showHeader: true,
  showFooter: true,
};

export function pageChromeSettings(content: PageContent): PageChromeSettings {
  return { ...defaultPageChromeSettings, ...content.chrome };
}

export function cardGridLinkLabel(card: CardGridCard) {
  const customLabel = card.linkLabel?.trim();
  if (customLabel) return customLabel;

  const title = card.title.trim();
  if (title) return `Learn more about ${title}`;

  return "Learn more";
}

export const blockRegistry = {
  hero: {
    type: "hero",
    allowedVariants: ["standard", "split", "compact", "editorial"],
    defaultProps: {
      eyebrow: "",
      heading: "",
      body: "",
      ctaLabel: "",
      ctaHref: "",
      ctaTrackingName: "",
      mediaAssetId: undefined,
      mediaSrc: "",
      mediaAltText: "",
      mediaCaption: "",
      proofText: "",
    },
  },
  rich_text: {
    type: "rich_text",
    allowedVariants: ["default", "intro", "compact", "checklist"],
    defaultProps: {
      eyebrow: "",
      heading: "",
      body: { version: 1, nodes: [] },
    },
  },
  image: {
    type: "image",
    allowedVariants: ["standard", "wide", "inline", "feature"],
    defaultProps: {
      src: "",
      altText: "",
      caption: "",
      sourceRightsNotes: "",
    },
  },
  video: {
    type: "video",
    allowedVariants: ["standard", "wide", "inline"],
    defaultProps: {
      title: "",
      url: "",
      thumbnailSrc: "",
      thumbnailAltText: "",
      caption: "",
    },
  },
  cta: {
    type: ctaBlockDescriptor.type,
    allowedVariants: ctaBlockDescriptor.variants.map((variant) => variant.id),
    defaultProps: ctaBlockDescriptor.defaultProps,
  },
  faq: {
    type: "faq",
    allowedVariants: ["standard", "compact", "accordion"],
    defaultProps: {
      heading: "",
      items: [],
    },
  },
  card_grid: {
    type: "card_grid",
    allowedVariants: ["standard", "compact", "feature"],
    defaultProps: {
      heading: "",
      cards: [],
    },
  },
  proof: {
    type: "proof",
    allowedVariants: ["quote", "stat", "logo"],
    defaultProps: {
      proofItemId: undefined,
      eyebrow: "",
      body: "",
      name: "",
      context: "",
    },
  },
  lead_form: {
    type: "lead_form",
    allowedVariants: ["standard", "compact", "sidebar"],
    defaultProps: {
      heading: "",
      body: "",
      submitLabel: "Submit application",
      trackingName: "",
    },
  },
} as const;

export function createEmptyPageContent(): PageContent {
  return { version: 1, sections: [] };
}

export function normalizeSlug(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slugSchema.parse(slug);
}

export function validatePageContent(content: unknown) {
  const parsed = pageContentSchema.safeParse(content);
  if (parsed.success) return { ok: true as const, content: parsed.data };

  return {
    ok: false as const,
    issues: zodIssues(parsed.error, "invalid_content"),
  };
}

export function validatePageForPublish(
  content: unknown,
  meta: PagePublishMeta,
) {
  const contentResult = validatePageContent(content);
  if (!contentResult.ok) {
    return { ok: false as const, issues: contentResult.issues };
  }

  const issues: PageBuilderValidationIssue[] = [];
  const slug = String(meta.slug ?? "");
  if (!slugSchema.safeParse(slug).success) {
    issues.push({
      code: "invalid_slug",
      path: "slug",
      message: "Publish requires a valid lowercase URL slug.",
    });
  }

  if (!hasText(meta.title)) {
    issues.push({
      code: "missing_title",
      path: "title",
      message: "Publish requires a page title.",
    });
  }
  if (!hasText(meta.seoTitle)) {
    issues.push({
      code: "missing_seo_title",
      path: "seo_title",
      message: "Publish requires an SEO title.",
    });
  }
  if (!hasText(meta.metaDescription)) {
    issues.push({
      code: "missing_meta_description",
      path: "meta_description",
      message: "Publish requires a meta description.",
    });
  }
  if (meta.noindex && meta.sitemapEnabled) {
    issues.push({
      code: "sitemap_noindex_conflict",
      path: "sitemap_enabled",
      message: "Noindex pages must not be included in the sitemap.",
    });
  }
  if (meta.canonicalUrl && !isSafeHref(meta.canonicalUrl)) {
    issues.push({
      code: "invalid_canonical_url",
      path: "canonical_url",
      message: "Canonical URL must be an internal path or http(s) URL.",
    });
  }

  const blocks = flattenBlocks(contentResult.content);
  if (!blocks.some(isConversionSurface)) {
    issues.push({
      code: "missing_conversion_block",
      path: "sections",
      message:
        "Publish requires at least one CTA, visible hero CTA, or lead form block.",
    });
  }

  for (const [index, block] of blocks.entries()) {
    if (block.type === "image") {
      const usesMediaAsset = Boolean(block.props.assetId);
      if (!usesMediaAsset && !hasText(block.props.altText)) {
        issues.push({
          code: "missing_image_alt",
          path: `blocks.${index}.props.altText`,
          message: "Published image blocks require alt text.",
        });
      }
      if (!usesMediaAsset && !hasText(block.props.sourceRightsNotes)) {
        issues.push({
          code: "missing_media_rights",
          path: `blocks.${index}.props.sourceRightsNotes`,
          message: "Published media requires source and rights notes.",
        });
      }
    }

    if (block.type === "cta") {
      const usesPreset = Boolean(block.props.presetId);
      if (!usesPreset && !hasText(block.props.label)) {
        issues.push({
          code: "missing_cta_label",
          path: `blocks.${index}.props.label`,
          message: "Published CTA blocks require a label.",
        });
      }
      if (!usesPreset && !hasText(block.props.href)) {
        issues.push({
          code: "missing_cta_href",
          path: `blocks.${index}.props.href`,
          message: "Published CTA blocks require a destination.",
        });
      }
      if (!usesPreset && !hasText(block.props.trackingName)) {
        issues.push({
          code: "missing_cta_tracking",
          path: `blocks.${index}.props.trackingName`,
          message: "Published CTA blocks require a tracking name.",
        });
      }
    }

    if (block.type === "hero") {
      if (!hasText(block.props.heading)) {
        issues.push({
          code: "missing_hero_heading",
          path: `blocks.${index}.props.heading`,
          message: "Hero blocks require a heading.",
        });
      }
      if (
        block.variant === "split" &&
        !block.props.mediaAssetId &&
        !hasText(block.props.mediaSrc) &&
        !hasText(block.props.proofText)
      ) {
        issues.push({
          code: "missing_split_hero_media_or_proof",
          path: `blocks.${index}.props.mediaSrc`,
          message: "Split hero blocks require media or proof content.",
        });
      }
      if (
        block.variant === "split" &&
        (block.props.mediaAssetId || hasText(block.props.mediaSrc)) &&
        !hasText(block.props.mediaAltText)
      ) {
        issues.push({
          code: "missing_split_hero_media_alt",
          path: `blocks.${index}.props.mediaAltText`,
          message: "Split hero media requires alt text.",
        });
      }
      if (isBlockFieldVisible(block, "cta")) {
        if (!hasText(block.props.ctaLabel)) {
          issues.push({
            code: "missing_hero_cta_label",
            path: `blocks.${index}.props.ctaLabel`,
            message: "Visible hero CTAs require button text.",
          });
        }
        if (!hasText(block.props.ctaHref)) {
          issues.push({
            code: "missing_hero_cta_href",
            path: `blocks.${index}.props.ctaHref`,
            message: "Visible hero CTAs require a destination.",
          });
        }
        if (
          hasText(block.props.ctaLabel) &&
          hasText(block.props.ctaHref) &&
          !hasText(block.props.ctaTrackingName)
        ) {
          issues.push({
            code: "missing_hero_cta_tracking",
            path: `blocks.${index}.props.ctaTrackingName`,
            message: "Visible hero CTAs require a tracking name.",
          });
        }
      }
    }

    if (block.type === "video" && !hasText(block.props.url)) {
      issues.push({
        code: "missing_video_url",
        path: `blocks.${index}.props.url`,
        message: "Video blocks require a URL.",
      });
    }

    if (block.type === "faq") {
      for (const [itemIndex, item] of block.props.items.entries()) {
        if (!hasText(item.question)) {
          issues.push({
            code: "missing_faq_question",
            path: `blocks.${index}.props.items.${itemIndex}.question`,
            message: "FAQ items require a question.",
          });
        }
        if (!hasText(item.answer)) {
          issues.push({
            code: "missing_faq_answer",
            path: `blocks.${index}.props.items.${itemIndex}.answer`,
            message: "FAQ items require an answer.",
          });
        }
      }
    }

    if (block.type === "card_grid") {
      for (const [cardIndex, card] of block.props.cards.entries()) {
        if (!hasText(card.title) || !hasText(card.body)) {
          issues.push({
            code: "missing_card_grid_item",
            path: `blocks.${index}.props.cards.${cardIndex}`,
            message: "Card grid items require a title and body.",
          });
        }
      }
    }

    if (
      block.type === "proof" &&
      !block.props.proofItemId &&
      !hasText(block.props.body)
    ) {
      issues.push({
        code: "missing_proof_body",
        path: `blocks.${index}.props.body`,
        message: "Proof blocks require body text.",
      });
    }

    if (block.type === "lead_form") {
      if (
        isBlockFieldVisible(block, "heading") &&
        !hasText(block.props.heading)
      ) {
        issues.push({
          code: "missing_lead_form_heading",
          path: `blocks.${index}.props.heading`,
          message: "Visible lead form headings require text.",
        });
      }
      if (isBlockFieldVisible(block, "body") && !hasText(block.props.body)) {
        issues.push({
          code: "missing_lead_form_body",
          path: `blocks.${index}.props.body`,
          message: "Visible lead form body copy is required.",
        });
      }
      if (!hasText(block.props.submitLabel)) {
        issues.push({
          code: "missing_lead_form_submit_label",
          path: `blocks.${index}.props.submitLabel`,
          message: "Lead form blocks require submit button text.",
        });
      }
      if (!hasText(block.props.trackingName)) {
        issues.push({
          code: "missing_lead_form_tracking",
          path: `blocks.${index}.props.trackingName`,
          message: "Lead form blocks require a tracking name.",
        });
      }
    }
  }

  for (const link of collectInternalLinks(blocks)) {
    if (!isKnownInternalPath(link.href)) {
      issues.push({
        code: "broken_internal_link",
        path: link.path,
        message: "Internal links must point to an approved site route.",
      });
    }
  }

  if (issues.length > 0) return { ok: false as const, issues };
  return { ok: true as const, content: contentResult.content };
}

export function flattenBlocks(content: PageContent): PageBlock[] {
  return content.sections.flatMap((section) =>
    section.columns.flatMap((column) => column.blocks),
  );
}

export function richTextNodePlainText(node: RichTextNode) {
  if (node.type === "list") return node.items.join(" ");
  if (node.type === "paragraph" && "spans" in node) {
    return node.spans.map((span) => span.text).join("");
  }
  return node.text;
}

export function richTextDocumentPlainText(document: RichTextDocument) {
  return document.nodes.map(richTextNodePlainText).join(" ");
}

export function collectPageInternalLinks(content: PageContent) {
  return collectInternalLinks(flattenBlocks(content));
}

export function resourcePathForSlug(slug: string) {
  return `/resources/${normalizeSlug(slug)}`;
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isConversionSurface(block: PageBlock) {
  return (
    block.type === "cta" ||
    block.type === "lead_form" ||
    (block.type === "hero" && isBlockFieldVisible(block, "cta"))
  );
}

function isSafeHref(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeMediaSource(value: string) {
  return safeInternalPathSchema.safeParse(value).success || isSafeHref(value);
}

function collectInternalLinks(blocks: PageBlock[]): PageInternalLink[] {
  const links: PageInternalLink[] = [];
  for (const [index, block] of blocks.entries()) {
    if (block.type === "cta" && block.props.href.startsWith("/")) {
      links.push({
        blockIndex: index,
        href: block.props.href,
        path: `blocks.${index}.props.href`,
        label: block.props.label,
      });
    }
    if (block.type === "hero" && block.props.ctaHref.startsWith("/")) {
      links.push({
        blockIndex: index,
        href: block.props.ctaHref,
        path: `blocks.${index}.props.ctaHref`,
        label: block.props.ctaLabel,
      });
    }
    if (block.type === "card_grid") {
      for (const [cardIndex, card] of block.props.cards.entries()) {
        if (card.href.startsWith("/")) {
          links.push({
            blockIndex: index,
            href: card.href,
            path: `blocks.${index}.props.cards.${cardIndex}.href`,
            label: card.title,
          });
        }
      }
    }
    if (block.type === "rich_text") {
      for (const [nodeIndex, node] of block.props.body.nodes.entries()) {
        if (node.type !== "paragraph" || !("spans" in node)) continue;
        for (const [spanIndex, span] of node.spans.entries()) {
          if (span.href?.startsWith("/")) {
            links.push({
              blockIndex: index,
              href: span.href,
              path: `blocks.${index}.props.body.nodes.${nodeIndex}.spans.${spanIndex}.href`,
              label: span.text,
            });
          }
        }
      }
    }
  }
  return links;
}

function isKnownInternalPath(href: string) {
  const pathname = href.split(/[?#]/)[0] || "/";
  if (pathname === "/") return true;
  return [
    "/about",
    "/apply",
    "/case-studies",
    "/contact",
    "/news",
    "/pre-call-resources",
    "/privacy",
    "/resources",
    "/terms",
    "/thank-you-for-applying",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function zodIssues(
  error: z.ZodError,
  code: string,
): PageBuilderValidationIssue[] {
  return error.issues.map((issue) => ({
    code,
    path: issue.path.join("."),
    message: issue.message,
  }));
}
