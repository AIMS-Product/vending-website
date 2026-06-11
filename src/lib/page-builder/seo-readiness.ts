import {
  flattenBlocks,
  richTextNodePlainText,
  validatePageContent,
  validatePageForPublish,
  type PageBlock,
  type PageContent,
  type PagePublishMeta,
} from "./blocks";
import { assessSeoCopyQuality } from "./copy-quality";
import { SEO_COPY_STANDARDS } from "./copy-standards";
import {
  parseStructuredDataSettings,
  type StructuredDataSettings,
} from "./structured-data-settings";

// Copy-quality gate findings surfaced through the readiness panel. Hard
// failures become warnings (publish stays possible), advisories become
// opportunities. Page-level codes already covered by readiness checks are
// dropped to avoid double-reporting.
const duplicateCopyQualityCodes = new Set(["thin_page_copy", "keyword_absent"]);

function copyQualityFindings(
  content: PageContent,
  targetKeyword: string | null | undefined,
): SeoReadinessFinding[] {
  return assessSeoCopyQuality(content, { targetKeyword, scope: "page" })
    .findings.filter((finding) => !duplicateCopyQualityCodes.has(finding.code))
    .map((finding) => ({
      code: finding.code,
      category: "content" as const,
      severity:
        finding.severity === "fail"
          ? ("warning" as const)
          : ("opportunity" as const),
      path: finding.blockId ?? "sections",
      message: finding.message,
      evidence: finding.evidence,
    }));
}

export type SeoReadinessCategory =
  | "indexing"
  | "serp"
  | "content"
  | "schema"
  | "links"
  | "media"
  | "conversion"
  | "trust";

export type SeoReadinessSeverity = "blocker" | "warning" | "opportunity";

export type SeoReadinessStatus =
  | "blocked"
  | "needs_work"
  | "opportunities"
  | "strong";

export type SeoReadinessFinding = {
  code: string;
  category: SeoReadinessCategory;
  severity: SeoReadinessSeverity;
  path: string;
  message: string;
  evidence?: string;
};

export type SeoReadinessCategorySummary = {
  category: SeoReadinessCategory;
  label: string;
  status: SeoReadinessStatus;
  findings: SeoReadinessFinding[];
};

export type SeoReadinessSummary = {
  status: SeoReadinessStatus;
  label: string;
  blockers: SeoReadinessFinding[];
  warnings: SeoReadinessFinding[];
  opportunities: SeoReadinessFinding[];
  categories: SeoReadinessCategorySummary[];
  evidence: string[];
  metrics: {
    visibleWordCount: number;
    blockCount: number;
    internalLinkCount: number;
    imageCount: number;
    faqItemCount: number;
  };
};

export type SeoReadinessMeta = PagePublishMeta & {
  targetKeyword?: string | null | undefined;
  structuredDataSettings?: StructuredDataSettings | unknown;
};

const categoryLabels: Record<SeoReadinessCategory, string> = {
  indexing: "Indexing",
  serp: "SERP",
  content: "Content",
  schema: "Schema",
  links: "Links",
  media: "Media",
  conversion: "Conversion",
  trust: "Trust",
};

const categoryOrder: SeoReadinessCategory[] = [
  "indexing",
  "serp",
  "content",
  "schema",
  "links",
  "media",
  "conversion",
  "trust",
];

