import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  applyPageBuilderAiToolCalls,
  type PageBuilderAiContext,
} from "./ai-chat";
import {
  assessReplacementSeoDraftQuality,
  normalizePageBuilderAiChatResponseForIntent,
} from "./ai-chat-intent-fallback";

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
                heading: "Old headline",
                body: "Old body",
                ctaLabel: "Apply now",
                ctaHref: "/apply",
                ctaTrackingName: "apply-now",
                mediaSrc: "",
                mediaAltText: "",
                mediaCaption: "",
                proofText: "",
              },
            },
            {
              id: "block_faq",
              type: "faq",
              variant: "standard",
              props: {
                heading: "Questions",
                items: [{ question: "Old question?", answer: "Old answer." }],
              },
            },
          ],
        },
      ],
    },
  ],
};

const context: PageBuilderAiContext = {
  pageId: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  title: "Coffee vending Adelaide",
  slug: "coffee-vending-adelaide",
  pageType: "resource",
  templateKey: "blank",
  targetKeyword: "coffee vending",
  seoTitle: "Coffee vending Adelaide",
  metaDescription: "Coffee vending machines for Adelaide workplaces.",
  selectedBlockId: "block_faq",
  content,
  publishReadiness: {
    blockers: ["Publish requires at least one CTA or lead form block."],
    warnings: [],
    opportunities: [],
  },
};

const intentVariantTemplates = [
  "Add {subject} about campus vending.",
  "Create {subject} for office vending.",
  "Insert {subject} on workplace vending.",
  "Make {subject} around snack vending.",
  "Build {subject} for coffee vending.",
  "Put {subject} about school vending.",
  "Include {subject} for gym vending.",
  "Draft {subject} about managed vending.",
  "Generate {subject} for Adelaide vending.",
  "Write {subject} about vending operators.",
  "Compose {subject} for healthy vending.",
  "Give me {subject} about retail vending.",
  "Can you add {subject} for lobby vending?",
  "Please create {subject} around machine servicing.",
  "I need you to insert {subject} for refill schedules.",
  "Let's build {subject} about customer support.",
  "Please include {subject} for product range.",
  "Can you make {subject} around machine uptime?",
  "Could you draft {subject} for new locations?",
  "Generate {subject} about route planning.",
];

