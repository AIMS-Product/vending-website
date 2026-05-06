import { describe, expect, it } from "vitest";
import {
  createEmptyPageContent,
  pageContentSchema,
  validatePageForPublish,
  type PageContent,
} from "./blocks";

const validContent: PageContent = {
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
              id: "block_text",
              type: "rich_text",
              variant: "default",
              props: {
                eyebrow: "Guide",
                heading: "Start with a plan",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "paragraph",
                      text: "Build the route with validated structured content.",
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
                caption: "",
                sourceRightsNotes: "Owned Vendingpreneurs campaign image.",
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

describe("page builder block schemas", () => {
  it("accepts the first-slice rich text, image, and CTA content tree", () => {
    const parsed = pageContentSchema.parse(validContent);

    expect(parsed.sections[0]?.columns[0]?.blocks).toHaveLength(3);
  });

  it("rejects arbitrary HTML rich text", () => {
    expect(() =>
      pageContentSchema.parse({
        ...validContent,
        sections: [
          {
            ...validContent.sections[0],
            columns: [
              {
                ...validContent.sections[0].columns[0],
                blocks: [
                  {
                    id: "block_text",
                    type: "rich_text",
                    variant: "default",
                    props: {
                      heading: "Unsafe",
                      body: "<script>alert('no')</script>",
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("reports publish gate issues for missing metadata, image rights, and CTA", () => {
    const noCta = {
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: [
                validContent.sections[0].columns[0].blocks[0],
                {
                  id: "block_image",
                  type: "image",
                  variant: "standard",
                  props: {
                    src: "/images/resource-guide.webp",
                    altText: "",
                    sourceRightsNotes: "",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = validatePageForPublish(noCta, {
      slug: "start-vending",
      title: "Start Vending",
      seoTitle: "",
      metaDescription: "",
      noindex: false,
      sitemapEnabled: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected publish validation to fail.");
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing_seo_title",
        "missing_meta_description",
        "missing_image_alt",
        "missing_media_rights",
        "missing_conversion_block",
      ]),
    );
  });

  it("creates an empty draft content object that validates for drafts only", () => {
    const content = createEmptyPageContent();

    expect(pageContentSchema.parse(content)).toEqual({
      version: 1,
      sections: [],
    });
    expect(
      validatePageForPublish(content, {
        slug: "empty-draft",
        title: "Empty Draft",
        seoTitle: "Empty Draft",
        metaDescription: "An empty draft should not publish.",
        noindex: false,
        sitemapEnabled: true,
      }).ok,
    ).toBe(false);
  });

  it("accepts the full core block set and treats lead forms as conversion blocks", () => {
    const content: PageContent = {
      version: 1,
      sections: [
        {
          id: "section_core",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            {
              id: "column_core",
              width: "1/1",
              blocks: [
                {
                  id: "block_hero",
                  type: "hero",
                  variant: "standard",
                  props: {
                    eyebrow: "Guide",
                    heading: "Build a vending route",
                    body: "Learn the steps.",
                    ctaLabel: "Apply now",
                    ctaHref: "/apply",
                    ctaTrackingName: "hero_apply",
                  },
                },
                {
                  id: "block_video",
                  type: "video",
                  variant: "standard",
                  props: {
                    title: "Watch the overview",
                    url: "https://example.com/video",
                    caption: "Program overview.",
                  },
                },
                {
                  id: "block_faq",
                  type: "faq",
                  variant: "standard",
                  props: {
                    heading: "FAQs",
                    items: [
                      {
                        question: "Can beginners start?",
                        answer: "Yes, with a plan and support.",
                      },
                    ],
                  },
                },
                {
                  id: "block_cards",
                  type: "card_grid",
                  variant: "standard",
                  props: {
                    heading: "What you get",
                    cards: [
                      {
                        title: "Plan",
                        body: "A route-building roadmap.",
                        href: "/apply",
                      },
                    ],
                  },
                },
                {
                  id: "block_proof",
                  type: "proof",
                  variant: "quote",
                  props: {
                    eyebrow: "Proof",
                    body: "The support helped me launch.",
                    name: "Operator",
                    context: "Student",
                  },
                },
                {
                  id: "block_form",
                  type: "lead_form",
                  variant: "standard",
                  props: {
                    heading: "Apply",
                    body: "Tell us about your goals.",
                    submitLabel: "Submit application",
                    trackingName: "resource_lead_form",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(pageContentSchema.parse(content)).toEqual(content);
    expect(
      validatePageForPublish(content, {
        slug: "start-vending",
        title: "Start Vending",
        seoTitle: "Start Vending",
        metaDescription: "Learn how to start vending.",
        noindex: false,
        sitemapEnabled: true,
      }).ok,
    ).toBe(true);
  });

  it("blocks lead form publishing without CTA tracking attribution", () => {
    const content = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_form",
          columns: [
            {
              id: "column_form",
              blocks: [
                {
                  id: "block_form",
                  type: "lead_form",
                  props: {
                    heading: "Apply",
                    body: "",
                    submitLabel: "Submit",
                    trackingName: "",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = validatePageForPublish(content, {
      slug: "start-vending",
      title: "Start Vending",
      seoTitle: "Start Vending",
      metaDescription: "Learn how to start vending.",
      noindex: false,
      sitemapEnabled: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected publish validation to fail.");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_lead_form_tracking" }),
      ]),
    );
  });

  it("blocks publishing with unknown internal links", () => {
    const content = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "cta"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        href: "/missing-internal-page",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });

    const result = validatePageForPublish(content, {
      slug: "start-vending",
      title: "Start Vending",
      seoTitle: "Start Vending",
      metaDescription: "Learn how to start vending.",
      noindex: false,
      sitemapEnabled: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected publish validation to fail.");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "broken_internal_link" }),
      ]),
    );
  });
});
