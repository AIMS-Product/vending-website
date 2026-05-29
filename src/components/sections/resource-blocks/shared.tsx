import Link from "next/link";
import type { ReactNode } from "react";
import type { PageBlock, RichTextNode } from "@/lib/page-builder/blocks";

export type ResourcePageRenderMode = "public" | "editor";
export type ResourcePageLinkMode = "live" | "disabled";
export type LeadFormBlock = Extract<PageBlock, { type: "lead_form" }>;

export function previewLayoutClass(
  previewLayout: boolean | undefined,
  previewClass: string,
  responsiveClass: string,
) {
  return previewLayout ? previewClass : responsiveClass;
}

export function ResourceLink({
  href,
  trackingName,
  linkMode,
  className,
  children,
}: {
  href: string;
  trackingName?: string;
  linkMode: ResourcePageLinkMode;
  className: string;
  children: ReactNode;
}) {
  const disabled = linkMode === "disabled" || href === "#";

  if (disabled) {
    return (
      <span
        data-tracking-name={trackingName}
        aria-disabled="true"
        className={className}
      >
        {children}
      </span>
    );
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} data-tracking-name={trackingName} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      data-tracking-name={trackingName}
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function RichTextParagraphContent({
  node,
  linkMode,
  renderMode,
}: {
  node: Extract<RichTextNode, { type: "paragraph" }>;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
}) {
  return renderRichTextParagraph(node, linkMode, renderMode);
}

function renderRichTextParagraph(
  node: Extract<RichTextNode, { type: "paragraph" }>,
  linkMode: ResourcePageLinkMode,
  renderMode: ResourcePageRenderMode,
) {
  if (!("spans" in node)) {
    return editorFallback(node.text, "Paragraph copy", renderMode);
  }

  if (node.spans.length === 0 && renderMode === "editor") {
    return <span className="text-slate-400">Paragraph copy</span>;
  }

  return node.spans.map((span) => {
    const text = editorFallback(span.text, "Link text", renderMode);
    if (!span.href) return <span key={richTextSpanKey(span)}>{text}</span>;
    return (
      <ResourceLink
        key={richTextSpanKey(span)}
        href={span.href}
        linkMode={linkMode}
        className="text-[#066a99] underline underline-offset-4 hover:text-[#111111]"
      >
        {text}
      </ResourceLink>
    );
  });
}

export function richTextNodeKey(node: RichTextNode) {
  if (node.type === "list") {
    return `${node.type}:${node.style}:${node.items.join("|")}`;
  }
  if ("spans" in node) {
    return `${node.type}:${node.spans.map(richTextSpanKey).join("|")}`;
  }
  return `${node.type}:${node.text}`;
}

function richTextSpanKey(span: { text: string; href?: string }) {
  return `${span.text}:${span.href ?? ""}`;
}

export function editorFallback(
  value: string | null | undefined,
  fallback: string,
  renderMode: ResourcePageRenderMode,
) {
  if (value && value.trim().length > 0) return value;
  if (renderMode === "editor") {
    return <span className="text-slate-400">{fallback}</span>;
  }
  return "";
}

export function resourceCtaClass(variant: PageBlock["variant"]) {
  const base =
    "inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] px-5 py-3 text-sm font-black uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2";
  if (variant === "secondary") {
    return `${base} bg-white text-[#111111] hover:bg-[#eaf8ff]`;
  }
  if (variant === "text") {
    return "text-sm font-black uppercase text-[#066a99] hover:text-[#111111]";
  }
  return `${base} bg-[#f47b3b] text-[#111111]`;
}
