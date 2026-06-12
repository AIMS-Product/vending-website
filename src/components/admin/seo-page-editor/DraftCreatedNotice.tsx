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
      className="fixed inset-x-0 bottom-4 z-[75] mx-auto flex w-[min(92vw,30rem)] items-start gap-3 rounded-xl border border-sky-200 bg-white px-4 py-3 shadow-xl ring-1 ring-black/5"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-[#0b63f6] ring-1 ring-sky-100"
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
        <p className="text-sm font-semibold text-slate-950">Draft created</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          This page is being saved automatically as a draft. If you leave before
          saving, you can choose to keep or discard it.
        </p>
      </div>
      <button
        type="button"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/25 focus-visible:outline-none"
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
