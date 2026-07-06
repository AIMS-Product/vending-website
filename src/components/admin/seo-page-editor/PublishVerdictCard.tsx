"use client";

import type { PublishBlockerChecklistItem } from "@/components/admin/seo-page-editor/publish-blocker-checklist";
import { derivePublishVerdict } from "@/components/admin/seo-page-editor/publish-verdict";
import {
  PUBLISH_BLOCKER_LIST_ID,
  focusPublishBlockerChecklist,
} from "@/components/admin/seo-page-editor/PublishBlockerChecklist";
import type { SeoReadinessSummary } from "@/lib/page-builder/seo-readiness";

// The leading verdict for the SEO panel.
//
// I11: when the page is BLOCKED, the full "N to fix" detail lives in exactly one
// place — the PublishBlockerChecklist ("Before you can publish"). This card must
// not restate that count as a second headline + its own per-blocker deep link
// (personas flagged the duplication as noise). So in the blocked tone it renders
// only a COMPACT status chip that scrolls to the canonical checklist. The
// blocked-publish gate and the checklist's per-fix deep links are untouched.
//
// The improve/ready tones (warnings / "ready to publish") are NOT duplicated
// anywhere else, so those keep the full headline + fix-next summary.
export function PublishVerdictCard({
  blockers,
  summary,
}: {
  blockers: PublishBlockerChecklistItem[];
  summary: SeoReadinessSummary;
}) {
  const verdict = derivePublishVerdict({ blockers, summary });

  if (verdict.tone === "blocked") {
    return <BlockedVerdictChip blockerCount={verdict.blockerCount} />;
  }

  const toneClass =
    verdict.tone === "improve"
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
            verdict.tone === "improve" ? "bg-sky-500" : "bg-emerald-500"
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
    </section>
  );
}

// Compact blocked-state summary. It states that publishing is blocked and links
// to the canonical checklist — it deliberately does NOT list the blockers or
// deep-link to individual fixes, so the full "N to fix" detail stays in exactly
// one surface.
function BlockedVerdictChip({ blockerCount }: { blockerCount: number }) {
  return (
    <section
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full bg-amber-500"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">Not ready to publish</h3>
      </div>
      <button
        type="button"
        aria-controls={PUBLISH_BLOCKER_LIST_ID}
        onClick={() => focusPublishBlockerChecklist()}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 focus-visible:ring-4 focus-visible:ring-amber-200 focus-visible:outline-none"
      >
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900 ring-1 ring-amber-200 ring-inset">
          {blockerCount}
        </span>
        View checklist
      </button>
    </section>
  );
}
