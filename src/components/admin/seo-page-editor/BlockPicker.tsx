"use client";

import { useEffect, useRef, useState } from "react";
import { BlockVariantPreviewSkeleton } from "@/components/admin/SeoPageBlockVariantPreview";
import type { PageBlock } from "@/lib/page-builder/blocks";
import {
  blockPickerOptions,
  type BlockVariant,
} from "@/lib/page-builder/block-options";
import { articleFor } from "@/lib/page-builder/editor-helpers";
import { BuilderGlyph } from "@/components/admin/seo-page-editor/BuilderEditorUi";

export function BlockPicker({
  onAddBlock,
}: {
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PageBlock["type"]>(
    blockPickerOptions[0]?.type ?? "rich_text",
  );
  const variantPanelRef = useRef<HTMLDivElement | null>(null);
  const selectedOption =
    blockPickerOptions.find((option) => option.type === selectedType) ??
    blockPickerOptions[0];

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function selectBlockType(type: PageBlock["type"]) {
    setSelectedType(type);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => {
        variantPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 0);
    }
  }

  return (
    <div className="relative">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 transition-all hover:border-[#0b63f6]/50 hover:bg-slate-50 hover:text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add page content
        </button>
      ) : (
        <div
          role="presentation"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/20 px-4 py-4 sm:px-6 lg:py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <dialog
            open
            className="animate-in fade-in slide-in-from-top-2 mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 sm:p-5"
            aria-modal="true"
            aria-labelledby="block-picker-title"
            aria-describedby="block-picker-description"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4
                  id="block-picker-title"
                  className="text-base font-semibold text-slate-950"
                >
                  Add page content
                </h4>
                <p
                  id="block-picker-description"
                  className="mt-1 text-sm text-slate-500"
                >
                  Choose what appears next on the page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close page content picker"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[250px_minmax(0,1fr)] lg:overflow-hidden">
              <div className="flex min-h-[5.25rem] gap-2 overflow-x-auto pb-2 lg:grid lg:max-h-full lg:min-h-0 lg:gap-2 lg:overflow-x-visible lg:overflow-y-auto lg:pr-1 lg:pb-0">
                {blockPickerOptions.map((option) => {
                  const isSelected = option.type === selectedOption.type;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      data-testid="block-picker-type"
                      data-block-picker-type={option.type}
                      className={`flex min-h-16 min-w-56 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none lg:min-w-0 ${
                        isSelected
                          ? "border-[#0b63f6]/65 bg-[#f7faff] shadow-sm ring-1 ring-[#0b63f6]/20"
                          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => selectBlockType(option.type)}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 ring-inset ${
                          isSelected
                            ? "bg-white text-[#0b63f6] ring-[#0b63f6]/20"
                            : "bg-slate-50 text-slate-500 ring-slate-200"
                        }`}
                        aria-hidden="true"
                      >
                        <BuilderGlyph name={option.type} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-slate-500 sm:text-sm sm:leading-5">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedOption && (
                <div
                  ref={variantPanelRef}
                  className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:overflow-y-auto"
                >
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-slate-950 sm:text-base">
                      Choose {articleFor(selectedOption.label)}{" "}
                      {selectedOption.label.toLowerCase()} layout
                    </h5>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedOption.variants.map((variant) => (
                      <button
                        key={`${selectedOption.type}-${variant.id}`}
                        type="button"
                        data-testid="block-picker-variant"
                        data-block-picker-type={selectedOption.type}
                        data-block-picker-variant={variant.id}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all hover:border-[#0b63f6]/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                        onClick={() => {
                          onAddBlock(selectedOption.type, variant.id);
                          setIsOpen(false);
                        }}
                      >
                        <span
                          className="block h-44 overflow-hidden border-b border-slate-200 bg-[#f5fbff] p-2 sm:h-52 sm:p-3"
                          aria-hidden="true"
                        >
                          <BlockVariantPreviewSkeleton
                            type={selectedOption.type}
                            variant={variant.id}
                          />
                        </span>
                        <span className="block px-4 py-3">
                          <span className="block text-sm font-semibold text-slate-900">
                            {variant.label}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">
                            {variant.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
