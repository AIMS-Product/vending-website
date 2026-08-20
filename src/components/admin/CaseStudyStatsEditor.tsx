"use client";

import { adminCardClass, adminInputClass } from "@/components/admin/AdminUi";
import type { CaseStudyStat } from "@/lib/case-studies/stats";

// Small add/remove row editor for the `stats` jsonb column
// ([{label,value}]). Deliberately not a generic array-field builder — this
// collection has exactly one repeatable shape. Empty rows are dropped
// server-side (case-studies actions.ts -> parseStats), so a half-filled row
// left on the page is harmless.

export function CaseStudyStatsEditor({
  rows,
  onChange,
}: {
  rows: CaseStudyStat[];
  onChange: (rows: CaseStudyStat[]) => void;
}) {
  function updateRow(index: number, patch: Partial<CaseStudyStat>) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function addRow() {
    onChange([...rows, { label: "", value: "" }]);
  }

  return (
    <div className={adminCardClass}>
      <h2 className="text-ui-text text-sm font-semibold">Result stats</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Short label/value pairs shown on the story card, e.g. &ldquo;Monthly
        revenue&rdquo; / &ldquo;$4,200&rdquo;.
      </p>
      <div className="mt-4 grid gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-start gap-2">
            <input
              aria-label={`Stat ${index + 1} label`}
              placeholder="Label"
              value={row.label}
              onChange={(event) =>
                updateRow(index, { label: event.target.value })
              }
              className={`${adminInputClass} mt-0 flex-1`}
            />
            <input
              aria-label={`Stat ${index + 1} value`}
              placeholder="Value"
              value={row.value}
              onChange={(event) =>
                updateRow(index, { value: event.target.value })
              }
              className={`${adminInputClass} mt-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove stat ${index + 1}`}
              className="text-ui-text-subtle hover:bg-ui-bad/5 hover:text-ui-bad focus-visible:ring-ui-accent/35 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-ui transition focus-visible:ring-2 focus-visible:outline-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-ui-accent hover:text-ui-accent-hover focus-visible:ring-ui-accent/35 mt-3 inline-flex items-center gap-1.5 rounded-ui text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add stat
      </button>
    </div>
  );
}
