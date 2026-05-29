"use client";

import { useState } from "react";
import { FAQ_MAX_ITEMS, type PageBlock } from "@/lib/page-builder/blocks";
import {
  appendBlankFaq,
  type FaqBlock,
} from "@/lib/page-builder/editor-helpers";
import {
  TextAreaInput,
  TextInput,
} from "@/components/admin/seo-page-editor/EditorInputs";
import {
  dangerButtonClass,
  miniButtonClass,
} from "@/components/admin/seo-page-editor/editor-styles";

export function FaqItemEditorList({
  block,
  onChange,
}: {
  block: FaqBlock;
  onChange: (block: PageBlock) => void;
}) {
  const [itemKeys, setItemKeys] = useState(() =>
    createInitialEditorKeys(block.id, block.props.items.length),
  );

  return (
    <div className="space-y-3">
      {block.props.items.map((item, itemIndex) => (
        <div
          key={itemKeys[itemIndex] ?? `${block.id}-${itemIndex}`}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              FAQ {itemIndex + 1}
            </p>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={() => {
                setItemKeys((current) =>
                  current.filter((_, index) => index !== itemIndex),
                );
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    items: block.props.items.filter(
                      (_, index) => index !== itemIndex,
                    ),
                  },
                });
              }}
            >
              Remove
            </button>
          </div>
          <TextInput
            label="Question"
            value={item.question}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: block.props.items.map((current, index) =>
                    index === itemIndex
                      ? { ...current, question: value }
                      : current,
                  ),
                },
              })
            }
          />
          <TextAreaInput
            label="Answer"
            value={item.answer}
            onChange={(value) =>
              onChange({
                ...block,
                props: {
                  ...block.props,
                  items: block.props.items.map((current, index) =>
                    index === itemIndex
                      ? { ...current, answer: value }
                      : current,
                  ),
                },
              })
            }
          />
        </div>
      ))}
      <button
        type="button"
        className={miniButtonClass}
        disabled={block.props.items.length >= FAQ_MAX_ITEMS}
        onClick={() => {
          const nextItems = appendBlankFaq(block.props.items);
          setItemKeys((current) => [
            ...current,
            ...createAddedEditorKeys(
              block.id,
              nextItems.length - block.props.items.length,
            ),
          ]);
          onChange({
            ...block,
            props: {
              ...block.props,
              items: nextItems,
            },
          });
        }}
      >
        {block.props.items.length >= FAQ_MAX_ITEMS
          ? `${FAQ_MAX_ITEMS} FAQ limit reached`
          : "Add FAQ"}
      </button>
    </div>
  );
}

function createInitialEditorKeys(blockId: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${blockId}-faq-${index}`);
}

function createAddedEditorKeys(blockId: string, count: number) {
  const uniqueSuffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return Array.from(
    { length: count },
    (_, index) => `${blockId}-faq-new-${uniqueSuffix}-${index}`,
  );
}
