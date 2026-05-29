"use client";

import { useEffect, useRef } from "react";
import type { PageBlock } from "@/lib/page-builder/blocks";
import {
  blockLabel,
  completionMessagesForBlock,
  type BuilderBlockEntry,
} from "@/lib/page-builder/editor-helpers";
import { BlockSidebarSettingsPanel } from "@/components/admin/seo-page-editor/BlockSettingsFields";

export function BlockSettingsModal({
  entry,
  onClose,
  onChange,
}: {
  entry: BuilderBlockEntry;
  onClose: () => void;
  onChange: (block: PageBlock) => void;
}) {
  const messages = completionMessagesForBlock(entry.block);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const fieldSelector =
      "textarea:not([disabled]), input:not([disabled]), select:not([disabled])";

    const focusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
    };

    window.setTimeout(() => {
      const dialog = dialogRef.current;
      const firstField = dialog?.querySelector<HTMLElement>(fieldSelector);
      const firstFocusable = focusableElements()[0];
      (firstField ?? firstFocusable ?? dialog)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const items = focusableElements();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-settings-modal-title"
        tabIndex={-1}
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Block settings
            </p>
            <h3
              id="block-settings-modal-title"
              className="mt-1 text-lg font-semibold text-slate-950"
            >
              {blockLabel(entry.block.type)} {entry.blockNumber}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Section {entry.sectionNumber}, column {entry.columnNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                messages.length > 0
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {messages.length > 0 ? "Needs content" : "Ready"}
            </span>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
              aria-label="Close block settings"
              title="Close block settings"
              onClick={onClose}
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
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <BlockSidebarSettingsPanel block={entry.block} onChange={onChange} />
          {messages.length > 0 && (
            <div className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none"
            onClick={onClose}
          >
            Apply settings
          </button>
        </div>
      </section>
    </div>
  );
}
