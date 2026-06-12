/**
 * Single source of truth for SEO copy quality standards.
 *
 * The same constants drive:
 * - the enforced-rules block appended to AI system prompts
 *   (via seoCopyPromptRules), and
 * - the deterministic gate that verifies content against them
 *   (assessSeoCopyQuality in copy-quality.ts).
 *
 * Change a threshold here and both the prompt and the gate move together.
 */
export const SEO_COPY_STANDARDS = {
  heroBodyWords: { min: 25, max: 70 },
  richTextWords: { min: 60, max: 200 },
  // A shorter rich_text body is acceptable when it carries a real bullet list.
  richTextWithBulletsWords: { min: 40 },
  richTextMinBullets: 3,
  cardBodyWords: { min: 20, max: 60 },
  cardGridMinCards: 3,
  faqMinItems: 3,
  faqAnswerWords: { min: 25, max: 110 },
  faqAnswerMinSentences: 2,
  pageMinVisibleWords: 300,
  pageMinSubstantiveSections: 2,
  maxExactKeywordPer100Words: 2,
  maxRepeatedSentenceOpeners: 3,
  // Richness expected from a complete first draft. The chat intent fallback
  // replaces model drafts that fall below this tier, so the prompt must state
  // these numbers — a model that only meets the block floors above would have
  // its draft thrown away.
  completeDraft: {
    minBlocks: 5,
    minCards: 4,
    minFaqItems: 5,
    minVisibleWords: 450,
    maxExactKeywordMentions: 5,
  },
  fillerPhrases: [
    "high-quality",
    "state of the art",
    "state-of-the-art",
    "world-class",
    "cutting-edge",
    "best-in-class",
    "elevate your",
    "unlock the power",
    "unlock your",
    "look no further",
    "game-changer",
    "game changer",
    "in today's fast-paced",
    "one-stop shop",
    "next level",
    "seamless experience",
    "revolutionize",
  ],
} as const;

/**
 * Two-tier meta description length model:
 *
 * - META_DESCRIPTION_MAX_LENGTH (155) is the target cap. It drives the editor
 *   textarea maxLength + live counter, the readiness truncation warning, the
 *   pages-list metadata-issues check, and every AI generation schema — AI
 *   writes new copy, so a hard 155 is correct there.
 * - META_DESCRIPTION_LEGACY_MAX_LENGTH (180) is the save-path validation
 *   ceiling. Pages written before the 155 cap can hold 156-180 character
 *   descriptions and must still save/publish unchanged (warn-only via
 *   readiness), so server-side save validation keeps the legacy ceiling.
 */
export const META_DESCRIPTION_MAX_LENGTH = 155;
export const META_DESCRIPTION_LEGACY_MAX_LENGTH = 180;

export type SeoCopyStandards = typeof SEO_COPY_STANDARDS;

export function seoCopyPromptRules(
  standards: SeoCopyStandards = SEO_COPY_STANDARDS,
): string {
  return [
    "Enforced copy quality gate. Generated copy is checked by an automated gate against these exact rules, and violations are flagged as thin content:",
    `- Hero body: ${standards.heroBodyWords.min}-${standards.heroBodyWords.max} words ending with a concrete reason to act.`,
    `- rich_text sections: ${standards.richTextWords.min}-${standards.richTextWords.max} words each, or at least ${standards.richTextWithBulletsWords.min} words plus a bullet list of ${standards.richTextMinBullets}+ specific items.`,
    `- Cards: ${standards.cardBodyWords.min}-${standards.cardBodyWords.max} words each, at least ${standards.cardGridMinCards} cards per grid, each covering a distinct decision or service component.`,
    `- FAQ: at least ${standards.faqMinItems} items; every answer ${standards.faqAnswerWords.min}-${standards.faqAnswerWords.max} words across ${standards.faqAnswerMinSentences}+ sentences of practical specifics (numbers, timeframes, trade-offs where the source material supports them).`,
    `- Complete first drafts must be richer than the block floors above: at least ${standards.completeDraft.minBlocks} blocks, ${standards.completeDraft.minCards}+ cards, ${standards.completeDraft.minFaqItems}+ FAQ items, and ${standards.completeDraft.minVisibleWords}+ visible words. Drafts below this are replaced with a generic fallback, so always meet it.`,
    `- Any page below ${standards.pageMinVisibleWords} visible words or ${standards.pageMinSubstantiveSections} substantive sections (rich_text, card grid, FAQ) is flagged as thin.`,
    `- Use the exact target keyword in the hero, and keep total exact-keyword mentions at or under ${standards.maxExactKeywordPer100Words} per 100 words of visible copy.`,
    `- Never use these filler phrases (the gate rejects them): ${standards.fillerPhrases.join(", ")}.`,
    "- Never duplicate the same body copy across blocks, and vary sentence openers — the gate flags repeated openings and copied sentences.",
  ].join("\n");
}
