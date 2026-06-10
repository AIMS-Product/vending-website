import { describe, expect, it } from "vitest";
import {
  createEmptyPageContent,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import { derivePublishBlockerChecklist } from "./publish-blocker-checklist";

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

function blankSummary() {
  return assessSeoReadiness(createEmptyPageContent(), blankMeta);
}

function ctaMissingHrefContent(): PageContent {
  const cta = createPageBlock("cta", "cta-block-1") as Extract<
    PageBlock,
    { type: "cta" }
  >;
  // Isolate the missing-destination blocker: label + tracking present, href
  // empty.
  cta.props.label = "Get started";
  cta.props.trackingName = "cta_get_started";
  cta.props.href = "";

  return {
    version: 1,
    sections: [
      {
        id: "section-block-1",
        preset: "standard",
        background: "default",
        spacing: "standard",
        columns: [{ id: "column-block-1", width: "1/1", blocks: [cta] }],
      },
    ],
  };
}

describe("derivePublishBlockerChecklist", () => {
  it("returns one human-readable item for every blank-page blocker plus the save-first step", () => {
    const summary = blankSummary();
    const checklist = derivePublishBlockerChecklist({
      content: createEmptyPageContent(),
      summary,
      canPublish: false,
    });

    // Every readiness blocker is represented (single source of truth) plus the
    // synthesized "save the draft first" step that also blocks publish.
    const labels = checklist.map((item) => item.label);

    // No raw schema jargon in any label.
    for (const label of labels) {
      expect(label).not.toMatch(/_/);
      expect(label).not.toMatch(/blocks\.\d/);
      expect(label).not.toMatch(/missing_/);
    }

    // Save-first step is present when the page is not yet saved.
    expect(checklist.some((item) => item.target.kind === "save-first")).toBe(
      true,
    );

    // The known blank-page readiness rules each map to one item.
    const codes = checklist.map((item) => item.code);
    expect(codes).toContain("invalid_slug");
    expect(codes).toContain("missing_title");
    expect(codes).toContain("missing_seo_title");
    expect(codes).toContain("missing_meta_description");
    expect(codes).toContain("missing_conversion_block");

    // Human-readable labels, not field codes.
    const titleItem = checklist.find((item) => item.code === "missing_title");
    expect(titleItem?.label).toMatch(/page title/i);
  });

  it("routes a CTA destination blocker to the block-settings modal", () => {
    const content = ctaMissingHrefContent();
    const summary = assessSeoReadiness(content, {
      ...blankMeta,
      title: "Vending guide",
      seoTitle: "Vending guide",
      metaDescription:
        "A complete guide to running a vending machine business in 2026.",
      slug: "vending-guide",
    });

    const checklist = derivePublishBlockerChecklist({
      content,
      summary,
      canPublish: true,
    });

    const ctaHref = checklist.find((item) => item.code === "missing_cta_href");
    expect(ctaHref).toBeDefined();
    expect(ctaHref?.target.kind).toBe("block-modal");
    if (ctaHref?.target.kind === "block-modal") {
      expect(ctaHref.target.blockIndex).toBe(0);
    }
    expect(ctaHref?.label).toMatch(/destination/i);
  });

  it("preserves rule parity: the same readiness blockers in produce the same item set out (minus save-first)", () => {
    const content = ctaMissingHrefContent();
    const meta = {
      ...blankMeta,
      title: "Vending guide",
      seoTitle: "Vending guide",
      metaDescription:
        "A complete guide to running a vending machine business in 2026.",
      slug: "vending-guide",
    };
    const summary = assessSeoReadiness(content, meta);

    const checklist = derivePublishBlockerChecklist({
      content,
      summary,
      canPublish: true,
    });

    const ruleCodes = summary.blockers.map((blocker) => blocker.code).sort();
    const checklistRuleCodes = checklist
      .filter((item) => item.target.kind !== "save-first")
      .map((item) => item.code)
      .sort();

    // No rule added or removed: exact set parity between readiness blockers
    // and the rendered checklist (excluding the synthesized save-first step).
    expect(checklistRuleCodes).toEqual(ruleCodes);
  });

  it("omits the save-first step once the page is saved", () => {
    const summary = blankSummary();
    const checklist = derivePublishBlockerChecklist({
      content: createEmptyPageContent(),
      summary,
      canPublish: true,
    });

    expect(checklist.some((item) => item.target.kind === "save-first")).toBe(
      false,
    );
  });
});
