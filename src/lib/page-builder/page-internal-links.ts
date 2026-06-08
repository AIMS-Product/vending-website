import type { PageBlock, PageInternalLink } from "@/lib/page-builder/blocks";

export function collectInternalLinks(blocks: PageBlock[]): PageInternalLink[] {
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
