import {
  pageBlockSchema,
  type PageBlock,
  type RichTextNode,
  type RichTextSpan,
} from "@/lib/page-builder/blocks";

export type DocumentImportProposedBlock = {
  block: PageBlock;
  sourceExcerpt: string;
  sourceLines: [number, number];
  warnings: string[];
};

export type DocumentImportProposal = {
  id: string;
  sourceKind: "pasted_text";
  sourceTitle: string;
  sourceExcerpt: string;
  lineCount: number;
  blocks: DocumentImportProposedBlock[];
  warnings: string[];
};

type DocumentLine = {
  lineNumber: number;
  text: string;
};

type DocumentSection = {
  heading: string;
  lines: DocumentLine[];
  sourceStart: number;
};

type CreateDocumentImportProposalInput = {
  text: string;
  makeBlockId?: () => string;
  makeProposalId?: () => string;
  sourceTitle?: string;
};

const MAX_IMPORTED_BLOCKS = 8;
const MAX_EXCERPT_LENGTH = 700;

export function createDocumentImportProposal({
  text,
  makeBlockId = fallbackId("block_import"),
  makeProposalId = fallbackId("document_import"),
  sourceTitle,
}: CreateDocumentImportProposalInput): DocumentImportProposal {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line.trim() }))
    .filter((line) => line.text.length > 0);
  const title = sourceTitle?.trim() || firstDocumentTitle(lines);
  const allSections = documentSections(lines, title);
  const sections = allSections.slice(0, MAX_IMPORTED_BLOCKS);
  const droppedCount = allSections.length - sections.length;
  const warnings =
    droppedCount > 0
      ? [
          `${droppedCount} ${droppedCount === 1 ? "section" : "sections"} dropped — only the first ${MAX_IMPORTED_BLOCKS} were imported.`,
        ]
      : [];

  return {
    id: makeProposalId(),
    sourceKind: "pasted_text",
    sourceTitle: title,
    sourceExcerpt: excerpt(lines.map((line) => line.text).join("\n")),
    lineCount: lines.at(-1)?.lineNumber ?? 0,
    blocks: sections.flatMap((section) => {
      const block = pageBlockSchema.safeParse({
        id: makeBlockId(),
        type: "rich_text",
        variant: "default",
        props: {
          eyebrow: "Imported document",
          heading: section.heading,
          body: {
            version: 1,
            nodes: richTextNodesFromLines(section.lines),
          },
        },
      });
      if (!block.success) return [];

      const sourceEnd = section.lines.at(-1)?.lineNumber ?? section.sourceStart;
      return [
        {
          block: block.data,
          sourceExcerpt: excerpt(
            section.lines.map((line) => line.text).join("\n"),
          ),
          sourceLines: [section.sourceStart, sourceEnd] as [number, number],
          warnings: [],
        },
      ];
    }),
    warnings,
  };
}

function firstDocumentTitle(lines: DocumentLine[]) {
  return stripMarkdownHeading(lines[0]?.text ?? "") || "Imported document";
}

function documentSections(lines: DocumentLine[], fallbackHeading: string) {
  const sections: DocumentSection[] = [];
  let current: DocumentSection | null = null;

  for (const line of lines) {
    const markdownHeading = markdownHeadingMatch(line.text);
    if (!current) {
      current = {
        heading: stripMarkdownHeading(line.text) || fallbackHeading,
        lines: markdownHeading ? [] : [line],
        sourceStart: line.lineNumber,
      };
      continue;
    }

    if (markdownHeading) {
      sections.push(current);
      current = {
        heading: markdownHeading.text,
        lines: [],
        sourceStart: line.lineNumber,
      };
      continue;
    }

    current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections.map((section) => ({
    ...section,
    lines:
      section.lines.length > 0
        ? section.lines
        : [{ lineNumber: section.sourceStart, text: section.heading }],
  }));
}

function richTextNodesFromLines(lines: DocumentLine[]): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  let pendingList: { style: "bullet" | "numbered"; items: string[] } | null =
    null;

  function flushList() {
    if (!pendingList) return;
    nodes.push({ type: "list", ...pendingList });
    pendingList = null;
  }

  for (const line of lines) {
    const item = listItem(line.text);
    if (item) {
      if (!pendingList || pendingList.style !== item.style) {
        flushList();
        pendingList = { style: item.style, items: [] };
      }
      pendingList.items.push(item.text);
      continue;
    }

    flushList();
    const heading = markdownHeadingMatch(line.text);
    if (heading && heading.level >= 2 && heading.level <= 4) {
      nodes.push({ type: "heading", level: heading.level, text: heading.text });
      continue;
    }
    nodes.push(paragraphNodeFromMarkdownLinks(line.text));
  }

  flushList();
  return nodes.length > 0 ? nodes : [{ type: "paragraph", text: "" }];
}

function markdownHeadingMatch(text: string) {
  const match = /^(#{1,4})\s+(.+)$/.exec(text);
  if (!match) return null;
  return {
    level: Math.min(Math.max(match[1].length, 2), 4) as 2 | 3 | 4,
    text: match[2].trim(),
  };
}

function stripMarkdownHeading(text: string) {
  return text.replace(/^#{1,4}\s+/, "").trim();
}

function listItem(text: string) {
  const match = /^(\d+[.)]|[-*])\s+(.+)$/.exec(text);
  if (!match) return null;
  return {
    style: /^\d/.test(match[1]) ? ("numbered" as const) : ("bullet" as const),
    text: match[2].trim(),
  };
}

function paragraphNodeFromMarkdownLinks(text: string): RichTextNode {
  const spans: RichTextSpan[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const href = match[2].trim();
    if (!isSafeHref(href)) continue;
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index) });
    }
    spans.push({ text: match[1], href });
    lastIndex = match.index + match[0].length;
  }

  if (spans.length === 0) return { type: "paragraph", text };
  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex) });
  return { type: "paragraph", spans };
}

function isSafeHref(value: string) {
  return (
    value.length === 0 ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    /^https?:\/\//i.test(value)
  );
}

function excerpt(value: string) {
  if (value.length <= MAX_EXCERPT_LENGTH) return value;
  return `${value.slice(0, MAX_EXCERPT_LENGTH - 1)}...`;
}

function fallbackId(prefix: string) {
  return () =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
