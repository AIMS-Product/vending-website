import type { PublishBlockerChecklistItem } from "@/components/admin/seo-page-editor/publish-blocker-checklist";
import type { SeoReadinessSummary } from "@/lib/page-builder/seo-readiness";

// The leading verdict for the SEO panel. It SUMMARIZES the single canonical
// publish-blocker checklist (N1) and the readiness warnings — it never derives
// its own blocker list. The blocker count and "fix next" come straight from the
// passed-in checklist, so the verdict can never disagree with the checklist,
// chip, or disabled Publish button.
export type PublishVerdict = {
  tone: "blocked" | "improve" | "ready";
  // Short headline, e.g. "Not ready — 3 things to fix" / "Ready to publish".
  headline: string;
  // The single next action to take, or null when nothing is required.
  fixNext: string | null;
  blockerCount: number;
  warningCount: number;
};

function pluralizeThings(count: number): string {
  return count === 1 ? "1 thing to fix" : `${count} things to fix`;
}

export function derivePublishVerdict({
  blockers,
  summary,
}: {
  blockers: PublishBlockerChecklistItem[];
  summary: SeoReadinessSummary;
}): PublishVerdict {
  const blockerCount = blockers.length;
  const warningCount = summary.warnings.length;

  if (blockerCount > 0) {
    return {
      tone: "blocked",
      headline: `Not ready — ${pluralizeThings(blockerCount)}`,
      fixNext: blockers[0].label,
      blockerCount,
      warningCount,
    };
  }

  if (warningCount > 0) {
    return {
      tone: "improve",
      headline:
        warningCount === 1
          ? "Ready to publish — 1 improvement suggested"
          : `Ready to publish — ${warningCount} improvements suggested`,
      fixNext: summary.warnings[0].message,
      blockerCount,
      warningCount,
    };
  }

  return {
    tone: "ready",
    headline: "Ready to publish",
    fixNext: null,
    blockerCount,
    warningCount,
  };
}