const intentEvalScenarios = [
  {
    subject: "a hero block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "hero" },
  },
  {
    subject: "a text section",
    expectedToolName: "add_block",
    expectedInput: { blockType: "rich_text" },
  },
  {
    subject: "an FAQ block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "faq" },
  },
  {
    subject: "a card grid block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "card_grid" },
  },
  {
    subject: "a CTA block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "cta" },
  },
  {
    subject: "a proof block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "proof" },
  },
  {
    subject: "a lead form block",
    expectedToolName: "add_block",
    expectedInput: { blockType: "lead_form" },
  },
  {
    subject: "an image block using /images/sections/hero.avif",
    expectedToolName: "add_media_block",
    expectedInput: { mediaType: "image", url: "/images/sections/hero.avif" },
  },
  {
    subject: "a video block using https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    expectedToolName: "add_media_block",
    expectedInput: {
      mediaType: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
  },
  {
    subject: "an image section with text using /images/sections/hero.avif",
    expectedToolName: "add_image_text_section",
    expectedInput: { imageUrl: "/images/sections/hero.avif" },
  },
];

const intentEvalCases = intentEvalScenarios.flatMap((scenario) =>
  intentVariantTemplates.map((template) => ({
    message: template.replace("{subject}", scenario.subject),
    expectedToolName: scenario.expectedToolName,
    expectedInput: scenario.expectedInput,
  })),
);

describe("page builder AI intent fallback", () => {
  it("normalizes vague human image-section asks into a clarification", () => {
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content: "Add an image section with text about campus vending.",
          },
        ],
        context,
      },
      {
        message: "I added the text and left the image as a review item.",
        toolCalls: [
          {
            id: "call_1",
            name: "add_block",
            input: {
              blockType: "rich_text",
              title: "Campus vending",
              body: "A short section about campus vending.",
              bulletItems: null,
              faqItems: null,
              cards: null,
              ctaLabel: null,
              ctaHref: null,
            },
          },
        ],
      },
    );

    expect(response).toEqual({
      message:
        "I can add the image and text section, but I need the image source first.",
      source: "intent-fallback",
      toolCalls: [
        {
          id: "deterministic_image_text_clarification",
          name: "request_clarification",
          input: {
            options: [
              "Paste an image URL",
              "Choose a media library image first",
              "Add the text section now",
            ],
          },
        },
      ],
    });
  });

  it("preserves useful non-content tool calls when adding a deterministic fallback", () => {
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content: "Add a CTA block about campus vending.",
          },
        ],
        context,
      },
      {
        message: "I updated the metadata but did not add the CTA.",
        toolCalls: [
          {
            id: "call_1",
            name: "set_seo_metadata",
            input: {
              title: null,
              slug: null,
              targetKeyword: "campus vending",
              seoTitle: null,
              metaDescription: null,
            },
          },
        ],
      },
    );

    expect(response.toolCalls).toHaveLength(2);
    expect(response.toolCalls[0]?.name).toBe("set_seo_metadata");
    expect(response.toolCalls[1]).toMatchObject({
      name: "add_block",
      input: { blockType: "cta" },
    });
  });

  it("adds a full page body when a create-page ask only returns metadata", () => {
    const emptyContext: PageBuilderAiContext = {
      ...context,
      selectedBlockId: null,
      content: {
        version: 1,
        chrome: { showHeader: true, showFooter: true },
        sections: [],
      },
    };
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content:
              "Create a page about placing vending machines in college dormitories.",
          },
        ],
        context: emptyContext,
      },
      {
        message: "Updated SEO metadata fields.",
        toolCalls: [
          {
            id: "call_1",
            name: "set_seo_metadata",
            input: {
              title: "Placing Vending Machines in College Dormitories",
              slug: "placing-vending-machines-in-college-dormitories",
              targetKeyword: "vending machines in college dormitories",
              seoTitle: "Vending Machines in College Dormitories",
              metaDescription:
                "Learn how to place vending machines in college dormitories.",
            },
          },
        ],
      },
    );

    expect(response.message).toBe("Updated SEO metadata fields.");
    expect(response.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      "set_seo_metadata",
      "replace_page_sections",
    ]);
    expect(response.toolCalls[1]).toMatchObject({
      id: "deterministic_replace_page_sections",
      input: {
        replaceExisting: false,
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Hero" }),
          expect.objectContaining({ title: "Decisions before launch" }),
          expect.objectContaining({ title: "Rollout and support plan" }),
          expect.objectContaining({ title: "CTA" }),
        ]),
      },
    });

    const replaceInput = response.toolCalls[1]!.input as {
      sections: Array<{
        blocks: Array<{
          body?: string | null;
          cards?: Array<{ body?: string | null }> | null;
          faqItems?: Array<{ answer?: string | null }> | null;
        }>;
      }>;
    };
    const fallbackBodyCopy = replaceInput.sections.flatMap((section) =>
      section.blocks.flatMap((block) => [
        ...(block.body ? [block.body] : []),
        ...((block.cards ?? []).flatMap((card) =>
          card.body ? [card.body] : [],
        ) ?? []),
        ...((block.faqItems ?? []).flatMap((item) =>
          item.answer ? [item.answer] : [],
        ) ?? []),
      ]),
    );

    expect(new Set(fallbackBodyCopy).size).toBeGreaterThanOrEqual(10);
    expect(fallbackBodyCopy.join(" ").toLowerCase()).toContain(
      "college dormitories",
    );
    expect(fallbackBodyCopy.some((copy) => copy.includes("restocking"))).toBe(
      true,
    );
    expect(
      fallbackBodyCopy.some((copy) => copy.includes("service needs")),
    ).toBe(true);
    const cardGrid = replaceInput.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.cards);
    const faq = replaceInput.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.faqItems);
    expect(cardGrid?.cards).toHaveLength(5);
    expect(faq?.faqItems).toHaveLength(5);
  });

  it("adds a replacement body when an existing-page rebuild only returns metadata", () => {
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content:
              "Rebuild this page from scratch for office managers evaluating micro market vending Adelaide. Replace the thin copy with detailed sections.",
          },
        ],
        context: {
          ...context,
          selectedBlockId: null,
          targetKeyword: "micro market vending Adelaide",
        },
      },
      {
        message: "Updated SEO metadata fields.",
        toolCalls: [
          {
            id: "call_1",
            name: "set_seo_metadata",
            input: {
              title: "Micro Market Vending Adelaide",
              slug: "micro-market-vending-adelaide",
              targetKeyword: "micro market vending Adelaide",
              seoTitle: "Micro Market Vending Adelaide",
              metaDescription:
                "Plan micro market vending Adelaide with practical office food support.",
            },
          },
        ],
      },
    );

    expect(response.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      "set_seo_metadata",
      "replace_page_sections",
    ]);
    const replaceInput = response.toolCalls[1]!.input as {
      replaceExisting: boolean;
      sections: Array<{
        blocks: Array<{
          cards?: Array<{ body?: string | null }> | null;
          faqItems?: Array<{ answer?: string | null }> | null;
        }>;
      }>;
    };
    expect(replaceInput.replaceExisting).toBe(true);
    expect(
      replaceInput.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.cards)?.cards,
    ).toHaveLength(5);
    expect(
      replaceInput.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.faqItems)?.faqItems,
    ).toHaveLength(5);
  });

  it("overrides risky metadata when adding a rebuild fallback", () => {
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content:
              "Rebuild this page from scratch for office managers evaluating micro market vending Adelaide.",
          },
        ],
        context: {
          ...context,
          selectedBlockId: null,
          targetKeyword: "micro market vending Adelaide",
        },
      },
      {
        message: "Updated SEO metadata fields.",
        toolCalls: [
          {
            id: "call_1",
            name: "set_seo_metadata",
            input: {
              title: "Micro Market Vending Adelaide",
              slug: "micro-market-vending-adelaide",
              targetKeyword: "micro market vending Adelaide",
              seoTitle: "Micro Market Vending Adelaide",
              metaDescription:
                "Micro market vending Adelaide cuts costs and includes a free consultation.",
            },
          },
        ],
      },
    );

    expect(response.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      "set_seo_metadata",
      "set_seo_metadata",
      "replace_page_sections",
    ]);
    expect(response.toolCalls[1]).toMatchObject({
      id: "deterministic_set_seo_metadata",
      input: {
        title: "Micro Market Vending Adelaide for Office Managers",
        targetKeyword: "micro market vending Adelaide",
        metaDescription: expect.stringContaining(
          "micro market vending Adelaide",
        ),
      },
    });
    const deterministicMetadata = response.toolCalls[1]!.input as {
      metaDescription: string;
    };
    expect(deterministicMetadata.metaDescription).not.toContain("cuts costs");
    expect(deterministicMetadata.metaDescription).not.toContain(
      "free consultation",
    );
  });

  it("accepts strong replacements after checking every AI replacement block type", () => {
    const strongBody =
      "Office managers can use this section to brief stakeholders before asking for a recommendation. It covers user groups, access, payment expectations, product range, refill planning, approvals, and the questions a provider should answer before the site team commits to a format.";
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content:
              "Rebuild this page from scratch for office managers evaluating micro market vending Adelaide.",
          },
        ],
        context: {
          ...context,
          selectedBlockId: null,
          targetKeyword: "micro market vending Adelaide",
        },
      },
      {
        message: "Rebuilt the page.",
        toolCalls: [
          {
            id: "call_1",
            name: "set_seo_metadata",
            input: {
              title: "Micro Market Vending Adelaide for Office Managers",
              slug: "micro-market-vending-adelaide-office-manager-guide",
              targetKeyword: "micro market vending Adelaide",
              seoTitle: "Micro Market Vending Adelaide for Office Managers",
              metaDescription:
                "micro market vending Adelaide planning checks for office managers before consultation.",
            },
          },
          {
            id: "call_2",
            name: "replace_page_sections",
            input: {
              replaceExisting: true,
              sections: [
                {
                  title: "All block types",
                  blocks: [
                    {
                      blockType: "hero",
                      title:
                        "Micro Market Vending Adelaide for Office Managers",
                      body: strongBody,
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: "Book a consultation",
                      ctaHref: "/contact",
                    },
                    {
                      blockType: "rich_text",
                      title: "Planning Checks Before the Recommendation",
                      body: strongBody,
                      bulletItems: [
                        "Confirm who uses the space and when demand peaks",
                        "Check access, payments, power, and approval needs",
                        "Prepare questions about refills and support ownership",
                      ],
                      faqItems: null,
                      cards: null,
                      ctaLabel: null,
                      ctaHref: null,
                    },
                    {
                      blockType: "card_grid",
                      title: "Decision Areas to Compare",
                      body: null,
                      bulletItems: null,
                      faqItems: null,
                      cards: [
                        {
                          title: "Audience fit",
                          body: strongBody,
                          href: "/contact",
                          linkLabel: "Review audience fit",
                        },
                        {
                          title: "Product range",
                          body: strongBody,
                          href: "/contact",
                          linkLabel: "Plan products",
                        },
                        {
                          title: "Payment flow",
                          body: strongBody,
                          href: "/contact",
                          linkLabel: "Check payments",
                        },
                        {
                          title: "Support access",
                          body: strongBody,
                          href: "/contact",
                          linkLabel: "Discuss support",
                        },
                      ],
                      ctaLabel: null,
                      ctaHref: null,
                    },
                    {
                      blockType: "faq",
                      title: "Questions Office Managers Ask",
                      body: null,
                      bulletItems: null,
                      faqItems: [
                        {
                          question: "How should we assess fit?",
                          answer: strongBody,
                        },
                        {
                          question: "What information should we prepare?",
                          answer: strongBody,
                        },
                        {
                          question: "How do payment needs affect planning?",
                          answer: strongBody,
                        },
                        {
                          question: "How should refills be discussed?",
                          answer: strongBody,
                        },
                        {
                          question: "What should stakeholders review?",
                          answer: strongBody,
                        },
                      ],
                      cards: null,
                      ctaLabel: null,
                      ctaHref: null,
                    },
                    {
                      blockType: "cta",
                      title: null,
                      body: null,
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: "Book a consultation",
                      ctaHref: "/contact",
                    },
                    {
                      blockType: "proof",
                      title: "Review-Safe Proof Point",
                      body: strongBody,
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: null,
                      ctaHref: null,
                    },
                    {
                      blockType: "lead_form",
                      title: "Request a Site Review",
                      body: strongBody,
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: "Send enquiry",
                      ctaHref: null,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    );

    expect(response.toolCalls.map((toolCall) => toolCall.name)).toEqual([
      "set_seo_metadata",
      "replace_page_sections",
    ]);
    expect(
      (
        response.toolCalls[1]!.input as {
          sections: Array<{ blocks: Array<{ blockType: string }> }>;
        }
      ).sections[0]!.blocks.map((block) => block.blockType),
    ).toEqual([
      "hero",
      "rich_text",
      "card_grid",
      "faq",
      "cta",
      "proof",
      "lead_form",
    ]);
    const assessment = assessReplacementSeoDraftQuality(
      response.toolCalls[1]!.input,
      "micro market vending Adelaide",
    );
    expect(assessment.needsFallback).toBe(false);
    expect(assessment.metrics).toMatchObject({
      blockCount: 7,
      cardCount: 4,
      emptyVisibleBlock: false,
      faqCount: 5,
      unsupportedBlockType: false,
    });
    expect(assessment.metrics.exactKeywordCount).toBeLessThanOrEqual(5);
    expect(assessment.metrics.wordCount).toBeGreaterThanOrEqual(450);
  });

  it("flags unsupported, empty, or thin replacement blocks through the shared SEO gate", () => {
    const assessment = assessReplacementSeoDraftQuality(
      {
        replaceExisting: true,
        sections: [
          {
            title: "Thin mixed replacement",
            blocks: [
              {
                blockType: "image",
                title: "Office vending",
                body: null,
                imageUrl: "/images/sections/hero.avif",
              },
              {
                blockType: "hero",
                title: "",
                body: "",
                bulletItems: null,
                faqItems: null,
                cards: null,
                ctaLabel: null,
              },
              {
                blockType: "rich_text",
                title: "Office vending",
                body: "The target keyword office vending appears throughout.",
                bulletItems: null,
                faqItems: null,
                cards: null,
                ctaLabel: null,
              },
              {
                blockType: "card_grid",
                title: "Decision points",
                body: null,
                bulletItems: null,
                faqItems: null,
                cards: [
                  {
                    title: "Products",
                    body: "A short note about product range.",
                    href: "/contact",
                    linkLabel: "Ask about products",
                  },
                ],
                ctaLabel: null,
              },
              {
                blockType: "faq",
                title: "Questions",
                body: null,
                bulletItems: null,
                faqItems: [
                  {
                    question: "Can this cut costs?",
                    answer: "A free consultation can discuss options.",
                  },
                ],
                cards: null,
                ctaLabel: null,
              },
            ],
          },
        ],
      },
      "office vending",
    );

    expect(assessment.needsFallback).toBe(true);
    expect(assessment.reasons).toEqual(
      expect.arrayContaining([
        "unsupported_block_type",
        "empty_visible_block",
        "too_few_cards",
        "too_few_faqs",
        "too_few_words",
        "review_risk_language",
      ]),
    );
    expect(assessment.metrics).toMatchObject({
      blockCount: 5,
      cardCount: 1,
      emptyVisibleBlock: true,
      exactKeywordCount: 2,
      faqCount: 1,
      unsupportedBlockType: true,
    });
  });

  it("overrides risky full-page replacements with a review-safe fallback", () => {
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content:
              "Rebuild this page from scratch for office managers evaluating micro market vending Adelaide.",
          },
        ],
        context: {
          ...context,
          selectedBlockId: null,
          targetKeyword: "micro market vending Adelaide",
        },
      },
      {
        message: "Rebuilt the page.",
        toolCalls: [
          {
            id: "call_1",
            name: "replace_page_sections",
            input: {
              replaceExisting: true,
              sections: [
                {
                  title: "Hero",
                  blocks: [
                    {
                      blockType: "hero",
                      title:
                        "Micro market vending Adelaide for office managers",
                      body: "The exact target keyword micro market vending Adelaide appears throughout and can cut costs with a free consultation.",
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: "Book a free consultation",
                      ctaHref: "/contact",
                    },
                  ],
                },
                {
                  title: "Decision cards",
                  blocks: [
                    {
                      blockType: "card_grid",
                      title: "Decision cards",
                      body: null,
                      bulletItems: null,
                      faqItems: null,
                      cards: [
                        {
                          title: "Reporting",
                          body: "Monthly usage reports and dedicated teams are included.",
                          href: "/contact",
                          linkLabel: "Learn more",
                        },
                      ],
                      ctaLabel: null,
                      ctaHref: null,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    );

    // The flagged model call is dropped entirely — appending the safe draft
    // after it would let the risky draft apply first.
    expect(response.toolCalls).toHaveLength(2);
    expect(
      response.toolCalls.find((toolCall) => toolCall.id === "call_1"),
    ).toBeUndefined();
    expect(response.toolCalls[0]).toMatchObject({
      id: "deterministic_set_seo_metadata",
      name: "set_seo_metadata",
    });
    expect(response.toolCalls[1]).toMatchObject({
      id: "deterministic_replace_page_sections",
      name: "replace_page_sections",
    });
    const replacement = response.toolCalls[1]!.input as {
      replaceExisting: boolean;
      sections: Array<{
        blocks: Array<{
          body?: string | null;
          cards?: Array<{ body?: string | null }> | null;
          faqItems?: Array<{ answer?: string | null }> | null;
        }>;
      }>;
    };
    expect(replacement.replaceExisting).toBe(true);
    const replacementText = replacement.sections
      .flatMap((section) => section.blocks)
      .flatMap((block) => [
        block.body ?? "",
        ...((block.cards ?? []).map((card) => card.body ?? "") ?? []),
        ...((block.faqItems ?? []).map((item) => item.answer ?? "") ?? []),
      ])
      .join(" ")
      .toLowerCase();
    expect(replacementText).not.toContain("target keyword");
    expect(replacementText).not.toContain("free consultation");
    expect(replacementText).not.toContain("monthly usage reports");
    expect(
      replacement.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.cards)?.cards,
    ).toHaveLength(5);
    expect(
      replacement.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.faqItems)?.faqItems,
    ).toHaveLength(5);
  });

  it("applies the review-safe draft for create intents on empty pages instead of the rejected model draft", () => {
    const emptyContent: PageContent = { version: 1, sections: [] };
    const response = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          {
            role: "user",
            content: "Create a page about office vending for Adelaide teams.",
          },
        ],
        context: {
          ...context,
          content: emptyContent,
          selectedBlockId: null,
          targetKeyword: "office vending Adelaide",
        },
      },
      {
        message: "Drafted the page.",
        toolCalls: [
          {
            id: "call_1",
            name: "replace_page_sections",
            input: {
              replaceExisting: false,
              sections: [
                {
                  title: "Hero",
                  blocks: [
                    {
                      blockType: "hero",
                      title: "Office vending Adelaide",
                      body: "The exact target keyword office vending Adelaide repeats with a free consultation promise.",
                      bulletItems: null,
                      faqItems: null,
                      cards: null,
                      ctaLabel: "Book a free consultation",
                      ctaHref: "/contact",
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    );

    // The thin model draft is dropped, not applied ahead of the safe draft.
    expect(
      response.toolCalls.find((toolCall) => toolCall.id === "call_1"),
    ).toBeUndefined();
    const deterministicDraft = response.toolCalls.find(
      (toolCall) => toolCall.id === "deterministic_replace_page_sections",
    );
    expect(deterministicDraft).toBeDefined();

    let counter = 0;
    const applied = applyPageBuilderAiToolCalls({
      content: emptyContent,
      makeBlockId: () => `block_gen_${counter++}`,
      toolCalls: response.toolCalls,
    });

    expect(applied.clarification).toBeNull();
    expect(
      applied.results.find(
        (entry) => entry.toolName === "replace_page_sections",
      ),
    ).toMatchObject({ status: "applied" });
    expect(applied.content.sections.length).toBeGreaterThan(0);
  });

  it("builds substantive fallback drafts across diverse SEO page topics", () => {
    const topicCases = [
      {
        keyword: "college dormitory vending Adelaide",
        expectedTerms: ["college", "dormitory"],
      },
      {
        keyword: "office coffee vending machines Adelaide",
        expectedTerms: ["office", "coffee"],
      },
      {
        keyword: "gym vending machine service",
        expectedTerms: ["gym", "service"],
      },
      {
        keyword: "warehouse vending for shift workers",
        expectedTerms: ["warehouse", "shift"],
      },
      {
        keyword: "school vending program",
        expectedTerms: ["school", "program"],
      },
      {
        keyword: "micro market vending Adelaide for office managers",
        expectedTerms: ["micro market", "office managers"],
      },
    ];

    for (const topicCase of topicCases) {
      const response = normalizePageBuilderAiChatResponseForIntent(
        {
          messages: [
            {
              role: "user",
              content: `Rebuild this page from scratch for ${topicCase.keyword}. Replace the thin copy with detailed sections, cards, FAQs, and a contact path.`,
            },
          ],
          context: {
            ...context,
            selectedBlockId: null,
            targetKeyword: topicCase.keyword,
          },
        },
        {
          message: "Updated SEO metadata fields.",
          toolCalls: [
            {
              id: `metadata_${topicCase.keyword}`,
              name: "set_seo_metadata",
              input: {
                title: topicCase.keyword,
                slug: topicCase.keyword.replaceAll(" ", "-").toLowerCase(),
                targetKeyword: topicCase.keyword,
                seoTitle: topicCase.keyword,
                metaDescription: `${topicCase.keyword} planning notes.`,
              },
            },
          ],
        },
      );

      const replacementTool = response.toolCalls.find(
        (toolCall) => toolCall.name === "replace_page_sections",
      );
      expect(replacementTool, topicCase.keyword).toBeDefined();
      const replacementInput = replacementTool!.input as {
        sections: Array<{
          blocks: Array<{
            body?: string | null;
            cards?: Array<{ body?: string | null }> | null;
            faqItems?: Array<{ answer?: string | null }> | null;
          }>;
        }>;
      };
      const assessment = assessReplacementSeoDraftQuality(
        replacementInput,
        topicCase.keyword,
      );
      expect(
        assessment.needsFallback,
        `${topicCase.keyword} ${JSON.stringify(assessment)}`,
      ).toBe(false);
      expect(assessment.metrics.cardCount, topicCase.keyword).toBe(5);
      expect(assessment.metrics.faqCount, topicCase.keyword).toBe(5);
      expect(
        assessment.metrics.wordCount,
        topicCase.keyword,
      ).toBeGreaterThanOrEqual(450);
      expect(
        assessment.metrics.exactKeywordCount,
        topicCase.keyword,
      ).toBeLessThanOrEqual(5);

      const replacementText = replacementInput.sections
        .flatMap((section) => section.blocks)
        .flatMap((block) => [
          block.body ?? "",
          ...((block.cards ?? []).map((card) => card.body ?? "") ?? []),
          ...((block.faqItems ?? []).map((item) => item.answer ?? "") ?? []),
        ])
        .join(" ")
        .toLowerCase();
      for (const expectedTerm of topicCase.expectedTerms) {
        expect(replacementText, topicCase.keyword).toContain(expectedTerm);
      }
      expect(replacementText, topicCase.keyword).not.toContain(
        "free consultation",
      );
      expect(replacementText, topicCase.keyword).not.toContain(
        "monthly usage reports",
      );
      expect(replacementText, topicCase.keyword).not.toContain(
        "target keyword",
      );
    }
  });

  it("normalizes 200 human add-request variants across block families", () => {
    expect(intentEvalCases).toHaveLength(200);

    for (const evalCase of intentEvalCases) {
      const response = normalizePageBuilderAiChatResponseForIntent(
        {
          messages: [{ role: "user", content: evalCase.message }],
          context,
        },
        {
          message: "Here is how I would approach that.",
          toolCalls: [],
        },
      );

      expect(response.toolCalls, evalCase.message).toHaveLength(1);
      expect(response.toolCalls[0]?.name, evalCase.message).toBe(
        evalCase.expectedToolName,
      );
      expect(response.toolCalls[0]?.input, evalCase.message).toMatchObject(
        evalCase.expectedInput,
      );
    }
  });

  it("tags fallback-modified responses with an intent-fallback source", () => {
    const fallback = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [
          { role: "user", content: "Add a CTA block about campus vending." },
        ],
        context,
      },
      { message: "Here is how I would approach that.", toolCalls: [] },
    );
    expect(fallback.source).toBe("intent-fallback");

    const untouched = normalizePageBuilderAiChatResponseForIntent(
      {
        messages: [{ role: "user", content: "Thanks, looks good." }],
        context,
      },
      { message: "Glad it helped.", toolCalls: [] },
    );
    expect(untouched.source).toBeUndefined();
  });
});
