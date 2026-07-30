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
      className="bg-ui-text/40 fixed inset-0 z-[90] flex items-center justify-center p-4 backdrop-blur-sm"
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
        className="border-ui-line rounded-ui-lg bg-ui-surface shadow-ui-raised w-full max-w-md border p-6 focus:outline-none"
      >
        <p className="text-ui-accent text-xs font-semibold tracking-wider uppercase">
          Unsaved page
        </p>
        <h2
          id="unsaved-exit-title"
          className="text-ui-text mt-2 text-xl font-semibold"
        >
          Keep this draft before you leave?
        </h2>
        <p
          id="unsaved-exit-body"
          className="text-ui-text-muted mt-2 text-sm leading-6"
        >
          This page was started automatically but has not been saved yet. Save
          it to keep working on it later, or discard it to remove the unsaved
          draft.
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-ui-lg bg-ui-bad-fill text-ui-bad-ink ring-ui-bad-fill mt-4 px-3 py-2 text-sm font-medium ring-1"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 grid gap-2">
          <button
            type="button"
            className="border-ui-accent bg-ui-accent focus-visible:ring-ui-accent/20 rounded-ui-lg shadow-ui hover:bg-ui-accent-hover inline-flex min-h-11 items-center justify-center border px-4 text-sm font-semibold text-white transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDiscarding}
            onClick={() => onChoose("save")}
          >
            Save draft
          </button>
          <button
            type="button"
            className="rounded-ui-lg border-ui-bad/25 bg-ui-surface text-ui-bad-ink shadow-ui hover:border-ui-bad/25 hover:bg-ui-bad-fill focus-visible:ring-ui-bad/20 inline-flex min-h-11 items-center justify-center border px-4 text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDiscarding}
            onClick={() => onChoose("discard")}
          >
            {isDiscarding ? "Discarding draft..." : "Discard draft"}
          </button>
          <button
            type="button"
            className="border-ui-line text-ui-text-muted hover:border-ui-line-strong hover:bg-ui-canvas focus-visible:ring-ui-accent/20 rounded-ui-lg bg-ui-surface shadow-ui inline-flex min-h-11 items-center justify-center border px-4 text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
