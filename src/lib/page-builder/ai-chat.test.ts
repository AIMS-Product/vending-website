import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  applyPageBuilderAiToolCalls,
  buildPageBuilderAiToolDefinitions,
  collectBlockToolSpecs,
  normalizePageBuilderAiChatResponseForIntent,
  pageBuilderAiSystemPrompt,
  type PageBuilderAiContext,
} from "./ai-chat";

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

describe("page builder AI chat tools", () => {
  it("builds dynamic strict tools for the current blocks", () => {
    const tools = buildPageBuilderAiToolDefinitions(context);
    const heroTool = tools.find((tool) => tool.name.includes("block_hero"));

    expect(heroTool).toEqual(
      expect.objectContaining({
        type: "function",
        strict: true,
      }),
    );
    expect(heroTool?.parameters.additionalProperties).toBe(false);
    expect(heroTool?.parameters.required).toContain("headline");
    expect(tools.map((tool) => tool.name)).toContain("set_seo_metadata");
    expect(tools.map((tool) => tool.name)).toContain("replace_page_sections");
    expect(tools.map((tool) => tool.name)).toContain("add_image_text_section");
    const replaceTool = tools.find(
      (tool) => tool.name === "replace_page_sections",
    );
    expect(replaceTool?.parameters.required).toContain("replaceExisting");
    expect(
      (
        replaceTool?.parameters.properties.replaceExisting as
          | { type?: unknown }
          | undefined
      )?.type,
    ).toBe("boolean");
  });

  it("includes current page context and exact block tools in the prompt", () => {
    const prompt = pageBuilderAiSystemPrompt(context);

    expect(prompt).toContain("Coffee vending Adelaide");
    expect(prompt).toContain("Publish requires at least one CTA");
    expect(prompt).toContain("Full editable block context");
    expect(prompt).toContain('"selectedBlockId": "block_faq"');
    expect(prompt).toContain('"selected": true');
    expect(prompt).toContain(collectBlockToolSpecs(content)[0]!.name);
    expect(prompt).toContain("replace_page_sections");
    expect(prompt).toContain(
      "fill out, expand, build out, or add more content",
    );
    expect(prompt).toContain("image section with text");
  });

  it("applies block edits and SEO metadata to local draft state", () => {
    const [heroTool] = collectBlockToolSpecs(content);
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: heroTool!.name,
          input: {
            eyebrow: "Workplace vending",
            headline: "Better coffee vending for Adelaide teams",
            body: null,
            ctaLabel: "Book a vending consult",
            ctaHref: "/contact",
          },
        },
        {
          id: "call_2",
          name: "set_seo_metadata",
          input: {
            title: null,
            slug: "Better Coffee Vending Adelaide",
            targetKeyword: null,
            seoTitle: "Coffee Vending Adelaide",
            metaDescription: "Plan a better vending setup for your workplace.",
          },
        },
      ],
    });

    const hero = result.content.sections[0]!.columns[0]!.blocks[0]!;
    expect(hero).toMatchObject({
      type: "hero",
      props: {
        eyebrow: "Workplace vending",
        heading: "Better coffee vending for Adelaide teams",
        body: "Old body",
        ctaLabel: "Book a vending consult",
        ctaHref: "/contact",
      },
    });
    expect(result.seoPatch).toEqual({
      slug: "better-coffee-vending-adelaide",
      seoTitle: "Coffee Vending Adelaide",
      metaDescription: "Plan a better vending setup for your workplace.",
    });
    expect(result.results.every((entry) => entry.status === "applied")).toBe(
      true,
    );
  });

  it("rejects incomplete reorders without dropping blocks", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: "reorder_blocks",
          input: { blockIds: ["block_faq"] },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      message: "Reorder must include every current block ID exactly once.",
    });
  });

  it("queues deletion instead of removing the block immediately", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: "delete_block",
          input: { blockId: "block_faq", reason: "FAQ is duplicated." },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.pendingDelete).toEqual({
      blockId: "block_faq",
      blockLabel: 'FAQ "Questions"',
      reason: "FAQ is duplicated.",
    });
  });

  it("adds a missing block to the primary column", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_text",
      toolCalls: [
        {
          id: "call_1",
          name: "add_block",
          input: {
            blockType: "rich_text",
            title: "Why vending support matters",
            body: "Good vending support keeps machines stocked and useful.",
            bulletItems: ["Local support", "Simple refills"],
            faqItems: null,
            cards: null,
            ctaLabel: null,
            ctaHref: null,
          },
        },
      ],
    });

    expect(result.content.sections[0]!.columns[0]!.blocks).toHaveLength(3);
    expect(result.content.sections[0]!.columns[0]!.blocks[2]).toMatchObject({
      id: "block_ai_text",
      type: "rich_text",
      props: { heading: "Why vending support matters" },
    });
  });

  it("adds a paired image and text section when a real image URL is supplied", () => {
    const ids = [
      "section_ai",
      "column_text",
      "column_image",
      "block_text",
      "block_image",
    ];
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => ids.shift() ?? "id_extra",
      toolCalls: [
        {
          id: "call_1",
          name: "add_image_text_section",
          input: {
            heading: "Campus vending that feels stocked and intentional",
            body: "Pair visible product range with a simple message for students and staff.",
            bulletItems: ["Managed restocking", "Clear campus placement"],
            imageUrl: "/images/sections/hero.avif",
            imageAltText: "Stocked campus vending display",
            imageCaption: "A stocked vending display for high-traffic spaces.",
            sourceRightsNotes: "Owned campaign image.",
            imagePosition: "right",
          },
        },
      ],
    });

    const section = result.content.sections[1]!;
    expect(section.preset).toBe("feature");
    expect(section.columns.map((column) => column.width)).toEqual([
      "1/2",
      "1/2",
    ]);
    expect(section.columns[0]!.blocks[0]).toMatchObject({
      id: "text_block_text",
      type: "rich_text",
      variant: "intro",
      props: {
        heading: "Campus vending that feels stocked and intentional",
      },
    });
    expect(section.columns[1]!.blocks[0]).toMatchObject({
      id: "image_block_image",
      type: "image",
      variant: "standard",
      props: {
        src: "/images/sections/hero.avif",
        altText: "Stocked campus vending display",
        caption: "A stocked vending display for high-traffic spaces.",
        sourceRightsNotes: "Owned campaign image.",
      },
    });
    expect(result.results[0]).toMatchObject({
      status: "applied",
      message:
        "Added a paired image and text section. Review image alt text and rights notes before publishing.",
    });
    expect(result.highlightedBlockIds).toEqual([
      "text_block_text",
      "image_block_image",
    ]);
  });

  it("asks for a media source before adding a requested image and text section", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "id_extra",
      toolCalls: [
        {
          id: "call_1",
          name: "add_image_text_section",
          input: {
            heading: "Campus vending that feels stocked and intentional",
            body: "Pair visible product range with a simple message for students and staff.",
            bulletItems: null,
            imageUrl: null,
            imageAltText: null,
            imageCaption: null,
            sourceRightsNotes: null,
            imagePosition: "right",
          },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "queued",
      message:
        "Choose an image source before adding the image and text section.",
    });
    expect(result.clarification).toEqual({
      options: [
        "Paste an image URL",
        "Choose a media library image first",
        "Add the text section now",
      ],
    });
  });

  it("adds a standalone media block when a real media URL is supplied", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_image",
      toolCalls: [
        {
          id: "call_1",
          name: "add_media_block",
          input: {
            mediaType: "image",
            title: null,
            url: "/images/sections/hero.avif",
            altText: "Campus vending machine",
            caption: "Approved campaign image.",
            sourceRightsNotes: "Owned campaign image.",
          },
        },
      ],
    });

    expect(result.content.sections[0]!.columns[0]!.blocks[2]).toMatchObject({
      id: "block_ai_image",
      type: "image",
      props: {
        src: "/images/sections/hero.avif",
        altText: "Campus vending machine",
        caption: "Approved campaign image.",
        sourceRightsNotes: "Owned campaign image.",
      },
    });
    expect(result.results[0]).toMatchObject({
      status: "applied",
      message: 'Added Image "Campus vending machine".',
    });
  });

  it("asks for a media source before adding a requested media block", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_video",
      toolCalls: [
        {
          id: "call_1",
          name: "add_media_block",
          input: {
            mediaType: "video",
            title: "Campus vending walkthrough",
            url: null,
            altText: null,
            caption: null,
            sourceRightsNotes: null,
          },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "queued",
      message: "Choose a media source before adding this block.",
    });
    expect(result.clarification).toEqual({
      options: [
        "Paste a media URL",
        "Choose from the media library first",
        "Add a text placeholder instead",
      ],
    });
  });

  it("can add another card by updating the current card grid", () => {
    const cardContent: PageContent = {
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
                    heading: "Vending options",
                    cards: [
                      {
                        title: "Coffee vending",
                        body: "Fresh coffee for staff.",
                        href: "/contact",
                        linkLabel: "Ask about coffee",
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const [cardTool] = collectBlockToolSpecs(cardContent);
    const result = applyPageBuilderAiToolCalls({
      content: cardContent,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: cardTool!.name,
          input: {
            heading: null,
            cards: [
              {
                title: "Coffee vending",
                body: "Fresh coffee for staff.",
                href: "/contact",
                linkLabel: "Ask about coffee",
              },
              {
                title: "Protein bars",
                body: "A better snack option for gym members.",
                href: "/contact",
                linkLabel: "Ask about protein bars",
              },
            ],
          },
        },
      ],
    });

    expect(result.content.sections[0]!.columns[0]!.blocks[0]).toMatchObject({
      type: "card_grid",
      props: {
        heading: "Vending options",
        cards: [
          { title: "Coffee vending" },
          { title: "Protein bars", href: "/contact" },
        ],
      },
    });
  });

  it("replaces an empty page body in one working-state batch", () => {
    const emptyContent: PageContent = {
      version: 1,
      chrome: { showHeader: false, showFooter: true },
      sections: [],
    };
    const ids = [
      "id_section",
      "id_column",
      "id_hero",
      "id_text",
      "id_cards",
      "id_faq",
      "id_cta",
    ];
    const result = applyPageBuilderAiToolCalls({
      content: emptyContent,
      makeBlockId: () => ids.shift() ?? "id_extra",
      toolCalls: [
        {
          id: "call_1",
          name: "set_seo_metadata",
          input: {
            title: "Coffee Vending Machines Adelaide Offices",
            slug: "Coffee Vending Machines Adelaide Offices",
            targetKeyword: "coffee vending machines Adelaide offices",
            seoTitle: "Coffee Vending Machines Adelaide Offices",
            metaDescription:
              "Compare coffee vending machines Adelaide offices and book a consultation.",
          },
        },
        {
          id: "call_2",
          name: "replace_page_sections",
          input: {
            replaceExisting: false,
            sections: [
              {
                title: "Main page",
                blocks: [
                  {
                    blockType: "hero",
                    title: "Coffee Vending Machines for Adelaide Offices",
                    body: "Compare coffee vending machines for Adelaide offices without extra admin.",
                    bulletItems: null,
                    faqItems: null,
                    cards: null,
                    ctaLabel: "Book a vending consultation",
                    ctaHref: "#benefits",
                  },
                  {
                    blockType: "rich_text",
                    title: "Why Adelaide offices choose managed coffee",
                    body: "A managed vending setup keeps staff and visitors supplied.",
                    bulletItems: ["Local restocking", "Simple servicing"],
                    faqItems: null,
                    cards: null,
                    ctaLabel: null,
                    ctaHref: null,
                  },
                  {
                    blockType: "card_grid",
                    title: "Office coffee vending options",
                    body: null,
                    bulletItems: null,
                    faqItems: null,
                    cards: [
                      {
                        title: "Bean-to-cup",
                        body: "Fresh coffee for busy teams.",
                        href: "#",
                        linkLabel: null,
                      },
                    ],
                    ctaLabel: null,
                    ctaHref: null,
                  },
                  {
                    blockType: "faq",
                    title: "Coffee vending FAQs",
                    body: null,
                    bulletItems: null,
                    faqItems: [
                      {
                        question: "Do you service Adelaide offices?",
                        answer: "Yes, vending plans can include local support.",
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
                    ctaLabel: "Book a vending consultation",
                    ctaHref: "/contact",
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    const blocks = result.content.sections[0]!.columns[0]!.blocks;
    expect(result.content.chrome).toEqual({
      showHeader: false,
      showFooter: true,
    });
    expect(blocks.map((block) => block.type)).toEqual([
      "hero",
      "rich_text",
      "card_grid",
      "faq",
      "cta",
    ]);
    expect(blocks[0]).toMatchObject({
      type: "hero",
      props: { ctaHref: "" },
    });
    expect(blocks[2]).toMatchObject({
      type: "card_grid",
      props: { cards: [{ href: "" }] },
    });
    expect(result.seoPatch).toEqual({
      title: "Coffee Vending Machines Adelaide Offices",
      slug: "coffee-vending-machines-adelaide-offices",
      targetKeyword: "coffee vending machines Adelaide offices",
      seoTitle: "Coffee Vending Machines Adelaide Offices",
      metaDescription:
        "Compare coffee vending machines Adelaide offices and book a consultation.",
    });
    expect(result.results.map((entry) => entry.status)).toEqual([
      "applied",
      "applied",
    ]);
  });

  it("does not replace an existing page body without explicit confirmation flow", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "id_extra",
      toolCalls: [
        {
          id: "call_1",
          name: "replace_page_sections",
          input: {
            replaceExisting: false,
            sections: [
              {
                title: null,
                blocks: [
                  {
                    blockType: "cta",
                    title: null,
                    body: null,
                    bulletItems: null,
                    faqItems: null,
                    cards: null,
                    ctaLabel: "Book now",
                    ctaHref: "/contact",
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "queued",
      message:
        "Choose whether to expand the existing blocks or replace them with a new full draft.",
    });
    expect(result.clarification).toEqual({
      options: [
        "Keep existing blocks and expand them",
        "Replace existing blocks with a new full draft",
      ],
    });
  });

  it("replaces an existing page body when overwrite is explicit", () => {
    const ids = ["section_ai", "column_ai", "block_ai_hero", "block_ai_cta"];
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => ids.shift() ?? "id_extra",
      toolCalls: [
        {
          id: "call_1",
          name: "replace_page_sections",
          input: {
            replaceExisting: true,
            sections: [
              {
                title: null,
                blocks: [
                  {
                    blockType: "hero",
                    title: "Vending Programs for College Campuses",
                    body: "Launch a managed campus vending program for students, staff, and visitors.",
                    bulletItems: null,
                    faqItems: null,
                    cards: null,
                    ctaLabel: "Plan campus vending",
                    ctaHref: "/contact",
                  },
                  {
                    blockType: "cta",
                    title: null,
                    body: null,
                    bulletItems: null,
                    faqItems: null,
                    cards: null,
                    ctaLabel: "Book a campus vending consult",
                    ctaHref: "/contact",
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    const blocks = result.content.sections[0]!.columns[0]!.blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.type)).toEqual(["hero", "cta"]);
    expect(blocks[0]).toMatchObject({
      type: "hero",
      props: {
        heading: "Vending Programs for College Campuses",
        ctaHref: "/contact",
      },
    });
    expect(result.results[0]).toMatchObject({
      status: "applied",
      message: "Rebuilt page body with 2 blocks across 1 sections.",
    });
  });

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
          expect.objectContaining({ title: "CTA" }),
        ]),
      },
    });
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
});
