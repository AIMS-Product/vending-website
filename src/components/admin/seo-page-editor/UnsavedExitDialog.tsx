"use client";

import { useEffect, useRef } from "react";

// N6 / issue I5: the choice shown when the user tries to leave an editor whose
// auto-created draft was never explicitly saved. "Discard draft" deletes the
// orphan row; "Save draft" keeps it; "Keep editing" stays put. Escape and the
// backdrop both resolve to "Keep editing" (the safe, non-destructive default).
export type UnsavedExitChoice = "save" | "discard" | "stay";

export function UnsavedExitDialog({
  isDiscarding,
  errorMessage,
  onChoose,
}: {
  isDiscarding: boolean;
  errorMessage: string | null;
  onChoose: (choice: UnsavedExitChoice) => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusableElements = () => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
    };

    window.setTimeout(() => {
      const dialog = dialogRef.current;
      (focusableElements()[0] ?? dialog)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onChoose("stay");
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusableElements();
      if (items.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
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
  }, [onChoose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onChoose("stay");
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-exit-title"
        aria-describedby="unsaved-exit-body"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none"
      >
        <p className="text-xs font-semibold tracking-wider text-[#0b63f6] uppercase">
          Unsaved page
        </p>
        <h2
          id="unsaved-exit-title"
          className="mt-2 text-xl font-semibold text-slate-950"
        >
          Keep this draft before you leave?
        </h2>
        <p
          id="unsaved-exit-body"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          This page was started automatically but has not been saved yet. Save
          it to keep working on it later, or discard it to remove the unsaved
          draft.
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 grid gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#0b63f6] bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#074fca] focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDiscarding}
            onClick={() => onChoose("save")}
          >
            Save draft
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:ring-4 focus-visible:ring-red-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDiscarding}
            onClick={() => onChoose("discard")}
          >
            {isDiscarding ? "Discarding draft..." : "Discard draft"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDiscarding}
            onClick={() => onChoose("stay")}
          >
            Keep editing
          </button>
        </div>
      </section>
    </div>
  );
}
