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
      className="bg-ui-text/35 fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm"
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
        className="border-ui-line rounded-ui-lg bg-ui-surface shadow-ui-raised flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden border focus:outline-none"
      >
        <div className="border-ui-line flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-ui-text-subtle text-xs font-semibold tracking-wider uppercase">
              Block settings
            </p>
            <h3
              id="block-settings-modal-title"
              className="text-ui-text mt-1 text-lg font-semibold"
            >
              {blockLabel(entry.block.type)} {entry.blockNumber}
            </h3>
            <p className="text-ui-text-subtle mt-1 text-xs font-medium">
              Section {entry.sectionNumber}, column {entry.columnNumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-ui px-2.5 py-1 text-xs font-semibold ${
                messages.length > 0
                  ? "bg-ui-warn-fill text-ui-warn-ink ring-ui-warn/25 ring-1"
                  : "bg-ui-ok-fill text-ui-ok-ink ring-ui-ok/25 ring-1"
              }`}
            >
              {messages.length > 0 ? "Needs content" : "Ready"}
            </span>
            <button
              type="button"
              className="border-ui-line text-ui-text-subtle hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/20 bg-ui-surface shadow-ui inline-flex size-9 items-center justify-center rounded-full border transition focus-visible:ring-4 focus-visible:outline-none"
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
            <div className="rounded-ui-lg bg-ui-warn-fill text-ui-warn-ink ring-ui-warn-fill mt-5 px-3 py-2 text-xs leading-5 ring-1">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
        </div>

        <div className="border-ui-line bg-ui-canvas flex shrink-0 justify-end border-t px-5 py-4">
          <button
            type="button"
            className="focus-visible:ring-ui-accent/20 rounded-ui-lg bg-ui-text shadow-ui hover:bg-ui-text inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold text-white transition focus-visible:ring-4 focus-visible:outline-none"
            onClick={onClose}
          >
            Apply settings
          </button>
        </div>
      </section>
    </div>
  );
}
