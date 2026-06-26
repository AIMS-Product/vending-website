import type { PageBlock } from "@/lib/page-builder/blocks";
import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { LeadAttributionLinkContext } from "@/lib/lead-attribution-links";
import {
  RichTextParagraphContent,
  editorFallback,
  richTextNodeKey,
  type ResourcePageLinkMode,
  type ResourcePageRenderMode,
} from "./shared";

type RichTextBlockProps = {
  block: Extract<PageBlock, { type: "rich_text" }>;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  renderMode: ResourcePageRenderMode;
  linkMode: ResourcePageLinkMode;
};

export function RichTextBlock({
  block,
  leadAttribution,
  linkContext,
  renderMode,
  linkMode,
}: RichTextBlockProps) {
  const richTextFrameClass =
    block.variant === "intro"
      ? "max-w-4xl border-l-4 border-[#55b8e8] pl-6"
      : block.variant === "compact"
        ? "max-w-2xl"
        : block.variant === "checklist"
          ? "max-w-3xl rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]"
          : "max-w-3xl";
  const richTextHeadingClass =
    block.variant === "intro"
      ? "mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl"
      : block.variant === "compact"
        ? "mt-3 text-xl leading-tight font-black text-[#111111] uppercase md:text-2xl"
        : "mt-4 text-2xl leading-tight font-black text-[#111111] uppercase md:text-3xl";

  return (
    <div className={richTextFrameClass}>
      {isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow && (
        <p className="text-sm font-black text-[#066a99] uppercase">
          {block.props.eyebrow}
        </p>
      )}
      {isBlockFieldVisible(block, "heading") &&
        (block.props.heading || renderMode === "editor") && (
          <h2 className={richTextHeadingClass}>
            {editorFallback(block.props.heading, "Section heading", renderMode)}
          </h2>
        )}
      <div className="mt-5 space-y-4 text-base leading-8 font-semibold text-slate-700">
        {block.variant === "checklist" &&
        block.props.body.nodes.length === 0 &&
        renderMode === "editor" ? (
          <ChecklistPlaceholder />
        ) : block.props.body.nodes.length === 0 && renderMode === "editor" ? (
          <p className="text-slate-400">Write the page copy here.</p>
        ) : (
          block.props.body.nodes.map((node, nodeIndex) => {
            if (node.type === "heading") {
              const HeadingTag = richTextBodyHeadingTag(node.level);
              return (
                <HeadingTag
                  key={richTextNodeKey(node, nodeIndex)}
                  className={richTextBodyHeadingClass(node.level)}
                >
                  {editorFallback(node.text, "Subheading", renderMode)}
                </HeadingTag>
              );
            }
            if (node.type === "list") {
              const ListTag = node.style === "numbered" ? "ol" : "ul";
              return (
                <ListTag
                  key={richTextNodeKey(node, nodeIndex)}
                  className={
                    block.variant === "checklist"
                      ? "ml-0 list-none space-y-3"
                      : node.style === "numbered"
                        ? "ml-5 list-outside list-decimal space-y-2"
                        : "ml-5 list-outside list-disc space-y-2"
                  }
                >
                  {node.items.map((item, itemIndex) => (
                    <li
                      key={`${itemIndex}:${item}`}
                      className={
                        block.variant === "checklist"
                          ? "flex gap-3 before:mt-1 before:block before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-[#111111] before:bg-[#55b8e8] before:content-['']"
                          : undefined
                      }
                    >
                      {editorFallback(item, "List item", renderMode)}
                    </li>
                  ))}
                </ListTag>
              );
            }
            return (
              <p key={richTextNodeKey(node, nodeIndex)}>
                <RichTextParagraphContent
                  node={node}
                  leadAttribution={leadAttribution}
                  linkContext={linkContext}
                  linkMode={linkMode}
                  renderMode={renderMode}
                />
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}

function richTextBodyHeadingTag(level: 2 | 3 | 4) {
  if (level === 2) return "h2";
  if (level === 4) return "h4";
  return "h3";
}

function richTextBodyHeadingClass(level: 2 | 3 | 4) {
  const base = "pt-2 font-black text-[#111111] uppercase";
  if (level === 2) return `${base} text-2xl leading-tight`;
  if (level === 4) return `${base} text-lg leading-snug`;
  return `${base} text-xl leading-tight`;
}

function ChecklistPlaceholder() {
  return (
    <ul className="space-y-3">
      {["Checklist item 1", "Checklist item 2", "Checklist item 3"].map(
        (item, index) => (
          <li
            key={`${index}:${item}`}
            className="flex gap-3 text-slate-400 before:mt-1 before:block before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-[#111111] before:bg-[#55b8e8] before:content-['']"
          >
            Checklist item
          </li>
        ),
      )}
    </ul>
  );
}
