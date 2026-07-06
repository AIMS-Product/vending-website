import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishVerdictCard } from "./PublishVerdictCard";
import { PUBLISH_BLOCKER_LIST_ID } from "./PublishBlockerChecklist";
import type { PublishBlockerChecklistItem } from "./publish-blocker-checklist";
import type { SeoReadinessSummary } from "@/lib/page-builder/seo-readiness";

// I11: the "N to fix" publish-readiness detail must live in exactly ONE surface
// (the PublishBlockerChecklist). The verdict card, when blocked, must degrade to
// a compact status chip that points at the checklist — never a second full
// "N things to fix" headline with its own per-blocker deep link.

function blocker(code: string, label: string): PublishBlockerChecklistItem {
  return {
    code,
    label,
    detail: `${label} detail`,
    target: { kind: "field", elementId: `${code}-field` },
  };
}

function summaryWith(
  overrides: Partial<SeoReadinessSummary> = {},
): SeoReadinessSummary {
  return {
    status: "strong",
    label: "Strong",
    blockers: [],
    warnings: [],
    opportunities: [],
    categories: [],
    evidence: [],
    metrics: {
      visibleWordCount: 0,
      blockCount: 0,
      internalLinkCount: 0,
      imageCount: 0,
      faqItemCount: 0,
    },
    ...overrides,
  };
}

describe("PublishVerdictCard (issue I11)", () => {
  it("renders only a compact chip that links to the checklist when blocked", () => {
    const blockers = [
      blocker("missing_title", "Add a page title"),
      blocker("missing_meta_description", "Add a meta description"),
    ];

    const html = renderToStaticMarkup(
      <PublishVerdictCard blockers={blockers} summary={summaryWith()} />,
    );

    // Compact chip: states blocked + count + a link into the canonical checklist.
    expect(html).toContain("Not ready to publish");
    expect(html).toContain("View checklist");
    expect(html).toContain(`aria-controls="${PUBLISH_BLOCKER_LIST_ID}"`);
    expect(html).toContain(">2<");

    // It must NOT restate the full readiness detail: no "N things to fix"
    // headline duplicate and no per-blocker deep link / blocker labels.
    expect(html).not.toContain("things to fix");
    expect(html).not.toContain("Take me there");
    expect(html).not.toContain("Fix next");
    expect(html).not.toContain("Add a page title");
    expect(html).not.toContain("Add a meta description");
  });

  it("keeps the full improvement summary when there are only warnings", () => {
    const html = renderToStaticMarkup(
      <PublishVerdictCard
        blockers={[]}
        summary={summaryWith({
          warnings: [
            {
              code: "w",
              category: "serp",
              severity: "warning",
              path: "seo_title",
              message: "Use the target keyword in the title.",
            },
          ],
        })}
      />,
    );

    expect(html.toLowerCase()).toContain("ready to publish");
    expect(html).toContain("Fix next");
    expect(html).toContain("Use the target keyword in the title.");
    // Not a blocked chip.
    expect(html).not.toContain("View checklist");
  });

  it("renders a clean ready verdict when nothing remains", () => {
    const html = renderToStaticMarkup(
      <PublishVerdictCard blockers={[]} summary={summaryWith()} />,
    );

    expect(html).toContain("Ready to publish");
    expect(html).not.toContain("View checklist");
    expect(html).not.toContain("Fix next");
  });
});
