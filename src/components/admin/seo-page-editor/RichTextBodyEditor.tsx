"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import {
  richTextNodePlainText,
  type PageBlock,
  type RichTextDocument,
  type RichTextNode,
} from "@/lib/page-builder/blocks";
import { richTextBodyPlaceholder } from "@/lib/page-builder/block-editor-placeholders";
import {
  compactInputClass,
  dangerButtonClass,
  miniButtonClass,
  textareaClass,
} from "@/components/admin/seo-page-editor/editor-styles";

type RichTextBlock = Extract<PageBlock, { type: "rich_text" }>;
type RichTextNodeKind =
  | "paragraph"
  | "h2"
  | "h3"
  | "h4"
  | "bullet"
  | "numbered";

const nodeTypeOptions: { value: RichTextNodeKind; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "bullet", label: "Bullet list" },
  { value: "numbered", label: "Numbered list" },
];

export function RichTextBodyEditor({
  document,
  onChange,
  variant,
}: {
  document: RichTextDocument;
  onChange: (document: RichTextDocument) => void;
  variant: RichTextBlock["variant"];
}) {
  const nodes =
    document.nodes.length > 0
      ? document.nodes
      : [{ type: "paragraph" as const, text: "" }];

  function replaceNode(index: number, nextNode: RichTextNode) {
    onChange({
      version: 1,
      nodes: nodes.map((node, nodeIndex) =>
        nodeIndex === index ? nextNode : node,
      ),
    });
  }

  function removeNode(index: number) {
    const nextNodes = nodes.filter((_, nodeIndex) => nodeIndex !== index);
    onChange({
      version: 1,
      nodes:
        nextNodes.length > 0 ? nextNodes : [{ type: "paragraph", text: "" }],
    });
  }

  function addNode(kind: RichTextNodeKind) {
    if (nodes.length >= 30) return;
    onChange({
      version: 1,
      nodes: [...nodes, createNode(kind)],
    });
  }

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        const kind = nodeKind(node);
        const textValue = richTextNodePlainText(node);
        return (
          <div
            key={`${index}-${kind}`}
            className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm"
          >
            {node.type === "list" ? (
              <label className="block">
                <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  List items
                </span>
                <AutoResizeTextarea
                  aria-label={`List items ${index + 1}`}
                  value={node.items.join("\n")}
                  placeholder="Add one item per line"
                  rows={Math.max(3, node.items.length)}
                  className={textareaClass}
                  onChange={(event) =>
                    replaceNode(index, {
                      ...node,
                      items: listItemsFromText(event.target.value),
                    })
                  }
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    {node.type === "heading" ? "Heading" : "Paragraph"}
                  </span>
                  <AutoResizeTextarea
                    aria-label={`Text body ${index + 1}`}
                    value={textValue}
                    placeholder={
                      index === 0
                        ? richTextBodyPlaceholder(variant)
                        : "Add supporting text"
                    }
                    rows={node.type === "heading" ? 1 : 3}
                    maxLength={node.type === "heading" ? 180 : 2000}
                    className={textareaClass}
                    onChange={(event) =>
                      replaceNode(
                        index,
                        updateNodeText(node, event.target.value),
                      )
                    }
                  />
                </label>
              </>
            )}

            <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold tracking-wider text-slate-500 uppercase transition hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/25 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                Text options
              </summary>
              <div className="space-y-3 border-t border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="min-w-44 flex-1">
                    <span className="sr-only">Text block {index + 1} type</span>
                    <select
                      data-testid="rich-text-node-type"
                      aria-label={`Text block ${index + 1} type`}
                      value={kind}
                      onChange={(event) =>
                        replaceNode(
                          index,
                          createNode(
                            event.target.value as RichTextNodeKind,
                            node,
                          ),
                        )
                      }
                      className={compactInputClass}
                    >
                      {nodeTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {nodes.length > 1 ? (
                    <button
                      type="button"
                      className={`${dangerButtonClass} w-auto px-3 py-2`}
                      onClick={() => removeNode(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                {node.type === "paragraph" ? (
                  <label className="block">
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Manual link
                    </span>
                    <input
                      data-testid="rich-text-link-href"
                      aria-label={`Manual link path ${index + 1}`}
                      value={paragraphHref(node)}
                      placeholder="/resources/example"
                      onChange={(event) => {
                        const href = event.target.value.trim();
                        if (!isSafeLinkHrefInput(href)) return;
                        replaceNode(index, updateParagraphHref(node, href));
                      }}
                      className={compactInputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Use a root-relative path or an http(s) URL.
                    </span>
                  </label>
                ) : null}
              </div>
            </details>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={miniButtonClass}
          disabled={nodes.length >= 30}
          onClick={() => addNode("paragraph")}
        >
          Add paragraph
        </button>
        <button
          type="button"
          className={miniButtonClass}
          disabled={nodes.length >= 30}
          onClick={() => addNode("h2")}
        >
          Add heading
        </button>
        <button
          type="button"
          data-testid="rich-text-add-list"
          className={miniButtonClass}
          disabled={nodes.length >= 30}
          onClick={() => addNode("bullet")}
        >
          Add list
        </button>
      </div>
    </div>
  );
}

function AutoResizeTextarea({
  className,
  value,
  onChange,
  rows = 1,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={textareaRef}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      className={`${className ?? ""} resize-none overflow-hidden`}
    />
  );
}

function nodeKind(node: RichTextNode): RichTextNodeKind {
  if (node.type === "list") {
    return node.style === "numbered" ? "numbered" : "bullet";
  }
  if (node.type === "heading") return `h${node.level}` as RichTextNodeKind;
  return "paragraph";
}

function createNode(
  kind: RichTextNodeKind,
  source?: RichTextNode,
): RichTextNode {
  const text = source ? richTextNodePlainText(source) : "";
  if (kind === "h2") return { type: "heading", level: 2, text };
  if (kind === "h3") return { type: "heading", level: 3, text };
  if (kind === "h4") return { type: "heading", level: 4, text };
  if (kind === "bullet" || kind === "numbered") {
    return {
      type: "list",
      style: kind === "numbered" ? "numbered" : "bullet",
      items: text ? [text] : [""],
    };
  }
  return { type: "paragraph", text };
}

function updateNodeText(node: RichTextNode, value: string): RichTextNode {
  if (node.type === "heading") return { ...node, text: value };
  if (node.type === "paragraph") {
    const href = paragraphHref(node);
    if (href) return { type: "paragraph", spans: [{ text: value, href }] };
    return { type: "paragraph", text: value };
  }
  return node;
}

function paragraphHref(node: RichTextNode) {
  if (node.type !== "paragraph" || !("spans" in node)) return "";
  return node.spans.find((span) => span.href)?.href ?? "";
}

function updateParagraphHref(
  node: Extract<RichTextNode, { type: "paragraph" }>,
  href: string,
): RichTextNode {
  const text = richTextNodePlainText(node);
  if (!href) return { type: "paragraph", text };
  return { type: "paragraph", spans: [{ text, href }] };
}

function listItemsFromText(value: string) {
  const items = value.split(/\r?\n/);
  return items.length > 0 ? items : [""];
}

function isSafeLinkHrefInput(value: string) {
  return (
    value.length === 0 ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    /^https?:\/\//i.test(value)
  );
}
