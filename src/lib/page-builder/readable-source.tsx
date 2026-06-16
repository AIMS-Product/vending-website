import {
  cardGridLinkLabel,
  type PageBlock,
  type PageContent,
  type RichTextNode,
  type RichTextSpan,
} from "@/lib/page-builder/blocks";

type BlockRenderer<T extends PageBlock> = (block: T, depth: number) => string[];

const voidElementPattern =
  /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;
const blockRenderers = {
  hero: renderHeroBlock,
  rich_text: renderRichTextBlock,
  image: renderImageBlock,
  video: renderVideoBlock,
  cta: renderCtaBlock,
  faq: renderFaqBlock,
  card_grid: renderCardGridBlock,
  proof: renderProofBlock,
  lead_form: renderLeadFormBlock,
} satisfies {
  [K in PageBlock["type"]]: BlockRenderer<Extract<PageBlock, { type: K }>>;
};

export function renderReadableResourceHtml(content: PageContent) {
  const lines = ['<div data-page-builder-version="1">'];

  for (const section of content.sections) {
    lines.push(
      indent(
        1,
        `<section data-section-id="${escapeAttr(section.id)}" data-preset="${escapeAttr(section.preset)}" data-background="${escapeAttr(section.background)}" data-spacing="${escapeAttr(section.spacing)}">`,
      ),
    );
    for (const column of section.columns) {
      lines.push(
        indent(
          2,
          `<div data-column-id="${escapeAttr(column.id)}" data-width="${escapeAttr(column.width)}">`,
        ),
      );
      for (const block of column.blocks) {
        lines.push(...renderBlockHtml(block, 3));
      }
      lines.push(indent(2, "</div>"));
    }
    lines.push(indent(1, "</section>"));
  }

  lines.push("</div>");
  return lines.join("\n");
}

export function formatHtmlFragment(markup: string) {
  const tokens = markup.replace(/></g, ">\n<").split("\n");
  const lines: string[] = [];
  let depth = 0;

  for (const token of tokens) {
    const line = token.trim();
    if (!line) continue;

    if (line.startsWith("</")) depth = Math.max(0, depth - 1);

    lines.push(`${"  ".repeat(depth)}${line}`);

    if (opensNestedElement(line)) depth += 1;
  }

  return lines.join("\n");
}

function opensNestedElement(line: string) {
  if (!line.startsWith("<") || line.startsWith("</") || line.startsWith("<!")) {
    return false;
  }
  if (line.endsWith("/>") || voidElementPattern.test(line)) return false;
  const openTag = line.match(/^<([a-z][\w:-]*)\b/i)?.[1];
  if (!openTag) return false;
  return !new RegExp(`</${openTag}>$`, "i").test(line);
}

function renderBlockHtml(block: PageBlock, depth: number) {
  return [
    indent(
      depth,
      `<article data-block-id="${escapeAttr(block.id)}" data-block-type="${escapeAttr(block.type)}" data-variant="${escapeAttr(block.variant)}">`,
    ),
    ...renderBlockBody(block, depth + 1),
    indent(depth, "</article>"),
  ];
}

function renderBlockBody(block: PageBlock, depth: number) {
  return blockRenderers[block.type](block as never, depth);
}

function renderHeroBlock(
  block: Extract<PageBlock, { type: "hero" }>,
  depth: number,
) {
  return [
    ...textLine("p", block.props.eyebrow, depth),
    ...textLine("h1", block.props.heading, depth),
    ...textLine("p", block.props.body, depth),
    ...optionalLinkLine(block.props.ctaLabel, block.props.ctaHref, depth),
    ...mediaLine(block.props.mediaSrc, block.props.mediaAltText, depth),
    ...textLine("p", block.props.mediaCaption, depth),
    ...textLine("p", block.props.proofText, depth),
  ];
}

function renderRichTextBlock(
  block: Extract<PageBlock, { type: "rich_text" }>,
  depth: number,
) {
  return [
    ...textLine("p", block.props.eyebrow, depth),
    ...textLine("h2", block.props.heading, depth),
    ...renderRichTextNodes(block.props.body.nodes, depth),
  ];
}

function renderImageBlock(
  block: Extract<PageBlock, { type: "image" }>,
  depth: number,
) {
  return [
    ...mediaLine(block.props.src, block.props.altText, depth),
    ...textLine("figcaption", block.props.caption, depth),
  ];
}