export function assessSeoReadiness(
  content: unknown,
  meta: SeoReadinessMeta,
): SeoReadinessSummary {
  const contentResult = validatePageContent(content);
  const publishValidation = validatePageForPublish(content, meta);
  const findings: SeoReadinessFinding[] = [];

  if (!publishValidation.ok) {
    findings.push(
      ...publishValidation.issues.map((issue) => ({
        code: issue.code,
        category: categoryForIssue(issue.code),
        severity: "blocker" as const,
        path: issue.path,
        message: issue.message,
        evidence: evidenceForIssue(issue.code, issue.path),
      })),
    );
  }

  const parsedContent = contentResult.ok ? contentResult.content : null;
  const blocks = parsedContent ? flattenBlocks(parsedContent) : [];
  const structuredDataSettings = parseStructuredDataSettings(
    meta.structuredDataSettings,
  );
  const visibleText = parsedContent ? collectVisibleText(parsedContent) : "";
  const metrics = {
    visibleWordCount: wordCount(visibleText),
    blockCount: blocks.length,
    internalLinkCount: countInternalLinks(blocks),
    imageCount: blocks.filter((block) => block.type === "image").length,
    faqItemCount: blocks
      .filter((block) => block.type === "faq")
      .reduce((count, block) => count + block.props.items.length, 0),
  };

  findings.push(...completionFindings(blocks));
  findings.push(
    ...softFindings(meta, visibleText, blocks, metrics, structuredDataSettings),
  );
  if (parsedContent) {
    findings.push(...copyQualityFindings(parsedContent, meta.targetKeyword));
  }

  const blockers = findings.filter((finding) => finding.severity === "blocker");
  const warnings = findings.filter((finding) => finding.severity === "warning");
  const opportunities = findings.filter(
    (finding) => finding.severity === "opportunity",
  );
  const status = statusFromCounts(
    blockers.length,
    warnings.length,
    opportunities.length,
  );

  return {
    status,
    label: labelForStatus(status),
    blockers,
    warnings,
    opportunities,
    categories: buildCategories(findings),
    evidence: evidenceForState(
      parsedContent,
      meta,
      metrics,
      structuredDataSettings,
    ),
    metrics,
  };
}

function softFindings(
  meta: SeoReadinessMeta,
  visibleText: string,
  blocks: PageBlock[],
  metrics: SeoReadinessSummary["metrics"],
  structuredDataSettings: StructuredDataSettings,
): SeoReadinessFinding[] {
  const findings: SeoReadinessFinding[] = [];
  const keyword = normalizeText(meta.targetKeyword ?? "");

  if (!keyword) {
    findings.push({
      code: "missing_target_keyword",
      category: "serp",
      severity: "warning",
      path: "target_keyword",
      message: "Add the target keyword so the editor can judge search intent.",
      evidence: "Keyword alignment checks need a target phrase.",
    });
  } else {
    const visible = normalizeText(
      [meta.title, meta.seoTitle, meta.metaDescription, visibleText].join(" "),
    );
    const titleText = normalizeText([meta.title, meta.seoTitle].join(" "));
    const descriptionText = normalizeText(meta.metaDescription ?? "");

    if (!titleText.includes(keyword)) {
      findings.push({
        code: "target_keyword_missing_from_title",
        category: "serp",
        severity: "warning",
        path: "seo_title",
        message: "Use the target keyword naturally in the page or SEO title.",
        evidence: `Target keyword: ${meta.targetKeyword}`,
      });
    }

    if (!descriptionText.includes(keyword)) {
      findings.push({
        code: "target_keyword_missing_from_meta",
        category: "serp",
        severity: "opportunity",
        path: "meta_description",
        message:
          "Work the target keyword into the meta description if it fits.",
        evidence: `Target keyword: ${meta.targetKeyword}`,
      });
    }

    if (!visible.includes(keyword)) {
      findings.push({
        code: "target_keyword_missing_from_visible_copy",
        category: "content",
        severity: "warning",
        path: "sections",
        message: "Use the target keyword naturally in the visible page copy.",
        evidence: `Target keyword: ${meta.targetKeyword}`,
      });
    }
  }

  if ((meta.seoTitle ?? "").trim().length > 70) {
    findings.push({
      code: "seo_title_may_truncate",
      category: "serp",
      severity: "warning",
      path: "seo_title",
      message: "Shorten the SEO title so the main offer stays visible.",
      evidence: `${(meta.seoTitle ?? "").trim().length} characters`,
    });
  }

  const metaLength = (meta.metaDescription ?? "").trim().length;
  if (metaLength > 0 && metaLength < 80) {
    findings.push({
      code: "meta_description_too_light",
      category: "serp",
      severity: "opportunity",
      path: "meta_description",
      message: "Add a fuller one-to-two sentence summary for search snippets.",
      evidence: `${metaLength} characters`,
    });
  }
  if (metaLength > 160) {
    findings.push({
      code: "meta_description_may_truncate",
      category: "serp",
      severity: "warning",
      path: "meta_description",
      message: "Tighten the meta description so the main promise is concise.",
      evidence: `${metaLength} characters`,
    });
  }

  if (
    metrics.visibleWordCount > 0 &&
    metrics.visibleWordCount < SEO_COPY_STANDARDS.pageMinVisibleWords
  ) {
    findings.push({
      code: "content_depth_light",
      category: "content",
      severity: "warning",
      path: "sections",
      message:
        "Add more useful detail before treating this as a strong SEO page.",
      evidence: `${metrics.visibleWordCount} visible words`,
    });
  }

  if (!hasRichSubheading(blocks)) {
    findings.push({
      code: "missing_supporting_subsections",
      category: "content",
      severity: "opportunity",
      path: "sections",
      message:
        "Add supporting subsections so the page answers the topic clearly.",
      evidence: "No rich-text H2/H3-style subsections detected.",
    });
  }

  if (metrics.internalLinkCount === 0) {
    findings.push({
      code: "missing_internal_links",
      category: "links",
      severity: "opportunity",
      path: "sections",
      message:
        "Add relevant internal links once link suggestions are available.",
      evidence:
        "No visible internal links detected in CTA, hero, or card blocks.",
    });
  }

  if (metrics.faqItemCount === 0 && structuredDataSettings.faq) {
    findings.push({
      code: "missing_faq_opportunity",
      category: "schema",
      severity: "opportunity",
      path: "sections",
      message:
        "Consider adding visible FAQs if searchers have common objections.",
      evidence: "FAQ schema is generated only from visible FAQ blocks.",
    });
  }

  if (metrics.imageCount === 0) {
    findings.push({
      code: "missing_relevant_image",
      category: "media",
      severity: "opportunity",
      path: "sections",
      message: "Consider adding a relevant image with descriptive alt text.",
      evidence: "No image blocks detected.",
    });
  }

  return findings;
}

