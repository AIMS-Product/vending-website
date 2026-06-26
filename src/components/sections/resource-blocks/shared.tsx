import Link from "next/link";
import type { ReactNode } from "react";
import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  appendLeadAttributionToHref,
  shouldPreserveLeadAttribution,
  type LeadAttributionLinkContext,
} from "@/lib/lead-attribution-links";
import type { PageBlock, RichTextNode } from "@/lib/page-builder/blocks";

export type ResourcePageRenderMode = "public" | "editor";
export type ResourcePageLinkMode = "live" | "disabled";
export type LeadFormBlock = Extract<PageBlock, { type: "lead_form" }>;
type ResourceLinkProps = {
  href: string;
  trackingName?: string;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  linkMode: ResourcePageLinkMode;
  className: string;
  children: ReactNode;
};

export function previewLayoutClass(
  previewLayout: boolean | undefined,
  previewClass: string,
  responsiveClass: string,
) {
  return previewLayout ? previewClass : responsiveClass;
}

export function ResourceLink(props: ResourceLinkProps) {
  const state = resourceLinkState(props);

  if (state.disabled) {
    return (
      <span
        data-tracking-name={props.trackingName}
        aria-disabled="true"
        className={props.className}
      >
        {props.children}
      </span>
    );
  }

  if (isInternalHref(props.href)) {
    return (
      <Link
        href={state.resolvedHref}
        data-tracking-name={props.trackingName}
        data-vp-preserve-attribution={state.preserveAttribution}
        data-vp-source-page-id={state.context.sourcePageId ?? undefined}
        data-vp-source-page-slug={state.context.sourcePageSlug ?? undefined}
        data-vp-target-keyword={state.context.targetKeyword ?? undefined}
        data-vp-source-block-id={state.context.sourceBlockId ?? undefined}
        data-vp-source-cta-tracking-name={
          state.context.sourceCtaTrackingName ?? undefined
        }
        className={props.className}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <a
      href={props.href}
      data-tracking-name={props.trackingName}
      rel="noopener noreferrer"
      className={props.className}
    >
      {props.children}
    </a>
  );
}

function resourceLinkState({
  href,
  leadAttribution,
  linkContext,
  linkMode,
  trackingName,
}: ResourceLinkProps) {
  const context = {
    ...linkContext,
    sourceCtaTrackingName:
      linkContext?.sourceCtaTrackingName ?? trackingName ?? null,
    clickedHref: linkContext?.clickedHref ?? href,
  };
  const shouldPreserve = shouldPreserveLeadAttribution(href);
  return {
    context,
    disabled: linkMode === "disabled" || href === "#",
    preserveAttribution: shouldPreserve ? "true" : undefined,
    resolvedHref: shouldPreserve
      ? appendLeadAttributionToHref({
          href,
          attribution: leadAttribution,
          context,
        })
      : href,
  };
}

function isInternalHref(href: string) {
  return href.startsWith("/") || href.startsWith("#");
}

export function RichTextParagraphContent({
  node,
  leadAttribution,
  linkContext,
  linkMode,
  renderMode,
}: {
  node: Extract<RichTextNode, { type: "paragraph" }>;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
}) {
  return renderRichTextParagraph(
    node,
    linkMode,
    renderMode,
    leadAttribution,
    linkContext,
  );
}

function renderRichTextParagraph(
  node: Extract<RichTextNode, { type: "paragraph" }>,
  linkMode: ResourcePageLinkMode,
  renderMode: ResourcePageRenderMode,
  leadAttribution?: LeadAttribution | null,
  linkContext?: LeadAttributionLinkContext,
) {
  if (!("spans" in node)) {
    return editorFallback(node.text, "Paragraph copy", renderMode);
  }

  if (node.spans.length === 0 && renderMode === "editor") {
    return <span className="text-slate-400">Paragraph copy</span>;
  }

  return node.spans.map((span, index) => {
    const text = editorFallback(span.text, "Link text", renderMode);
    if (!span.href) {
      return <span key={richTextSpanKey(span, index)}>{text}</span>;
    }
    return (
      <ResourceLink
        key={richTextSpanKey(span, index)}
        href={span.href}
        leadAttribution={leadAttribution}
        linkContext={linkContext}
        linkMode={linkMode}
        className="text-[#066a99] underline underline-offset-4 hover:text-[#111111]"
      >
        {text}
      </ResourceLink>
    );
  });
}

export function richTextNodeKey(node: RichTextNode, index: number) {
  if (node.type === "list") {
    return `${index}:${node.type}:${node.style}:${node.items.join("|")}`;
  }
  if ("spans" in node) {
    return `${index}:${node.type}:${node.spans
      .map((span, spanIndex) => richTextSpanKey(span, spanIndex))
      .join("|")}`;
  }
  return `${index}:${node.type}:${node.text}`;
}

function richTextSpanKey(span: { text: string; href?: string }, index: number) {
  return `${index}:${span.text}:${span.href ?? ""}`;
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
