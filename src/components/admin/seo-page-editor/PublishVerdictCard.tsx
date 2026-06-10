"use client";

import type { PublishBlockerChecklistItem } from "@/components/admin/seo-page-editor/publish-blocker-checklist";
import { derivePublishVerdict } from "@/components/admin/seo-page-editor/publish-verdict";
import type { SeoReadinessSummary } from "@/lib/page-builder/seo-readiness";

// The leading verdict for the SEO panel. Summarizes the canonical blocker
// checklist (N1) + readiness warnings — it does not render a second list. The
// "Fix next" action reuses the same focus handler the checklist items use.
export function PublishVerdictCard({
  blockers,
  summary,
  onFixNext,
}: {
  blockers: PublishBlockerChecklistItem[];
  summary: SeoReadinessSummary;
  onFixNext: (item: PublishBlockerChecklistItem) => void;
}) {
  const verdict = derivePublishVerdict({ blockers, summary });

  const toneClass =
    verdict.tone === "blocked"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : verdict.tone === "improve"
        ? "border-sky-200 bg-sky-50 text-sky-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <section
      aria-live="polite"
      className={`rounded-xl border p-4 ${toneClass}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${
            verdict.tone === "blocked"
              ? "bg-amber-500"
              : verdict.tone === "improve"
                ? "bg-sky-500"
                : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">{verdict.headline}</h3>
      </div>
      {verdict.fixNext ? (
        <p className="mt-1.5 text-sm leading-5">
          <span className="font-semibold">Fix next:</span> {verdict.fixNext}
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-5 opacity-80">
          Review the preview, then publish when you&apos;re ready.
        </p>
      )}
      {verdict.tone === "blocked" && blockers[0] ? (
        <button
          type="button"
          onClick={() => onFixNext(blockers[0])}
          className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 focus-visible:ring-4 focus-visible:ring-amber-200 focus-visible:outline-none"
        >
          Take me there
        </button>
      ) : null}
    </section>
  );
}
