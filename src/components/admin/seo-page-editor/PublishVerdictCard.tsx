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
      ? "border-ui-accent/25 bg-ui-accent-soft text-ui-accent"
      : "border-ui-ok/25 bg-ui-ok-fill text-ui-ok-ink";

  return (
    <section
      aria-live="polite"
      className={`rounded-ui-lg border p-4 ${toneClass}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${
            verdict.tone === "improve" ? "bg-ui-accent" : "bg-ui-ok"
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
      className="rounded-ui-lg border-ui-warn/25 bg-ui-warn-fill text-ui-warn-ink flex flex-wrap items-center justify-between gap-2 border p-4"
    >
      <div className="flex items-center gap-2">
        <span
          className="bg-ui-warn size-2 shrink-0 rounded-full"
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold">Not ready to publish</h3>
      </div>
      <button
        type="button"
        aria-controls={PUBLISH_BLOCKER_LIST_ID}
        onClick={() => focusPublishBlockerChecklist()}
        className="rounded-ui border-ui-warn/25 bg-ui-surface text-ui-warn-ink shadow-ui hover:bg-ui-warn-fill focus-visible:ring-ui-warn/25 inline-flex min-h-8 items-center gap-1.5 border px-3 text-xs font-semibold transition focus-visible:ring-4 focus-visible:outline-none"
      >
        <span className="rounded-ui bg-ui-warn-fill text-ui-warn-ink ring-ui-warn/25 px-1.5 py-0.5 text-[11px] ring-1 ring-inset">
          {blockerCount}
        </span>
        View checklist
      </button>
    </section>
  );
}
