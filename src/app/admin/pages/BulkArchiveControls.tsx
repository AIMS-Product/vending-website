"use client";

import { useEffect, useState } from "react";
import { bulkArchiveSeoPagesFromList } from "@/app/admin/pages/actions";

// N19 / I20 item 1: minimal bulk archive. Checkboxes (name="ids") live in the
// server-rendered table rows and associate to this form via the shared
// `form="bulk-archive-form"` attribute. This client island just reflects the
// live selection count and confirms before submitting — no bulk framework.
const FORM_ID = "bulk-archive-form";

export function BulkArchiveControls({ returnTo }: { returnTo: string }) {
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;

    function updateCount() {
      const checked = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="ids"][form="${FORM_ID}"]:checked`,
      );
      setSelectedCount(checked.length);
    }

    updateCount();
    document.addEventListener("change", updateCount);
    return () => document.removeEventListener("change", updateCount);
  }, []);

  // The form must always exist in the DOM so the row checkboxes (which
  // associate via form="bulk-archive-form") resolve — we just collapse it to
  // nothing visible until at least one row is selected.
  return (
    <form
      id={FORM_ID}
      action={bulkArchiveSeoPagesFromList}
      hidden={selectedCount === 0}
      className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-5"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Archive ${selectedCount} selected ${
              selectedCount === 1 ? "page" : "pages"
            }? They will be removed from the active page list.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="text-sm font-semibold text-amber-900">
        {selectedCount} selected
      </span>
      <button
        type="submit"
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:outline-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        Archive selected
      </button>
    </form>
  );
}
