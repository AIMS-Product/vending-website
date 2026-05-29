import { describe, expect, it } from "vitest";
import { buildResourcePageStructuredDataGraphs } from "./resource-page-structured-data";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

type BreadcrumbGraph = {
  "@type": "BreadcrumbList";
  itemListElement: Array<{ item: string }>;
};

type FaqGraph = {
  "@type": "FAQPage";
  mainEntity: unknown[];
};

function isBreadcrumbGraph(graph: unknown): graph is BreadcrumbGraph {
  return (
    typeof graph === "object" &&
    graph !== null &&
    "@type" in graph &&
    graph["@type" as keyof typeof graph] === "BreadcrumbList"
  );
}

function isFaqGraph(graph: unknown): graph is FaqGraph {
  return (
    typeof graph === "object" &&
    graph !== null &&
    "@type" in graph &&
    graph["@type" as keyof typeof graph] === "FAQPage"
  );
}

const page = {
  id: "page_1",
  slug: "ztest1",
  title: "Z Test One",
  target_keyword: "z test",
  published_content: {
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
                id: "faq_1",
                type: "faq",
                variant: "standard",
                props: {
                  heading: "Questions",
                  items: [
                    { question: "What is included?", answer: "Support." },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
  seo_title: "Z Test SEO",
  meta_description: "A page.",
  canonical_url: null,
  noindex: false,
  sitemap_enabled: true,
  structured_data_settings: {},
  published_at: "2026-05-06T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
} satisfies PublishedSeoPage;

describe("buildResourcePageStructuredDataGraphs", () => {
  it("uses absolute breadcrumb item URLs", () => {
    const breadcrumb =
      buildResourcePageStructuredDataGraphs(page).find(isBreadcrumbGraph);

    expect(breadcrumb?.itemListElement.map((item) => item.item)).toEqual([
      "https://www.vendingpreneurs.com/",
      "https://www.vendingpreneurs.com/resources",
      "https://www.vendingpreneurs.com/resources/ztest1",
    ]);
  });

  it("preserves FAQ structured data from visible FAQ blocks", () => {
    const faq = buildResourcePageStructuredDataGraphs(page).find(isFaqGraph);

    expect(faq?.mainEntity).toHaveLength(1);
  });

  it("honors explicit structured-data settings", () => {
    const graphs = buildResourcePageStructuredDataGraphs({
      ...page,
      structured_data_settings: { breadcrumb: false, faq: false },
    });

    expect(graphs.some(isBreadcrumbGraph)).toBe(false);
    expect(graphs.some(isFaqGraph)).toBe(false);
  });
});