function completionFindings(blocks: PageBlock[]): SeoReadinessFinding[] {
  const findings: SeoReadinessFinding[] = [];

  for (const [blockIndex, block] of blocks.entries()) {
    const blockNumber = blockIndex + 1;

    if (block.type === "card_grid") {
      if (block.props.cards.length === 0) {
        findings.push({
          code: "empty_card_grid",
          category: "content",
          severity: "warning",
          path: `blocks.${blockIndex}.props.cards`,
          message: `Card grid block ${blockNumber} has no cards.`,
          evidence: "Add at least one card or remove the block.",
        });
      }

      for (const [cardIndex, card] of block.props.cards.entries()) {
        const cardNumber = cardIndex + 1;
        if (!hasText(card.title)) {
          findings.push({
            code: "incomplete_card_title",
            category: "content",
            severity: "warning",
            path: `blocks.${blockIndex}.props.cards.${cardIndex}.title`,
            message: `Card ${cardNumber} in block ${blockNumber} needs a title.`,
            evidence: "Card grid cards should not publish with blank headings.",
          });
        }
        if (!hasText(card.body)) {
          findings.push({
            code: "incomplete_card_body",
            category: "content",
            severity: "warning",
            path: `blocks.${blockIndex}.props.cards.${cardIndex}.body`,
            message: `Card ${cardNumber} in block ${blockNumber} needs body copy.`,
            evidence: "Add a short explanation or remove the card.",
          });
        }
        if (!hasText(card.href)) {
          findings.push({
            code: "missing_card_link",
            category: "conversion",
            severity: "opportunity",
            path: `blocks.${blockIndex}.props.cards.${cardIndex}.href`,
            message: `Card ${cardNumber} in block ${blockNumber} has no link.`,
            evidence: "Add a destination if this card should drive action.",
          });
        }
      }
    }

    if (block.type === "faq") {
      if (block.props.items.length === 0) {
        findings.push({
          code: "empty_faq_block",
          category: "schema",
          severity: "warning",
          path: `blocks.${blockIndex}.props.items`,
          message: `FAQ block ${blockNumber} has no questions.`,
          evidence: "Add at least one question and answer or remove the block.",
        });
      }

      for (const [itemIndex, item] of block.props.items.entries()) {
        const itemNumber = itemIndex + 1;
        if (!hasText(item.question)) {
          findings.push({
            code: "incomplete_faq_question",
            category: "schema",
            severity: "warning",
            path: `blocks.${blockIndex}.props.items.${itemIndex}.question`,
            message: `FAQ ${itemNumber} in block ${blockNumber} needs a question.`,
            evidence: "Visible FAQ schema should come from complete FAQs.",
          });
        }
        if (!hasText(item.answer)) {
          findings.push({
            code: "incomplete_faq_answer",
            category: "schema",
            severity: "warning",
            path: `blocks.${blockIndex}.props.items.${itemIndex}.answer`,
            message: `FAQ ${itemNumber} in block ${blockNumber} needs an answer.`,
            evidence: "Visible FAQ schema should come from complete FAQs.",
          });
        }
      }
    }

    if (block.type === "image") {
      if (!hasText(block.props.src) && !block.props.assetId) {
        findings.push({
          code: "empty_image_source",
          category: "media",
          severity: "warning",
          path: `blocks.${blockIndex}.props.src`,
          message: `Image block ${blockNumber} has no image selected.`,
          evidence: "Choose a media asset or remove the image block.",
        });
      }
      if (!hasText(block.props.altText)) {
        findings.push({
          code: "empty_image_alt_text",
          category: "media",
          severity: "warning",
          path: `blocks.${blockIndex}.props.altText`,
          message: `Image block ${blockNumber} needs descriptive alt text.`,
          evidence: "Alt text helps accessibility and image search context.",
        });
      }
    }

    if (block.type === "cta") {
      if (!block.props.presetId && !hasText(block.props.label)) {
        findings.push({
          code: "empty_cta_label",
          category: "conversion",
          severity: "warning",
          path: `blocks.${blockIndex}.props.label`,
          message: `CTA block ${blockNumber} needs button text.`,
          evidence: "A CTA should tell visitors what action to take.",
        });
      }
      if (!block.props.presetId && !hasText(block.props.href)) {
        findings.push({
          code: "empty_cta_link",
          category: "conversion",
          severity: "warning",
          path: `blocks.${blockIndex}.props.href`,
          message: `CTA block ${blockNumber} needs a destination.`,
          evidence: "Set a URL or choose a CTA preset.",
        });
      }
    }

    if (block.type === "lead_form" && !hasText(block.props.submitLabel)) {
      findings.push({
        code: "empty_lead_form_submit_label",
        category: "conversion",
        severity: "warning",
        path: `blocks.${blockIndex}.props.submitLabel`,
        message: `Lead form block ${blockNumber} needs submit button text.`,
        evidence: "The form button should make the next step clear.",
      });
    }
  }

  return findings;
}

