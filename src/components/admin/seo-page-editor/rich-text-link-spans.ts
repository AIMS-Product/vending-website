import type { RichTextNode } from "@/lib/page-builder/blocks";

type ParagraphNode = Extract<RichTextNode, { type: "paragraph" }>;

export type ParagraphLinkResult =
  | { ok: true; node: ParagraphNode }
  | { ok: false; error: "unsafe_href" | "link_text_not_found" };

/** Mirrors the public-renderer link safety rule: root-relative or http(s). */
export function isSafeLinkHrefInput(value: string): boolean {
  return (
    value.length === 0 ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    /^https?:\/\//i.test(value)
  );
}

/** The href applied to a paragraph, or "" when the paragraph has no link. */
export function paragraphHref(node: RichTextNode): string {
  if (node.type !== "paragraph" || !("spans" in node)) return "";
  return node.spans.find((span) => span.href)?.href ?? "";
}

/**
 * The substring the link is scoped to, or "" when the link wraps the whole
 * paragraph (single-span model) or there is no link.
 */
export function paragraphLinkText(node: RichTextNode): string {
  if (node.type !== "paragraph" || !("spans" in node)) return "";
  if (node.spans.length <= 1) return "";
  return node.spans.find((span) => span.href)?.text ?? "";
}

/**
 * Builds a paragraph node with `href` applied to the first case-sensitive
 * occurrence of `linkText` within `text`. Empty `linkText` preserves the
 * legacy whole-paragraph link. No data change is produced for unsafe hrefs
 * or when `linkText` is not found.
 */
export function buildParagraphLinkNode({
  text,
  href,
  linkText,
}: {
  text: string;
  href: string;
  linkText: string;
}): ParagraphLinkResult {
  if (!isSafeLinkHrefInput(href)) return { ok: false, error: "unsafe_href" };
  if (!href) return { ok: true, node: { type: "paragraph", text } };
  if (!linkText) {
    return { ok: true, node: { type: "paragraph", spans: [{ text, href }] } };
  }
  const matchIndex = text.indexOf(linkText);
  if (matchIndex === -1) return { ok: false, error: "link_text_not_found" };
  const spans = [
    { text: text.slice(0, matchIndex) },
    { text: linkText, href },
    { text: text.slice(matchIndex + linkText.length) },
  ].filter((span) => span.text.length > 0);
  return { ok: true, node: { type: "paragraph", spans } };
}
