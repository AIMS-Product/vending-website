import {
  collectPageInternalLinks,
  flattenBlocks,
  richTextNodePlainText,
  type PageContent,
  type RichTextNode,
} from "./blocks";

export type InternalLinkSuggestionTarget = {
  pageId: string;
  path: string;
  title: string;
  targetKeyword: string | null;
  headings: string[];
  summary: string;
  outgoingInternalLinks: unknown[];
};

export type InternalLinkSuggestion = {
  id: string;
  targetPageId: string;
  targetPath: string;
  targetTitle: string;
  anchorText: string;
  sourceBlockId: string;
  sourceNodeIndex: number;
  reason: string;
  confidence: number;
};

export type ApplyInternalLinkSuggestionResult =
  | { applied: true; content: PageContent; reason?: undefined }
  | { applied: false; content: PageContent; reason: string };

export type SuggestInternalLinksInput = {
  content: PageContent;
  targets: InternalLinkSuggestionTarget[];
  currentPageId?: string | null;
  currentPath?: string | null;
  maxSuggestions?: number;
};

type AnchorCandidate = {
  text: string;
  reason: string;
  confidence: number;
};

export function suggestInternalLinks({
  content,
  targets,
  currentPageId,
  currentPath,
  maxSuggestions = 5,
}: SuggestInternalLinksInput): InternalLinkSuggestion[] {
  const existingHrefs = new Set(
    collectPageInternalLinks(content).map((link) => normalizePath(link.href)),
  );
  const currentNormalizedPath = currentPath ? normalizePath(currentPath) : null;
  const suggestions: InternalLinkSuggestion[] = [];

  for (const target of targets) {
    const targetPath = normalizePath(target.path);
    if (!targetPath.startsWith("/")) continue;
    if (target.pageId === currentPageId) continue;
    if (targetPath === currentNormalizedPath) continue;
    if (existingHrefs.has(targetPath)) continue;

    const match = findTargetMatch(content, target);
    if (!match) continue;

    suggestions.push({
      id: `${match.block.id}:${match.nodeIndex}:${target.pageId}`,
      targetPageId: target.pageId,
      targetPath: target.path,
      targetTitle: target.title,
      anchorText: match.anchorText,
      sourceBlockId: match.block.id,
      sourceNodeIndex: match.nodeIndex,
      reason: match.candidate.reason,
      confidence: match.candidate.confidence,
    });
  }

  return suggestions
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, maxSuggestions);
}

function findTargetMatch(
  content: PageContent,
  target: InternalLinkSuggestionTarget,
) {
  const candidates = anchorCandidatesForTarget(target);
  if (candidates.length === 0) return null;

  for (const block of flattenBlocks(content)) {
    if (block.type !== "rich_text") continue;
    for (const [nodeIndex, node] of block.props.body.nodes.entries()) {
      if (node.type !== "paragraph") continue;
      if (paragraphHasLinkedSpans(node)) continue;
      const paragraph = richTextNodePlainText(node);
      if (!paragraph.trim()) continue;
      for (const candidate of candidates) {
        const anchorText = findAnchorText(paragraph, candidate.text);
        if (anchorText) return { block, nodeIndex, candidate, anchorText };
      }
    }
  }

  return null;
}

export function applyInternalLinkSuggestion(
  content: PageContent,
  suggestion: InternalLinkSuggestion,
): ApplyInternalLinkSuggestionResult {
  let applied = false;
  let failureReason = "Could not find the suggested block.";

  const sections = content.sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({
      ...column,
      blocks: column.blocks.map((block) => {
        if (
          block.id !== suggestion.sourceBlockId ||
          block.type !== "rich_text"
        ) {
          return block;
        }

        const node = block.props.body.nodes[suggestion.sourceNodeIndex];
        if (!node || node.type !== "paragraph") {
          failureReason = "The suggested paragraph is no longer available.";
          return block;
        }
        if (paragraphHasLinkedSpans(node)) {
          failureReason = "That paragraph already has inline links.";
          return block;
        }

        const paragraph = richTextNodePlainText(node);
        const linkedNode = linkParagraph(paragraph, suggestion);
        if (!linkedNode) {
          failureReason = "The suggested anchor text is no longer present.";
          return block;
        }

        applied = true;
        return {
          ...block,
          props: {
            ...block.props,
            body: {
              ...block.props.body,
              nodes: block.props.body.nodes.map((currentNode, nodeIndex) =>
                nodeIndex === suggestion.sourceNodeIndex
                  ? linkedNode
                  : currentNode,
              ),
            },
          },
        };
      }),
    })),
  }));

  const nextContent = { ...content, sections };
  if (!applied) return { applied: false, content, reason: failureReason };
  return { applied: true, content: nextContent };
}

function anchorCandidatesForTarget(
  target: InternalLinkSuggestionTarget,
): AnchorCandidate[] {
  const candidates: AnchorCandidate[] = [];

  if (target.targetKeyword) {
    candidates.push({
      text: target.targetKeyword,
      reason: `The visible copy mentions the target keyword for ${target.title}.`,
      confidence: 0.95,
    });
  }

  candidates.push({
    text: target.title,
    reason: `The visible copy mentions the target page title ${target.title}.`,
    confidence: 0.8,
  });

  for (const heading of target.headings) {
    candidates.push({
      text: heading,
      reason: `The visible copy matches a heading from ${target.title}.`,
      confidence: 0.7,
    });
  }

  return dedupeCandidates(candidates).filter((candidate) =>
    isUsefulAnchor(candidate.text),
  );
}

function findAnchorText(paragraph: string, candidate: string) {
  const normalizedParagraph = paragraph.toLowerCase();
  const normalizedCandidate = candidate.toLowerCase().trim();
  const index = normalizedParagraph.indexOf(normalizedCandidate);
  if (index === -1) return null;
  return paragraph.slice(index, index + normalizedCandidate.length);
}

function linkParagraph(
  paragraph: string,
  suggestion: InternalLinkSuggestion,
): Extract<RichTextNode, { type: "paragraph" }> | null {
  const normalizedParagraph = paragraph.toLowerCase();
  const normalizedAnchor = suggestion.anchorText.toLowerCase().trim();
  const index = normalizedParagraph.indexOf(normalizedAnchor);
  if (index === -1) return null;

  const before = paragraph.slice(0, index);
  const anchor = paragraph.slice(index, index + normalizedAnchor.length);
  const after = paragraph.slice(index + normalizedAnchor.length);
  return {
    type: "paragraph",
    spans: [
      ...(before ? [{ text: before }] : []),
      { text: anchor, href: suggestion.targetPath },
      ...(after ? [{ text: after }] : []),
    ],
  };
}

function paragraphHasLinkedSpans(
  node: Extract<RichTextNode, { type: "paragraph" }>,
) {
  return "spans" in node && node.spans.some((span) => Boolean(span.href));
}

function dedupeCandidates(candidates: AnchorCandidate[]) {
  const seen = new Set<string>();
  const result: AnchorCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.text.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function isUsefulAnchor(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 8 && value.trim().length >= 4;
}

function normalizePath(path: string) {
  return (path.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
}
