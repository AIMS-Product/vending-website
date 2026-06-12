import { describe, expect, it } from "vitest";
import { createEmptyPageContent } from "@/lib/page-builder/blocks";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import { derivePublishBlockerChecklist } from "./publish-blocker-checklist";
import { derivePublishVerdict } from "./publish-verdict";

const blankMeta = {
  slug: "",
  title: "",
  seoTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  noindex: false,
  sitemapEnabled: true,
  targetKeyword: "",
  structuredDataSettings: { breadcrumb: true, faq: true },
};

describe("derivePublishVerdict", () => {
  it("leads with a 'not ready' verdict and a fix-next drawn from the canonical checklist", () => {
    const summary = assessSeoReadiness(createEmptyPageContent(), blankMeta);
    const blockers = derivePublishBlockerChecklist({
      content: createEmptyPageContent(),
      summary,
      canPublish: false,
    });

    const verdict = derivePublishVerdict({ blockers, summary });

    expect(verdict.tone).toBe("blocked");
    expect(verdict.blockerCount).toBe(blockers.length);
    expect(verdict.headline).toContain("Not ready");
    expect(verdict.headline).toContain(String(blockers.length));
    // fix-next is the FIRST canonical checklist item's label — not a re-derived
    // string. This is the single-source-of-truth guarantee.
    expect(verdict.fixNext).toBe(blockers[0].label);
  });

  it("never re-derives its own blocker list — count tracks the passed checklist exactly", () => {
    const summary = assessSeoReadiness(createEmptyPageContent(), blankMeta);
    const blockers = derivePublishBlockerChecklist({
      content: createEmptyPageContent(),
      summary,
      canPublish: true, // no save-first item
    });
    const verdict = derivePublishVerdict({ blockers, summary });
    expect(verdict.blockerCount).toBe(blockers.length);
    // Trim the checklist and the verdict must follow it, proving it consumes
    // (does not compute) the list.
    const trimmed = blockers.slice(0, 1);
    expect(
      derivePublishVerdict({ blockers: trimmed, summary }).blockerCount,
    ).toBe(1);
  });

  it("shows an 'improvements' verdict when there are warnings but no blockers", () => {
    const verdict = derivePublishVerdict({
      blockers: [],
      summary: {
        ...emptySummary(),
        warnings: [warning("Use the target keyword in the title.")],
      },
    });
    expect(verdict.tone).toBe("improve");
    expect(verdict.headline.toLowerCase()).toContain("ready to publish");
    expect(verdict.fixNext).toBe("Use the target keyword in the title.");
  });

  it("shows a clean 'ready to publish' verdict with no fix-next when nothing remains", () => {
    const verdict = derivePublishVerdict({
      blockers: [],
      summary: emptySummary(),
    });
    expect(verdict.tone).toBe("ready");
    expect(verdict.fixNext).toBeNull();
    expect(verdict.headline).toBe("Ready to publish");
  });
});

function warning(message: string) {
  return {
    code: "w",
    category: "serp" as const,
    severity: "warning" as const,
    path: "seo_title",
    message,
  };
}

function emptySummary() {
  return {
    status: "strong" as const,
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
  };
}
