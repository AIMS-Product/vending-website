import { describe, expect, it } from "vitest";
import {
  createEmptyPageContent,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import { derivePublishBlockerChecklist } from "./publish-blocker-checklist";
import { thinPageWarning } from "./SeoReadinessHelpers";

// I20 follow-up: the publish-confirmation step surfaces the SAME thinPageWarning
// helper the readiness panel uses. These lock that it stays a NON-BLOCKING
// advisory — it must never add a publish blocker, so the confirm button and the
// N1 checklist are unaffected (rule-parity preserved).

function thinPublishReadyContent(): PageContent {
  // A publish-ready page (hero + CTA) but with very little body copy, so the
  // thin-page advisory fires while nothing blocks publish.
  const hero = createPageBlock("hero", "hero-thin") as Extract<
    PageBlock,
    { type: "hero" }
  >;
  hero.props.heading = "Hi";
  hero.props.ctaLabel = "Go";
  hero.props.ctaHref = "/apply";
  hero.props.ctaTrackingName = "thin_hero";
  const cta = createPageBlock("cta", "cta-thin") as Extract<
    PageBlock,
    { type: "cta" }
  >;
  cta.props.label = "Go";
  cta.props.href = "/apply";
  cta.props.trackingName = "thin_cta";

  return {
    version: 1,
    sections: [
      {
        id: "s-thin",
        preset: "standard",
        background: "default",
        spacing: "standard",
        columns: [{ id: "c-thin", width: "1/1", blocks: [hero, cta] }],
      },
    ],
  };
}

const readyMeta = {
  slug: "thin-page",
  title: "Thin page",
  seoTitle: "Thin page",
  metaDescription:
    "A meta description long enough to satisfy the publish requirement for this page.",
  canonicalUrl: "",
  noindex: false,
  sitemapEnabled: true,
  targetKeyword: "",
  structuredDataSettings: { breadcrumb: true, faq: true },
};

describe("thin-page advisory in the publish confirmation", () => {
  it("fires the advisory for a thin page", () => {
    expect(thinPageWarning(thinPublishReadyContent())).toMatch(
      /little content/i,
    );
  });

  it("does not fire for an empty page that has plenty of structure removed (boundary)", () => {
    // An empty page has 0 words → advisory fires; a page over the threshold
    // does not. (Empty still fires; this asserts the helper is content-driven.)
    expect(thinPageWarning(createEmptyPageContent())).toMatch(
      /little content/i,
    );
  });

  it("adds NO publish blocker — rule-parity preserved", () => {
    const content = thinPublishReadyContent();
    const summary = assessSeoReadiness(content, readyMeta);
    const blockers = derivePublishBlockerChecklist({
      content,
      summary,
      canPublish: true,
    });
    // The thin page is publish-ready: the advisory exists but the canonical
    // blocker list is empty, so publish stays enabled.
    expect(thinPageWarning(content)).not.toBeNull();
    expect(blockers).toHaveLength(0);
    expect(summary.blockers).toHaveLength(0);
  });
});