function buildCategories(
  findings: SeoReadinessFinding[],
): SeoReadinessCategorySummary[] {
  return categoryOrder.map((category) => {
    const categoryFindings = findings.filter(
      (finding) => finding.category === category,
    );
    const status = statusFromCounts(
      categoryFindings.filter((finding) => finding.severity === "blocker")
        .length,
      categoryFindings.filter((finding) => finding.severity === "warning")
        .length,
      categoryFindings.filter((finding) => finding.severity === "opportunity")
        .length,
    );

    return {
      category,
      label: categoryLabels[category],
      status,
      findings: categoryFindings,
    };
  });
}

function statusFromCounts(
  blockers: number,
  warnings: number,
  opportunities: number,
): SeoReadinessStatus {
  if (blockers > 0) return "blocked";
  if (warnings > 0) return "needs_work";
  if (opportunities > 0) return "opportunities";
  return "strong";
}

function labelForStatus(status: SeoReadinessStatus) {
  if (status === "blocked") return "Blocked";
  if (status === "needs_work") return "Needs work";
  if (status === "opportunities") return "Opportunities";
  return "Strong";
}

function categoryForIssue(code: string): SeoReadinessCategory {
  if (
    [
      "invalid_slug",
      "sitemap_noindex_conflict",
      "invalid_canonical_url",
    ].includes(code)
  ) {
    return "indexing";
  }
  if (
    ["missing_title", "missing_seo_title", "missing_meta_description"].includes(
      code,
    )
  ) {
    return "serp";
  }
  if (code.startsWith("missing_image") || code === "missing_media_rights") {
    return "media";
  }
  if (code === "broken_internal_link") return "links";
  if (
    code.startsWith("missing_cta") ||
    code.startsWith("missing_hero_cta") ||
    code.startsWith("missing_lead_form") ||
    code === "missing_conversion_block"
  ) {
    return "conversion";
  }
  if (code.includes("faq")) return "schema";
  if (code.includes("proof")) return "trust";
  return "content";
}

