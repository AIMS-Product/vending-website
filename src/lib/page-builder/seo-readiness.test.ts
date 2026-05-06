import { describe, expect, it } from "vitest";
import { type PageContent } from "./blocks";
import { assessSeoReadiness } from "./seo-readiness";

const baseContent: PageContent = {
  version: 1,
  sections: [
    {
      id: "section_1",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_1",
          width: "1/1",
          blocks: [
            {
              id: "block_hero",
              type: "hero",
              variant: "standard",
              props: {
                eyebrow: "Vending route guide",
                heading:
                  "Start a vending machine business with a real route plan",
                body: "This vending machine business guide explains how to evaluate locations, plan startup costs, compare support options, and build a route that can convert interest into applications.",
                ctaLabel: "Apply now",
                ctaHref: "/apply",
                ctaTrackingName: "hero_apply",
              },
            },
            {
              id: "block_text",
              type: "rich_text",
              variant: "default",
              props: {
                eyebrow: "Planning",
                heading: "What to check before you buy machines",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "paragraph",
                      text: "A vending machine business works best when the operator understands traffic patterns, location agreements, refill cadence, product mix, and how long it can take to reach stable route performance.",
                    },
                    {
                      type: "heading",
                      level: 2,
                      text: "Location quality matters more than machine count",
                    },
                    {
                      type: "paragraph",
                      text: "The stronger page should help readers compare real tradeoffs and choose the next step without needing another search.",
                    },
                  ],
                },
              },
            },
            {
              id: "block_image",
              type: "image",
              variant: "standard",
              props: {
                src: "/images/resource-guide.webp",
                altText: "Operator reviewing vending route locations",
                caption: "Planning a route before buying machines.",
                sourceRightsNotes: "Owned Vendingpreneurs campaign image.",
              },
            },
            {
              id: "block_faq",
              type: "faq",
              variant: "standard",
              props: {
                heading: "Common vending questions",
                items: [
                  {
                    question: "Can beginners start a vending machine business?",
                    answer:
                      "Yes, but they should understand location quality, machine selection, and route operations before investing.",
                  },
                ],
              },
            },
            {
              id: "block_cta",
              type: "cta",
              variant: "primary",
              props: {
                label: "Apply for vending support",
                href: "/apply",
                trackingName: "resource_apply_cta",
              },
            },
          ],
        },
      ],
    },
  ],
};

const baseMeta = {
  slug: "start-vending-machine-business",
  title: "Start a vending machine business",
  targetKeyword: "vending machine business",
  seoTitle: "Start a vending machine business with route support",
  metaDescription:
    "Learn how to start a vending machine business with location planning, machine selection, route operations, and support options.",
  canonicalUrl: null,
  noindex: false,
  sitemapEnabled: true,
};

describe("assessSeoReadiness", () => {
  it("returns evidence-backed readiness without claiming live rankings", () => {
    const summary = assessSeoReadiness(baseContent, baseMeta);

    expect(summary.blockers).toEqual([]);
    expect(summary.metrics.blockCount).toBeGreaterThan(0);
    expect(summary.evidence).toEqual(
      expect.arrayContaining(["Block tree schema validates."]),
    );
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("ranking");
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("rank ");
  });

  it("maps existing publish failures into hard readiness blockers", () => {
    const summary = assessSeoReadiness(baseContent, {
      ...baseMeta,
      slug: "Bad Slug",
      seoTitle: "",
      metaDescription: "",
      noindex: true,
      sitemapEnabled: true,
    });

    expect(summary.status).toBe("blocked");
    expect(summary.blockers.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "invalid_slug",
        "missing_seo_title",
        "missing_meta_description",
        "sitemap_noindex_conflict",
      ]),
    );
  });

  it("treats keyword alignment as guidance, not a publish blocker", () => {
    const summary = assessSeoReadiness(baseContent, {
      ...baseMeta,
      targetKeyword: "office coffee service",
    });

    expect(summary.blockers).toEqual([]);
    expect(summary.warnings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "target_keyword_missing_from_title",
        "target_keyword_missing_from_visible_copy",
      ]),
    );
  });

  it("reports unknown internal links as link blockers", () => {
    const content: PageContent = {
      ...baseContent,
      sections: [
        {
          ...baseContent.sections[0],
          columns: [
            {
              ...baseContent.sections[0].columns[0],
              blocks: baseContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "cta"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        href: "/unknown-resource",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    };

    const summary = assessSeoReadiness(content, baseMeta);

    expect(summary.status).toBe("blocked");
    expect(summary.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken_internal_link",
          category: "links",
        }),
      ]),
    );
  });

  it("surfaces optional SEO improvements separately from blockers", () => {
    const content: PageContent = {
      version: 1,
      sections: [
        {
          id: "section_1",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            {
              id: "column_1",
              width: "1/1",
              blocks: [
                {
                  id: "block_hero",
                  type: "hero",
                  variant: "standard",
                  props: {
                    eyebrow: "",
                    heading: "Vending machine business basics",
                    body: "A short guide to vending machine business planning.",
                    ctaLabel: "Apply now",
                    ctaHref: "/apply",
                    ctaTrackingName: "hero_apply",
                  },
                },
                {
                  id: "block_cta",
                  type: "cta",
                  variant: "primary",
                  props: {
                    label: "Apply now",
                    href: "/apply",
                    trackingName: "resource_apply_cta",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const summary = assessSeoReadiness(content, baseMeta);

    expect(summary.blockers).toEqual([]);
    expect(summary.warnings.map((finding) => finding.code)).toContain(
      "content_depth_light",
    );
    expect(summary.opportunities.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "missing_faq_opportunity",
        "missing_relevant_image",
      ]),
    );
  });
});
