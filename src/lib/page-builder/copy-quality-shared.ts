import { richTextDocumentPlainText, type PageBlock } from "./blocks";

export type SeoCopyQualityScope = "page" | "fragment";

export type SeoCopyQualityFinding = {
  code: string;
  // "fail" means the copy violates a hard standard (thin); "warn" is advisory.
  severity: "fail" | "warn";
  blockId: string | null;
  message: string;
  evidence?: string;
};

export function fail(
  code: string,
  blockId: string | null,
  message: string,
  evidence?: string,
): SeoCopyQualityFinding {
  return { code, severity: "fail", blockId, message, evidence };
}

export function warn(
  code: string,
  blockId: string | null,
  message: string,
  evidence?: string,
): SeoCopyQualityFinding {
  return { code, severity: "warn", blockId, message, evidence };
}

export function wordCount(value: string | null | undefined): number {
  return (value ?? "").split(/\s+/).filter(Boolean).length;
}

export function sentenceCount(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

// Body copy used for duplicate/opener checks — running prose only.
export function bodyCopyForBlock(block: PageBlock): string[] {
  if (block.type === "hero") return [block.props.body];
  if (block.type === "rich_text") {
    return [richTextDocumentPlainText(block.props.body)];
  }
  if (block.type === "card_grid") {
    return block.props.cards.map((card) => card.body);
  }
  if (block.type === "faq") return block.props.items.map((item) => item.answer);
  return [];
}

export function visibleTextForBlock(block: PageBlock): string[] {
  if (block.type === "hero") {
    return [block.props.eyebrow, block.props.heading, block.props.body];
  }
  if (block.type === "rich_text") {
    return [
      block.props.eyebrow,
      block.props.heading,
      richTextDocumentPlainText(block.props.body),
    ];
  }
  if (block.type === "faq") {
    return [
      block.props.heading,
      ...block.props.items.flatMap((item) => [item.question, item.answer]),
    ];
  }
  if (block.type === "card_grid") {
    return [
      block.props.heading,
      ...block.props.cards.flatMap((card) => [card.title, card.body]),
    ];
  }
  if (block.type === "cta") return [block.props.label];
  if (block.type === "lead_form") {
    return [block.props.heading, block.props.body];
  }
  if (block.type === "proof") {
    return [block.props.eyebrow, block.props.body, block.props.name];
  }
  if (block.type === "video") return [block.props.title, block.props.caption];
  if (block.type === "image") {
    return [block.props.altText, block.props.caption];
  }
  return [];
}