function evidenceForIssue(code: string, path: string) {
  if (code === "broken_internal_link") {
    return "Only approved internal routes are valid at publish time.";
  }
  if (code === "sitemap_noindex_conflict") {
    return "A noindex page must not be submitted in the sitemap.";
  }
  return path ? `Field: ${path}` : undefined;
}

function evidenceForState(
  content: PageContent | null,
  meta: SeoReadinessMeta,
  metrics: SeoReadinessSummary["metrics"],
  structuredDataSettings: StructuredDataSettings,
) {
  const evidence = [
    `${metrics.visibleWordCount} visible words`,
    `${metrics.blockCount} content blocks`,
    `${metrics.internalLinkCount} visible internal links`,
    `${metrics.imageCount} image blocks`,
    `${metrics.faqItemCount} FAQ items`,
  ];

  if (content) evidence.push("Block tree schema validates.");
  if (meta.canonicalUrl) evidence.push(`Canonical: ${meta.canonicalUrl}`);
  if (meta.noindex) evidence.push("Noindex is enabled.");
  if (meta.sitemapEnabled) evidence.push("Sitemap inclusion is enabled.");
  evidence.push(
    structuredDataSettings.breadcrumb
      ? "Breadcrumb structured data is enabled."
      : "Breadcrumb structured data is disabled.",
  );
  evidence.push(
    structuredDataSettings.faq
      ? "FAQ structured data is enabled for visible FAQ blocks."
      : "FAQ structured data is disabled.",
  );
  return evidence;
}

function collectVisibleText(content: PageContent) {
  const parts: string[] = [];
  for (const block of flattenBlocks(content)) {
    if (block.type === "hero") {
      const { eyebrow, heading, body, ctaLabel } = block.props;
      parts.push(eyebrow, heading, body, ctaLabel);
    }
    if (block.type === "rich_text") {
      const { eyebrow, heading, body } = block.props;
      parts.push(eyebrow, heading);
      for (const node of body.nodes) {
        parts.push(richTextNodePlainText(node));
      }
    }
    if (block.type === "image") {
      const { altText, caption } = block.props;
      parts.push(altText, caption);
    }
    if (block.type === "video") {
      const { title, caption } = block.props;
      parts.push(title, caption);
    }
    if (block.type === "cta") {
      const { label } = block.props;
      parts.push(label);
    }
    if (block.type === "faq") {
      const { heading, items } = block.props;
      parts.push(
        heading,
        ...items.flatMap((item) => [item.question, item.answer]),
      );
    }
    if (block.type === "card_grid") {
      const { heading, cards } = block.props;
      parts.push(heading, ...cards.flatMap((card) => [card.title, card.body]));
    }
    if (block.type === "proof") {
      const { eyebrow, body, name, context } = block.props;
      parts.push(eyebrow, body, name, context);
    }
    if (block.type === "lead_form") {
      const { heading, body, submitLabel } = block.props;
      parts.push(heading, body, submitLabel);
    }
  }
  return parts.filter(Boolean).join(" ");
}

function countInternalLinks(blocks: PageBlock[]) {
  let count = 0;
  for (const block of blocks) {
    if (block.type === "hero" && block.props.ctaHref.startsWith("/"))
      count += 1;
    if (block.type === "cta" && block.props.href.startsWith("/")) count += 1;
    if (block.type === "card_grid") {
      count += block.props.cards.filter((card) =>
        card.href.startsWith("/"),
      ).length;
    }
    if (block.type === "rich_text") {
      for (const node of block.props.body.nodes) {
        if (node.type !== "paragraph" || !("spans" in node)) continue;
        count += node.spans.filter((span) => span.href?.startsWith("/")).length;
      }
    }
  }
  return count;
}

function hasRichSubheading(blocks: PageBlock[]) {
  return blocks.some((block) => {
    if (block.type === "hero" || block.type === "faq") return true;
    if (block.type !== "rich_text") return false;
    if (block.props.heading.trim()) return true;
    return block.props.body.nodes.some((node) => node.type === "heading");
  });
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function wordCount(value: string) {
  return normalizeText(value).split(/\s+/).filter(Boolean).length;
}
