"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  triggerAriaLabel,
  triggerButtonClassName,
  triggerLabel = "Add page content",
  triggerVariant = "full",
}: {
  onAddBlock: (type: PageBlock["type"], variant?: BlockVariant) => void;
  triggerAriaLabel?: string;
  triggerButtonClassName?: string;
  triggerLabel?: string;
  triggerVariant?: "full" | "compact";
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

  const defaultTriggerButtonClass =
    triggerVariant === "compact"
      ? "inline-flex size-9 shrink-0 items-center justify-center rounded-ui-lg bg-white/10 text-ui-text-subtle transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-ui-accent/25 focus-visible:outline-none"
      : "flex w-full items-center justify-center gap-2 rounded-ui-lg border-2 border-dashed border-ui-line bg-ui-surface p-4 text-sm font-medium text-ui-text-subtle transition-all hover:border-ui-accent/50 hover:bg-ui-canvas hover:text-ui-accent focus-visible:ring-2 focus-visible:ring-ui-accent/35 focus-visible:outline-none";
  const triggerButtonClass =
    triggerButtonClassName ?? defaultTriggerButtonClass;

  const pickerDialog =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            role="presentation"
            className="bg-ui-text/20 fixed inset-0 z-[90] overflow-y-auto px-4 py-4 sm:px-6 lg:py-8"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsOpen(false);
              }
            }}
          >
            <dialog
              open
              className="animate-in fade-in slide-in-from-top-2 border-ui-line rounded-ui-lg bg-ui-surface shadow-ui-raised ring-ui-text/5 mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden border p-4 ring-1 sm:p-5"
              aria-modal="true"
              aria-labelledby="block-picker-title"
              aria-describedby="block-picker-description"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4
                    id="block-picker-title"
                    className="text-ui-text text-base font-semibold"
                  >
                    Add page content
                  </h4>
                  <p
                    id="block-picker-description"
                    className="text-ui-text-subtle mt-1 text-sm"
                  >
                    Choose what appears next on the page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close page content picker"
                  className="text-ui-text-subtle hover:bg-ui-line hover:text-ui-text-muted focus-visible:ring-ui-accent/35 rounded-ui inline-flex size-8 shrink-0 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                        className={`focus-visible:ring-ui-accent/35 rounded-ui-lg flex min-h-16 min-w-56 items-start gap-2.5 border px-3 py-2.5 text-left transition-all focus-visible:ring-2 focus-visible:outline-none lg:min-w-0 ${
                          isSelected
                            ? "border-ui-accent/65 ring-ui-accent/20 bg-ui-accent-soft shadow-ui ring-1"
                            : "border-ui-line hover:border-ui-line-strong hover:bg-ui-canvas bg-ui-surface shadow-ui"
                        }`}
                        onClick={() => selectBlockType(option.type)}
                      >
                        <span
                          className={`rounded-ui shadow-ui flex size-8 shrink-0 items-center justify-center ring-1 ring-inset ${
                            isSelected
                              ? "text-ui-accent ring-ui-accent/20 bg-ui-surface"
                              : "bg-ui-canvas text-ui-text-subtle ring-ui-line"
                          }`}
                          aria-hidden="true"
                        >
                          <BuilderGlyph name={option.type} />
                        </span>
                        <span className="min-w-0">
                          <span className="text-ui-text block text-sm font-semibold">
                            {option.label}
                          </span>
                          <span className="text-ui-text-subtle mt-0.5 line-clamp-2 block text-xs leading-5 sm:text-sm sm:leading-5">
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
                    className="border-ui-line rounded-ui-lg bg-ui-surface min-h-0 border p-4 sm:p-6 lg:overflow-y-auto"
                  >
                    <div className="mb-4">
                      <h5 className="text-ui-text text-sm font-semibold sm:text-base">
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
                          className="border-ui-line hover:border-ui-accent/50 focus-visible:ring-ui-accent/35 rounded-ui-lg bg-ui-surface shadow-ui hover:shadow-ui-raised overflow-hidden border text-left transition-all focus-visible:ring-2 focus-visible:outline-none"
                          onClick={() => {
                            onAddBlock(selectedOption.type, variant.id);
                            setIsOpen(false);
                          }}
                        >
                          <span
                            className="border-ui-line block h-44 overflow-hidden border-b bg-[#f5fbff] p-2 sm:h-52 sm:p-3"
                            aria-hidden="true"
                          >
                            <BlockVariantPreviewSkeleton
                              type={selectedOption.type}
                              variant={variant.id}
                            />
                          </span>
                          <span className="block px-4 py-3">
                            <span className="text-ui-text block text-sm font-semibold">
                              {variant.label}
                            </span>
                            <span className="text-ui-text-subtle mt-1 block text-sm leading-5">
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      {!isOpen && (
        <button
          type="button"
          data-testid="block-picker-trigger"
          aria-label={
            triggerVariant === "compact"
              ? (triggerAriaLabel ?? triggerLabel)
              : undefined
          }
          title={triggerVariant === "compact" ? triggerLabel : undefined}
          onClick={() => setIsOpen(true)}
          className={triggerButtonClass}
        >
          <PlusIcon />
          {triggerVariant === "compact" ? (
            <span className="sr-only">{triggerLabel}</span>
          ) : (
            triggerLabel
          )}
        </button>
      )}
      {pickerDialog}
    </div>
  );
}

function PlusIcon() {
  return (
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
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
