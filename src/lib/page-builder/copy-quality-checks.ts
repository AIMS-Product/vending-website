import { richTextDocumentPlainText, type PageBlock } from "./blocks";
import {
  fail,
  normalizeText,
  sentenceCount,
  visibleTextForBlock,
  warn,
  wordCount,
  type SeoCopyQualityFinding,
  type SeoCopyQualityScope,
} from "./copy-quality-shared";
import type { SeoCopyStandards } from "./copy-standards";

export function blockFindings(
  block: PageBlock,
  standards: SeoCopyStandards,
): SeoCopyQualityFinding[] {
  const findings: SeoCopyQualityFinding[] = [];

  if (block.type === "hero") {
    const words = wordCount(block.props.body);
    if (words < standards.heroBodyWords.min) {
      findings.push(
        fail(
          "thin_hero_body",
          block.id,
          `Hero body has ${words} words; needs ${standards.heroBodyWords.min}-${standards.heroBodyWords.max}.`,
        ),
      );
    } else if (words > standards.heroBodyWords.max) {
      findings.push(
        warn(
          "long_hero_body",
          block.id,
          `Hero body has ${words} words; keep it under ${standards.heroBodyWords.max}.`,
        ),
      );
    }
  }

  if (block.type === "rich_text") {
    const words = wordCount(richTextDocumentPlainText(block.props.body));
    const bullets = block.props.body.nodes.reduce(
      (count, node) => count + (node.type === "list" ? node.items.length : 0),
      0,
    );
    const passesWithBullets =
      words >= standards.richTextWithBulletsWords.min &&
      bullets >= standards.richTextMinBullets;
    if (words < standards.richTextWords.min && !passesWithBullets) {
      findings.push(
        fail(
          "thin_rich_text",
          block.id,
          `Text section has ${words} words and ${bullets} bullets; needs ${standards.richTextWords.min}+ words, or ${standards.richTextWithBulletsWords.min}+ words with ${standards.richTextMinBullets}+ bullets.`,
        ),
      );
    } else if (words > standards.richTextWords.max) {
      findings.push(
        warn(
          "long_rich_text",
          block.id,
          `Text section has ${words} words; split it under ${standards.richTextWords.max}.`,
        ),
      );
    }
  }

  if (block.type === "card_grid") {
    if (
      block.props.cards.length > 0 &&
      block.props.cards.length < standards.cardGridMinCards
    ) {
      findings.push(
        warn(
          "sparse_card_grid",
          block.id,
          `Card grid has ${block.props.cards.length} cards; aim for ${standards.cardGridMinCards}+.`,
        ),
      );
    }
    block.props.cards.forEach((card, index) => {
      const words = wordCount(card.body);
      if (words > 0 && words < standards.cardBodyWords.min) {
        findings.push(
          fail(
            "thin_card_body",
            block.id,
            `Card ${index + 1} has ${words} words; needs ${standards.cardBodyWords.min}-${standards.cardBodyWords.max}.`,
            card.title,
          ),
        );
      }
    });
  }

  if (block.type === "faq") {
    if (
      block.props.items.length > 0 &&
      block.props.items.length < standards.faqMinItems
    ) {
      findings.push(
        fail(
          "thin_faq",
          block.id,
          `FAQ has ${block.props.items.length} items; needs at least ${standards.faqMinItems}.`,
        ),
      );
    }
    block.props.items.forEach((item, index) => {
      const words = wordCount(item.answer);
      const sentences = sentenceCount(item.answer);
      if (
        words < standards.faqAnswerWords.min ||
        sentences < standards.faqAnswerMinSentences
      ) {
        findings.push(
          fail(
            "thin_faq_answer",
            block.id,
            `FAQ answer ${index + 1} has ${words} words in ${sentences} sentence(s); needs ${standards.faqAnswerWords.min}+ words across ${standards.faqAnswerMinSentences}+ sentences.`,
            item.question,
          ),
        );
      } else if (words > standards.faqAnswerWords.max) {
        findings.push(
          warn(
            "long_faq_answer",
            block.id,
            `FAQ answer ${index + 1} has ${words} words; keep it under ${standards.faqAnswerWords.max}.`,
            item.question,
          ),
        );
      }
    });
  }

  return findings;
}

