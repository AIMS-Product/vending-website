"use client";

import { useState } from "react";

// N6 / issue I5: a visible notice shown once the editor auto-creates a draft
// row (S3b) for a brand-new page. It tells the user the in-progress page is
// being kept automatically and that leaving will offer to save or discard it,
// so the auto-created row is never a silent surprise.
export function DraftCreatedNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className="rounded-ui-lg border-ui-accent/25 bg-ui-surface shadow-ui-raised fixed inset-x-0 bottom-4 z-[75] mx-auto flex w-[min(92vw,30rem)] items-start gap-3 border px-4 py-3 ring-1 ring-black/5"
    >
      <span
        aria-hidden="true"
        className="text-ui-accent bg-ui-accent-soft ring-ui-accent-soft mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ui-text text-sm font-semibold">Draft created</p>
        <p className="text-ui-text-muted mt-0.5 text-xs leading-5">
          This page is being saved automatically as a draft. If you leave before
          saving, you can choose to keep or discard it.
        </p>
      </div>
      <button
        type="button"
        className="text-ui-text-subtle hover:bg-ui-line hover:text-ui-text-muted focus-visible:ring-ui-accent/25 inline-flex size-7 shrink-0 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Dismiss draft created notice"
        onClick={() => setDismissed(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
