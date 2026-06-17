import { describe, expect, it } from "vitest";
import {
  CARD_GRID_MAX_CARDS,
  FAQ_MAX_ITEMS,
  blockRegistry,
  cardGridLinkLabel,
  collectPageInternalLinks,
  createEmptyPageContent,
  pageContentSchema,
  pageChromeSettings,
  richTextDocumentPlainText,
  validatePageContent,
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
  it("keeps every block type on three to four supported variants", () => {
    for (const [type, config] of Object.entries(blockRegistry)) {
      expect(
        config.allowedVariants.length,
        `${type} should expose a small variant set`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        config.allowedVariants.length,
        `${type} should stay scannable in the editor`,
      ).toBeLessThanOrEqual(4);
    }
  });

  it("accepts the first-slice rich text, image, and CTA content tree", () => {
    const parsed = pageContentSchema.parse(validContent);

    expect(parsed.sections[0]?.columns[0]?.blocks).toHaveLength(3);
  });

  it("accepts optional video thumbnail overrides", () => {
    const parsed = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_video",
          columns: [
            {
              id: "column_video",
              blocks: [
                {
                  id: "block_video",
                  type: "video",
                  props: {
                    assetId: "11111111-1111-4111-8111-111111111111",
                    title: "Route planning walkthrough",
                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    thumbnailAssetId: "22222222-2222-4222-8222-222222222222",
                    thumbnailSrc: "/images/video-thumbnail.webp",
                    thumbnailAltText: "Route planning worksheet preview",
                    caption: "Watch before placing your first machine.",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const block = parsed.sections[0]?.columns[0]?.blocks[0];
    expect(block?.type).toBe("video");
    if (block?.type !== "video") throw new Error("Expected video block.");
    expect(block.props.thumbnailSrc).toBe("/images/video-thumbnail.webp");
  });

  it("accepts optional proof media props and keeps legacy proof blocks valid", () => {
    const proofContent = (props: Record<string, unknown>) => ({
      version: 1,
      sections: [
        {
          id: "section_proof",
          columns: [
            {
              id: "column_proof",
              blocks: [
                {
                  id: "block_proof",
                  type: "proof",
                  variant: "quote",
                  props,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      pageContentSchema.safeParse(
        proofContent({
          eyebrow: "Proof",
          body: "The support helped me launch.",
          name: "Operator",
          context: "Student",
        }),
      ).success,
    ).toBe(true);

    const withMedia = pageContentSchema.parse(
      proofContent({
        body: "Cut restock time by 40%.",
        assetId: "33333333-3333-4333-8333-333333333333",
        mediaSrc: "/images/proof-operator.webp",
        mediaAltText: "Operator restocking a vending machine",
      }),
    );
    const block = withMedia.sections[0]?.columns[0]?.blocks[0];
    expect(block?.type).toBe("proof");
    if (block?.type !== "proof") throw new Error("Expected proof block.");
    expect(block.props.assetId).toBe("33333333-3333-4333-8333-333333333333");
    expect(block.props.mediaSrc).toBe("/images/proof-operator.webp");
    expect(block.props.mediaAltText).toBe(
      "Operator restocking a vending machine",
    );

    expect(
      pageContentSchema.safeParse(
        proofContent({
          body: "Unsafe media.",
          mediaSrc: "javascript:alert(1)",
        }),
      ).success,
    ).toBe(false);
  });

  it("caps card grid blocks at the configured card limit", () => {
    const contentWithCardCount = (count: number): PageContent => ({
      version: 1,
      sections: [
        {
          id: "section_cards",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            {
              id: "column_cards",
              width: "1/1",
              blocks: [
                {
                  id: "block_cards",
                  type: "card_grid",
                  variant: "standard",
                  props: {
                    heading: "Card limit",
                    cards: Array.from({ length: count }, (_, index) => ({
                      title: `Card ${index + 1}`,
                      body: "A short card description.",
                      href: "/apply",
                    })),
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      pageContentSchema.safeParse(contentWithCardCount(CARD_GRID_MAX_CARDS))
        .success,
    ).toBe(true);
    expect(
      pageContentSchema.safeParse(contentWithCardCount(CARD_GRID_MAX_CARDS + 1))
        .success,
    ).toBe(false);
  });

  it("keeps card link labels backward compatible and descriptive", () => {
    const parsed = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_cards",
          columns: [
            {
              id: "column_cards",
              blocks: [
                {
                  id: "block_cards",
                  type: "card_grid",
                  props: {
                    heading: "Options",
                    cards: [
                      {
                        title: "Route planning",
                        body: "Plan locations and restocks.",
                        href: "/apply",
                      },
                      {
                        title: "Launch support",
                        body: "Get launch help.",
                        href: "/apply",
                        linkLabel: "Compare launch support",
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const block = parsed.sections[0]?.columns[0]?.blocks[0];
    expect(block?.type).toBe("card_grid");
    if (block?.type !== "card_grid") throw new Error("Expected card grid");

    expect(block.props.cards[0].linkLabel).toBeUndefined();
    expect(cardGridLinkLabel(block.props.cards[0])).toBe(
      "Learn more about Route planning",
    );
    expect(cardGridLinkLabel(block.props.cards[1])).toBe(
      "Compare launch support",
    );
  });

  it("caps FAQ blocks at the configured item limit", () => {
    const contentWithFaqCount = (count: number): PageContent => ({
      version: 1,
      sections: [
        {
          id: "section_faq",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            {
              id: "column_faq",
              width: "1/1",
              blocks: [
                {
                  id: "block_faq",
                  type: "faq",
                  variant: "standard",
                  props: {
                    heading: "FAQ limit",
                    items: Array.from({ length: count }, (_, index) => ({
                      question: `Question ${index + 1}?`,
                      answer: "A short answer.",
                    })),
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(
      pageContentSchema.safeParse(contentWithFaqCount(FAQ_MAX_ITEMS)).success,
    ).toBe(true);
    expect(
      pageContentSchema.safeParse(contentWithFaqCount(FAQ_MAX_ITEMS + 1))
        .success,
    ).toBe(false);
  });

  it("keeps page chrome optional and defaults header/footer on", () => {
    const parsed = pageContentSchema.parse({
      ...validContent,
      chrome: { showHeader: false },
    });

    expect(pageChromeSettings(validContent)).toEqual({
      showHeader: true,
      showFooter: true,
    });
    expect(pageChromeSettings(parsed)).toEqual({
      showHeader: false,
      showFooter: true,
    });
  });

  it("accepts page-level and lead-form qualification attachment settings", () => {
    const content = pageContentSchema.parse({
      version: 1,
      qualification: {
        formId: "11111111-1111-4111-8111-111111111111",
        completionRedirectPath: "/qualification-thanks",
        experimentKey: "post_submit_qualification",
        variantKey: "page_default",
      },
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
                  variant: "standard",
                  props: {
                    heading: "Apply",
                    body: "Start with your contact details.",
                    submitLabel: "Continue",
                    trackingName: "resource_lead_form",
                    qualification: {
                      formId: "22222222-2222-4222-8222-222222222222",
                      completionRedirectPath: "/book-a-call",
                      experimentKey: "post_submit_qualification",
                      variantKey: "block_override",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(content.qualification).toEqual({
      formId: "11111111-1111-4111-8111-111111111111",
      completionRedirectPath: "/qualification-thanks",
      experimentKey: "post_submit_qualification",
      variantKey: "page_default",
    });

    const block = content.sections[0]?.columns[0]?.blocks[0];
    expect(block?.type).toBe("lead_form");
    if (block?.type !== "lead_form") throw new Error("Expected lead form.");
    expect(block.props.qualification).toEqual({
      formId: "22222222-2222-4222-8222-222222222222",
      completionRedirectPath: "/book-a-call",
      experimentKey: "post_submit_qualification",
      variantKey: "block_override",
    });
  });

  it("rejects external qualification completion redirects", () => {
    const unsafeContent = {
      ...validContent,
      qualification: {
        completionRedirectPath: "https://example.com/qualification-thanks",
      },
    };

    expect(pageContentSchema.safeParse(unsafeContent).success).toBe(false);
    expect(
      pageContentSchema.safeParse({
        ...validContent,
        sections: [
          {
            ...validContent.sections[0],
            columns: [
              {
                ...validContent.sections[0].columns[0],
                blocks: [
                  {
                    id: "block_form",
                    type: "lead_form",
                    variant: "standard",
                    props: {
                      heading: "Apply",
                      body: "Tell us about your goals.",
                      submitLabel: "Submit application",
                      trackingName: "resource_lead_form",
                      qualification: {
                        completionRedirectPath: "//example.com/thanks",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
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

  it("accepts rich text paragraphs with inline links without breaking legacy paragraphs", () => {
    const content = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "rich_text"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        body: {
                          version: 1,
                          nodes: [
                            {
                              type: "paragraph",
                              text: "Legacy paragraph stays valid.",
                            },
                            {
                              type: "paragraph",
                              spans: [
                                { text: "Read the " },
                                {
                                  text: "application guide",
                                  href: "/apply",
                                },
                                { text: " before you start." },
                              ],
                            },
                          ],
                        },
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });

    const richTextBlock = content.sections[0]?.columns[0]?.blocks.find(
      (block) => block.type === "rich_text",
    );
    if (!richTextBlock || richTextBlock.type !== "rich_text") {
      throw new Error("Expected rich text block.");
    }

    expect(richTextDocumentPlainText(richTextBlock.props.body)).toContain(
      "Legacy paragraph stays valid. Read the application guide before you start.",
    );
  });

  it("accepts rich text heading hierarchy through h4 without breaking existing nodes", () => {
    const content = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "rich_text"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        body: {
                          version: 1,
                          nodes: [
                            {
                              type: "paragraph",
                              text: "Legacy paragraph stays valid.",
                            },
                            {
                              type: "heading",
                              level: 2,
                              text: "Section heading",
                            },
                            {
                              type: "heading",
                              level: 3,
                              text: "Subsection heading",
                            },
                            {
                              type: "heading",
                              level: 4,
                              text: "Detail heading",
                            },
                            {
                              type: "list",
                              style: "bullet",
                              items: ["Location quality", "Refill cadence"],
                            },
                          ],
                        },
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });

    const richTextBlock = content.sections[0]?.columns[0]?.blocks.find(
      (block) => block.type === "rich_text",
    );
    if (!richTextBlock || richTextBlock.type !== "rich_text") {
      throw new Error("Expected rich text block.");
    }

    expect(richTextBlock.props.body.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "heading", level: 2 }),
        expect.objectContaining({ type: "heading", level: 3 }),
        expect.objectContaining({ type: "heading", level: 4 }),
      ]),
    );
    expect(richTextDocumentPlainText(richTextBlock.props.body)).toContain(
      "Legacy paragraph stays valid. Section heading Subsection heading Detail heading Location quality Refill cadence",
    );
  });

  it("rejects unsafe inline rich text links", () => {
    expect(() =>
      pageContentSchema.parse({
        ...validContent,
        sections: [
          {
            ...validContent.sections[0],
            columns: [
              {
                ...validContent.sections[0].columns[0],
                blocks: validContent.sections[0].columns[0].blocks.map(
                  (block) =>
                    block.type === "rich_text"
                      ? {
                          ...block,
                          props: {
                            ...block.props,
                            body: {
                              version: 1,
                              nodes: [
                                {
                                  type: "paragraph",
                                  spans: [
                                    {
                                      text: "Unsafe link",
                                      href: "javascript:alert(1)",
                                    },
                                  ],
                                },
                              ],
                            },
                          },
                        }
                      : block,
                ),
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

  it("counts visible hero CTAs as conversion surfaces and validates their fields", () => {
    const content = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_hero",
          columns: [
            {
              id: "column_hero",
              blocks: [
                {
                  id: "block_hero",
                  type: "hero",
                  props: {
                    eyebrow: "Guide",
                    heading: "Start vending",
                    body: "Plan a route.",
                    ctaLabel: "",
                    ctaHref: "",
                    ctaTrackingName: "",
                    fieldVisibility: { cta: true },
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
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      "missing_conversion_block",
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_hero_cta_label" }),
        expect.objectContaining({ code: "missing_hero_cta_href" }),
      ]),
    );
  });

  it("blocks visible hero CTAs without tracking attribution", () => {
    const content = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_hero",
          columns: [
            {
              id: "column_hero",
              blocks: [
                {
                  id: "block_hero",
                  type: "hero",
                  props: {
                    eyebrow: "Guide",
                    heading: "Start vending",
                    body: "Plan a route.",
                    ctaLabel: "Apply now",
                    ctaHref: "/apply",
                    ctaTrackingName: "",
                    fieldVisibility: { cta: true },
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
        expect.objectContaining({ code: "missing_hero_cta_tracking" }),
      ]),
    );
  });

  it("blocks lead form publishing without visible copy, submit text, and tracking attribution", () => {
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
                    heading: "",
                    body: "",
                    submitLabel: "",
                    trackingName: "",
                    fieldVisibility: { heading: true, body: true },
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
        expect.objectContaining({ code: "missing_lead_form_heading" }),
        expect.objectContaining({ code: "missing_lead_form_body" }),
        expect.objectContaining({ code: "missing_lead_form_submit_label" }),
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

  it("blocks publishing with unknown internal links inside rich text spans", () => {
    const content = pageContentSchema.parse({
      ...validContent,
      sections: [
        {
          ...validContent.sections[0],
          columns: [
            {
              ...validContent.sections[0].columns[0],
              blocks: validContent.sections[0].columns[0].blocks.map((block) =>
                block.type === "rich_text"
                  ? {
                      ...block,
                      props: {
                        ...block.props,
                        body: {
                          version: 1,
                          nodes: [
                            {
                              type: "paragraph",
                              spans: [
                                {
                                  text: "Read this unknown resource.",
                                  href: "/missing-internal-page",
                                },
                              ],
                            },
                          ],
                        },
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

  it("collects root-relative links from CTA, hero, card, and rich text blocks", () => {
    const content = pageContentSchema.parse({
      version: 1,
      sections: [
        {
          id: "section_links",
          columns: [
            {
              id: "column_links",
              blocks: [
                {
                  id: "block_cta",
                  type: "cta",
                  props: {
                    label: "Apply",
                    href: "/apply",
                    trackingName: "cta_apply",
                  },
                },
                {
                  id: "block_hero",
                  type: "hero",
                  props: {
                    eyebrow: "Guide",
                    heading: "Start vending",
                    body: "Plan a route.",
                    ctaLabel: "Read more",
                    ctaHref: "/resources/start-vending",
                    ctaTrackingName: "hero_resource",
                  },
                },
                {
                  id: "block_cards",
                  type: "card_grid",
                  props: {
                    heading: "Next steps",
                    cards: [
                      {
                        title: "Internal card",
                        body: "Stay on-site.",
                        href: "/case-studies",
                      },
                      {
                        title: "External card",
                        body: "Leave the site.",
                        href: "https://example.com",
                      },
                    ],
                  },
                },
                {
                  id: "block_text",
                  type: "rich_text",
                  props: {
                    heading: "Related reading",
                    body: {
                      version: 1,
                      nodes: [
                        {
                          type: "paragraph",
                          spans: [
                            { text: "Visit " },
                            { text: "About", href: "/about" },
                            { text: " or " },
                            {
                              text: "external",
                              href: "https://example.com",
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  id: "block_external_cta",
                  type: "cta",
                  props: {
                    label: "External CTA",
                    href: "https://example.com/apply",
                    trackingName: "external_cta",
                  },
                },
                {
                  id: "block_external_hero",
                  type: "hero",
                  props: {
                    eyebrow: "External",
                    heading: "External hero",
                    body: "This hero links off-site.",
                    ctaLabel: "External",
                    ctaHref: "https://example.com/hero",
                    ctaTrackingName: "external_hero",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(collectPageInternalLinks(content)).toEqual([
      {
        blockIndex: 0,
        href: "/apply",
        path: "blocks.0.props.href",
        label: "Apply",
      },
      {
        blockIndex: 1,
        href: "/resources/start-vending",
        path: "blocks.1.props.ctaHref",
        label: "Read more",
      },
      {
        blockIndex: 2,
        href: "/case-studies",
        path: "blocks.2.props.cards.0.href",
        label: "Internal card",
      },
      {
        blockIndex: 3,
        href: "/about",
        path: "blocks.3.props.body.nodes.0.spans.1.href",
        label: "About",
      },
    ]);
  });

  it("accepts root and resource query internal links at publish time", () => {
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
                        href: "/resources/start-vending?utm=test#intro",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });

    expect(
      validatePageForPublish(content, {
        slug: "start-vending",
        title: "Start Vending",
        seoTitle: "Start Vending",
        metaDescription: "Learn how to start vending.",
        noindex: false,
        sitemapEnabled: true,
        canonicalUrl: "/",
      }).ok,
    ).toBe(true);
  });

  it("accepts the site root as a known internal CTA destination", () => {
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
                        href: "/",
                      },
                    }
                  : block,
              ),
            },
          ],
        },
      ],
    });

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

  it("preserves invalid content issue code, path, and message", () => {
    const result = validatePageContent({
      version: 1,
      sections: [
        {
          id: "1bad",
          columns: [{ id: "column_1", blocks: [] }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid content.");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "invalid_content",
        path: "sections.0.id",
        message: "Use a stable block id.",
      }),
    ]);
  });
});
