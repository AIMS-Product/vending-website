import { flattenBlocks, type PageContent } from "./blocks";
import {
  blockFindings,
  duplicateFindings,
  fillerFindings,
  keywordFindings,
  repeatedOpenerFindings,
} from "./copy-quality-checks";
import {
  bodyCopyForBlock,
  countOccurrences,
  normalizeText,
  visibleTextForBlock,
  wordCount,
  type SeoCopyQualityFinding,
  type SeoCopyQualityScope,
} from "./copy-quality-shared";
import { SEO_COPY_STANDARDS, type SeoCopyStandards } from "./copy-standards";

export type {
  SeoCopyQualityFinding,
  SeoCopyQualityScope,
} from "./copy-quality-shared";

export type SeoCopyQualityAssessment = {
  verdict: "pass" | "thin";
  findings: SeoCopyQualityFinding[];
  metrics: {
    visibleWordCount: number;
    substantiveSectionCount: number;
    faqItemCount: number;
    exactKeywordCount: number;
  };
};

type AssessOptions = {
  targetKeyword?: string | null;
  // "page" applies whole-draft minimums; "fragment" checks only the blocks
  // present (use for single-block edits and additions).
  scope?: SeoCopyQualityScope;
  standards?: SeoCopyStandards;
};

// Deterministic gate verifying content against SEO_COPY_STANDARDS — the same
// constants that generate the AI prompt rules (seoCopyPromptRules). A "thin"
// verdict means at least one hard standard failed.
export function assessSeoCopyQuality(
  content: PageContent,
  options: AssessOptions = {},
): SeoCopyQualityAssessment {
  const standards = options.standards ?? SEO_COPY_STANDARDS;
  const scope = options.scope ?? "page";
  const blocks = flattenBlocks(content);
  const findings: SeoCopyQualityFinding[] = [];
  const bodyTexts = blocks.flatMap((block) =>
    bodyCopyForBlock(block).map((text) => ({ blockId: block.id, text })),
  );

  for (const block of blocks) {
    findings.push(...blockFindings(block, standards));
  }
  findings.push(...fillerFindings(blocks, standards));
  findings.push(...duplicateFindings(bodyTexts));
  findings.push(...repeatedOpenerFindings(bodyTexts, standards));

  const visibleText = blocks.flatMap(visibleTextForBlock).join(" ");
  const visibleWordCount = wordCount(visibleText);
  const substantiveSectionCount = blocks.filter((block) =>
    ["rich_text", "card_grid", "faq"].includes(block.type),
  ).length;
  const faqItemCount = blocks
    .filter((block) => block.type === "faq")
    .reduce((count, block) => count + block.props.items.length, 0);

  const keyword = normalizeText(options.targetKeyword ?? "");
  const exactKeywordCount = keyword
    ? countOccurrences(normalizeText(visibleText), keyword)
    : 0;
  if (keyword) {
    findings.push(
      ...keywordFindings(
        blocks,
        keyword,
        exactKeywordCount,
        visibleWordCount,
        scope,
        standards,
      ),
    );
  }

  if (scope === "page") {
    if (visibleWordCount < standards.pageMinVisibleWords) {
      findings.push({
        code: "thin_page_copy",
        severity: "fail",
        blockId: null,
        message: `Page has ${visibleWordCount} visible words; complete drafts need at least ${standards.pageMinVisibleWords}.`,
      });
    }
    if (substantiveSectionCount < standards.pageMinSubstantiveSections) {
      findings.push({
        code: "shallow_structure",
        severity: "fail",
        blockId: null,
        message: `Page has ${substantiveSectionCount} substantive sections (rich_text, card grid, FAQ); needs at least ${standards.pageMinSubstantiveSections}.`,
      });
    }
  }

  return {
    verdict: findings.some((finding) => finding.severity === "fail")
      ? "thin"
      : "pass",
    findings,
    metrics: {
      visibleWordCount,
      substantiveSectionCount,
      faqItemCount,
      exactKeywordCount,
    },
  };
}