export function fillerFindings(
  blocks: PageBlock[],
  standards: SeoCopyStandards,
): SeoCopyQualityFinding[] {
  const findings: SeoCopyQualityFinding[] = [];
  for (const block of blocks) {
    const text = visibleTextForBlock(block)
      .join(" ")
      .toLowerCase()
      .replace(/[‘’]/g, "'");
    for (const phrase of standards.fillerPhrases) {
      if (text.includes(phrase)) {
        findings.push(
          fail(
            "filler_phrase",
            block.id,
            `Replace the filler phrase "${phrase}" with a concrete, specific benefit.`,
          ),
        );
      }
    }
  }
  return findings;
}

export function duplicateFindings(
  bodyTexts: { blockId: string; text: string }[],
): SeoCopyQualityFinding[] {
  const findings: SeoCopyQualityFinding[] = [];
  const seen = new Map<string, string>();
  for (const { blockId, text } of bodyTexts) {
    const normalized = normalizeText(text);
    if (wordCount(normalized) < 8) continue;
    const firstBlockId = seen.get(normalized);
    if (firstBlockId && firstBlockId !== blockId) {
      findings.push(
        fail(
          "duplicated_copy",
          blockId,
          `Body copy duplicates block ${firstBlockId}; every block needs distinct copy.`,
        ),
      );
    } else {
      seen.set(normalized, blockId);
    }
  }
  return findings;
}

export function repeatedOpenerFindings(
  bodyTexts: { blockId: string; text: string }[],
  standards: SeoCopyStandards,
): SeoCopyQualityFinding[] {
  const sentences = bodyTexts.flatMap(({ text }) =>
    text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => wordCount(sentence) >= 3),
  );
  if (sentences.length < 6) return [];
  const openers = new Map<string, number>();
  for (const sentence of sentences) {
    const first = normalizeText(sentence).split(" ")[0];
    if (!first) continue;
    openers.set(first, (openers.get(first) ?? 0) + 1);
  }
  const worst = [...openers.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] > standards.maxRepeatedSentenceOpeners) {
    return [
      warn(
        "repetitive_sentence_openers",
        null,
        `${worst[1]} sentences start with "${worst[0]}"; vary sentence openings.`,
      ),
    ];
  }
  return [];
}

export function keywordFindings(
  blocks: PageBlock[],
  keyword: string,
  exactKeywordCount: number,
  visibleWordCount: number,
  scope: SeoCopyQualityScope,
  standards: SeoCopyStandards,
): SeoCopyQualityFinding[] {
  const findings: SeoCopyQualityFinding[] = [];
  if (scope === "page" && exactKeywordCount === 0) {
    findings.push(
      fail(
        "keyword_absent",
        null,
        "The exact target keyword does not appear in any visible copy.",
      ),
    );
  }
  if (scope === "page") {
    const hero = blocks.find((block) => block.type === "hero");
    if (
      hero &&
      !normalizeText(visibleTextForBlock(hero).join(" ")).includes(keyword)
    ) {
      findings.push(
        warn(
          "keyword_missing_from_hero",
          hero.id,
          "Use the exact target keyword naturally in the hero heading or body.",
        ),
      );
    }
  }
  if (
    exactKeywordCount >= 3 &&
    visibleWordCount > 0 &&
    (exactKeywordCount / visibleWordCount) * 100 >
      standards.maxExactKeywordPer100Words
  ) {
    findings.push(
      fail(
        "keyword_stuffing",
        null,
        `The exact target keyword appears ${exactKeywordCount} times in ${visibleWordCount} words; keep it at or under ${standards.maxExactKeywordPer100Words} per 100 words.`,
      ),
    );
  }
  return findings;
}