function renderVideoBlock(
  block: Extract<PageBlock, { type: "video" }>,
  depth: number,
) {
  return [
    ...textLine("h2", block.props.title, depth),
    ...optionalLinkLine(
      block.props.title || "Watch video",
      block.props.url,
      depth,
    ),
    ...mediaLine(block.props.thumbnailSrc, block.props.thumbnailAltText, depth),
    ...textLine("p", block.props.caption, depth),
  ];
}

function renderCtaBlock(
  block: Extract<PageBlock, { type: "cta" }>,
  depth: number,
) {
  return [linkLine(block.props.label, block.props.href, depth)];
}

function renderFaqBlock(
  block: Extract<PageBlock, { type: "faq" }>,
  depth: number,
) {
  return [
    ...textLine("h2", block.props.heading, depth),
    ...block.props.items.flatMap((item) => [
      indent(depth, "<details>"),
      ...textLine("summary", item.question, depth + 1),
      ...textLine("p", item.answer, depth + 1),
      indent(depth, "</details>"),
    ]),
  ];
}

function renderCardGridBlock(
  block: Extract<PageBlock, { type: "card_grid" }>,
  depth: number,
) {
  return [
    ...textLine("h2", block.props.heading, depth),
    indent(depth, "<div data-card-grid>"),
    ...block.props.cards.flatMap((card) => [
      indent(depth + 1, "<article data-card>"),
      ...textLine("h3", card.title, depth + 2),
      ...textLine("p", card.body, depth + 2),
      ...optionalLinkLine(cardGridLinkLabel(card), card.href, depth + 2),
      indent(depth + 1, "</article>"),
    ]),
    indent(depth, "</div>"),
  ];
}

function renderProofBlock(
  block: Extract<PageBlock, { type: "proof" }>,
  depth: number,
) {
  return [
    ...mediaLine(block.props.mediaSrc, block.props.mediaAltText, depth),
    ...textLine("p", block.props.eyebrow, depth),
    ...textLine("blockquote", block.props.body, depth),
    ...textLine("p", block.props.name, depth),
    ...textLine("p", block.props.context, depth),
  ];
}

function renderLeadFormBlock(
  block: Extract<PageBlock, { type: "lead_form" }>,
  depth: number,
) {
  return [
    ...textLine("h2", block.props.heading, depth),
    ...textLine("p", block.props.body, depth),
    indent(
      depth,
      `<form data-lead-form data-submit-label="${escapeAttr(block.props.submitLabel)}"></form>`,
    ),
  ];
}

function renderRichTextNodes(nodes: RichTextNode[], depth: number) {
  return nodes.flatMap((node) => renderRichTextNode(node, depth));
}

function renderRichTextNode(node: RichTextNode, depth: number) {
  if (node.type === "heading") {
    return textLine(`h${node.level}`, node.text, depth);
  }
  if (node.type === "list") {
    return renderListNode(node, depth);
  }
  if ("spans" in node) {
    return renderSpanParagraph(node.spans, depth);
  }
  return textLine("p", node.text, depth);
}

function renderListNode(
  node: Extract<RichTextNode, { type: "list" }>,
  depth: number,
) {
  const tag = node.style === "numbered" ? "ol" : "ul";
  return [
    indent(depth, `<${tag}>`),
    ...node.items.flatMap((item) => textLine("li", item, depth + 1)),
    indent(depth, `</${tag}>`),
  ];
}

function renderSpanParagraph(spans: RichTextSpan[], depth: number) {
  const text = spans.map(renderSpan).join("");
  return text ? [indent(depth, `<p>${text}</p>`)] : [];
}

function renderSpan(span: RichTextSpan) {
  const text = escapeHtml(span.text);
  if (!span.href) return text;
  return `<a href="${escapeAttr(span.href)}">${text}</a>`;
}

function textLine(
  tag: string,
  value: string | null | undefined,
  depth: number,
) {
  const text = value?.trim();
  return text ? [indent(depth, `<${tag}>${escapeHtml(text)}</${tag}>`)] : [];
}

function mediaLine(
  src: string | null | undefined,
  alt: string | null | undefined,
  depth: number,
) {
  const value = src?.trim();
  return value
    ? [
        indent(
          depth,
          `<img src="${escapeAttr(value)}" alt="${escapeAttr(alt ?? "")}" />`,
        ),
      ]
    : [];
}

function linkLine(label: string, href: string, depth: number) {
  return indent(
    depth,
    `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`,
  );
}

function optionalLinkLine(
  label: string | null | undefined,
  href: string | null | undefined,
  depth: number,
) {
  return label && href ? [linkLine(label, href, depth)] : [];
}

function indent(depth: number, value: string) {
  return `${"  ".repeat(depth)}${value}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
