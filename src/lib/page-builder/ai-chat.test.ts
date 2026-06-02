import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  applyPageBuilderAiToolCalls,
  buildPageBuilderAiToolDefinitions,
  collectBlockToolSpecs,
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
                    ctaHref: "/contact",
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
                        href: null,
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
});
