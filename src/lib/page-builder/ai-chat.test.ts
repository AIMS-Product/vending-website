import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import { applyPageBuilderAiToolCalls, collectBlockToolSpecs } from "./ai-chat";

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

describe("page builder AI chat tools", () => {
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

  it("keeps rich text structure when a dynamic edit passes body: null", () => {
    const richBody = {
      version: 1 as const,
      nodes: [
        { type: "heading" as const, level: 2 as const, text: "Why it works" },
        {
          type: "paragraph" as const,
          spans: [{ text: "Linked detail", href: "/contact" }],
        },
        {
          type: "list" as const,
          style: "bullet" as const,
          items: ["First point", "Second point"],
        },
      ],
    };
    const richContent: PageContent = {
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
                  id: "block_rich",
                  type: "rich_text",
                  variant: "default",
                  props: {
                    eyebrow: "",
                    heading: "Old heading",
                    body: richBody,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const [richTool] = collectBlockToolSpecs(richContent);
    const result = applyPageBuilderAiToolCalls({
      content: richContent,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: richTool!.name,
          input: {
            eyebrow: null,
            heading: "New heading",
            body: null,
            bulletItems: null,
          },
        },
      ],
    });

    expect(result.results[0]).toMatchObject({ status: "applied" });
    const block = result.content.sections[0]!.columns[0]!.blocks[0]!;
    expect(block).toMatchObject({
      type: "rich_text",
      props: { heading: "New heading", body: richBody },
    });
  });

  it("replaces only the list when a dynamic edit passes new bullet items", () => {
    const richContent: PageContent = {
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
                  id: "block_rich",
                  type: "rich_text",
                  variant: "default",
                  props: {
                    eyebrow: "",
                    heading: "Heading",
                    body: {
                      version: 1,
                      nodes: [
                        { type: "paragraph", text: "Keep this prose." },
                        {
                          type: "list",
                          style: "bullet",
                          items: ["Old item"],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const [richTool] = collectBlockToolSpecs(richContent);
    const result = applyPageBuilderAiToolCalls({
      content: richContent,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: richTool!.name,
          input: {
            eyebrow: null,
            heading: null,
            body: null,
            bulletItems: ["New item one", "New item two"],
          },
        },
      ],
    });

    expect(result.results[0]).toMatchObject({ status: "applied" });
    const block = result.content.sections[0]!.columns[0]!.blocks[0]!;
    expect(block).toMatchObject({
      type: "rich_text",
      props: {
        body: {
          version: 1,
          nodes: [
            { type: "paragraph", text: "Keep this prose." },
            {
              type: "list",
              style: "bullet",
              items: ["New item one", "New item two"],
            },
          ],
        },
      },
    });
  });

  it("applies dynamic edits whose flatten index shifted earlier in the batch", () => {
    const twoSectionContent: PageContent = {
      version: 1,
      sections: [
        content.sections[0]!,
        {
          id: "section_2",
          preset: "standard",
          background: "default",
          spacing: "standard",
          columns: [
            {
              id: "column_2",
              width: "1/1",
              blocks: [
                {
                  id: "block_late",
                  type: "rich_text",
                  variant: "default",
                  props: {
                    eyebrow: "",
                    heading: "Late heading",
                    body: {
                      version: 1,
                      nodes: [{ type: "paragraph", text: "Late body." }],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // Tool names were generated against pre-batch content; the add_block call
    // shifts every later block's flatten index before the edit resolves.
    const lateTool = collectBlockToolSpecs(twoSectionContent).find(
      (spec) => spec.blockId === "block_late",
    );
    const result = applyPageBuilderAiToolCalls({
      content: twoSectionContent,
      makeBlockId: () => "block_added",
      toolCalls: [
        {
          id: "call_1",
          name: "add_block",
          input: {
            blockType: "rich_text",
            title: "Inserted block",
            body: "Inserted body copy.",
            bulletItems: null,
            faqItems: null,
            cards: null,
            ctaLabel: null,
            ctaHref: null,
          },
        },
        {
          id: "call_2",
          name: lateTool!.name,
          input: {
            eyebrow: null,
            heading: "Updated late heading",
            body: null,
            bulletItems: null,
          },
        },
      ],
    });

    expect(result.results[1]).toMatchObject({
      status: "applied",
      blockId: "block_late",
    });
    const lateBlock = result.content.sections[1]!.columns[0]!.blocks[0]!;
    expect(lateBlock).toMatchObject({
      type: "rich_text",
      props: { heading: "Updated late heading" },
    });
  });

  it("truncates overlong AI SEO metadata before applying it", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: "set_seo_metadata",
          input: {
            title: "Managed Workplace Vending ".repeat(12),
            slug: "Managed Workplace Vending ".repeat(8),
            targetKeyword: "managed workplace vending",
            seoTitle:
              "Managed Workplace Vending Machines for Offices, Warehouses, Universities, and Staff Rooms",
            metaDescription:
              "Managed workplace vending machines with stocked products, clear placement planning, reliable restocking, and a consultation path for offices, warehouses, universities, and staff rooms that need practical support.",
          },
        },
      ],
    });

    expect(result.results).toEqual([
      {
        status: "applied",
        toolName: "set_seo_metadata",
        message: "Updated SEO metadata fields.",
      },
    ]);
    expect(result.seoPatch.title?.length).toBeLessThanOrEqual(180);
    expect(result.seoPatch.slug?.length).toBeLessThanOrEqual(120);
    expect(result.seoPatch.targetKeyword).toBe("managed workplace vending");
    expect(result.seoPatch.seoTitle?.length).toBeLessThanOrEqual(80);
    expect(result.seoPatch.metaDescription?.length).toBeLessThanOrEqual(180);
  });

  it("normalizes overlong AI block payloads before applying them", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_cards",
      toolCalls: [
        {
          id: "call_1",
          name: "add_block",
          input: {
            blockType: "card_grid",
            title: "Managed workplace vending options ".repeat(12),
            body: null,
            bulletItems: null,
            faqItems: null,
            cards: Array.from({ length: 14 }, (_, index) => ({
              title: `Card ${index + 1} ${"managed vending ".repeat(20)}`,
              body: "A long card body about workplace vending support. ".repeat(
                30,
              ),
              href: "/contact",
              linkLabel: "Ask about managed vending support ".repeat(6),
            })),
            ctaLabel: null,
            ctaHref: null,
          },
        },
      ],
    });

    const block = result.content.sections[0]!.columns[0]!.blocks.at(-1);
    expect(result.results[0]).toMatchObject({ status: "applied" });
    expect(block).toMatchObject({ type: "card_grid" });
    expect(block?.type === "card_grid" ? block.props.cards : []).toHaveLength(
      12,
    );
    if (block?.type === "card_grid") {
      expect(block.props.cards[0]!.title.length).toBeLessThanOrEqual(140);
      expect(block.props.cards[0]!.body.length).toBeLessThanOrEqual(500);
      expect(block.props.cards[0]!.linkLabel?.length).toBeLessThanOrEqual(80);
    }
  });

  it("normalizes oversized replacement section payloads before rebuilding", () => {
    const emptyContent: PageContent = {
      version: 1,
      chrome: { showHeader: true, showFooter: true },
      sections: [],
    };
    const result = applyPageBuilderAiToolCalls({
      content: emptyContent,
      makeBlockId: () => "block_ai_replace",
      toolCalls: [
        {
          id: "call_1",
          name: "replace_page_sections",
          input: {
            replaceExisting: false,
            sections: Array.from({ length: 14 }, (_, sectionIndex) => ({
              title: `Section ${sectionIndex + 1} ${"vending ".repeat(40)}`,
              blocks: Array.from({ length: 14 }, () => ({
                blockType: "hero",
                title: "Office vending machines ".repeat(20),
                body: "Managed office vending machine support. ".repeat(40),
                bulletItems: null,
                faqItems: null,
                cards: null,
                ctaLabel: "Book an office vending consultation ".repeat(8),
                ctaHref: "/contact",
              })),
            })),
          },
        },
      ],
    });

    expect(result.results[0]).toMatchObject({ status: "applied" });
    expect(result.content.sections).toHaveLength(12);
    expect(result.content.sections[0]!.columns[0]!.blocks).toHaveLength(12);
  });

  it("applies a validated image source from a dynamic image edit", () => {
    const imageContent: PageContent = {
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
                  id: "block_image",
                  type: "image",
                  variant: "standard",
                  props: {
                    src: "/images/old.webp",
                    altText: "Old image",
                    caption: "",
                    sourceRightsNotes: "",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const [imageTool] = collectBlockToolSpecs(imageContent);
    const applied = applyPageBuilderAiToolCalls({
      content: imageContent,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: imageTool!.name,
          input: {
            title: null,
            url: "/images/new.webp",
            caption: null,
            altText: "New image",
          },
        },
      ],
    });
    expect(applied.results[0]).toMatchObject({ status: "applied" });
    expect(applied.content.sections[0]!.columns[0]!.blocks[0]).toMatchObject({
      type: "image",
      props: { src: "/images/new.webp", altText: "New image" },
    });

    const rejected = applyPageBuilderAiToolCalls({
      content: imageContent,
      makeBlockId: () => "block_ai",
      toolCalls: [
        {
          id: "call_1",
          name: imageTool!.name,
          input: {
            title: null,
            url: "https://attacker.example/payload.png",
            caption: null,
            altText: null,
          },
        },
      ],
    });
    expect(rejected.results[0]).toMatchObject({
      status: "failed",
      message: "Use an internal image path or an approved remote image URL.",
    });
    expect(rejected.content).toEqual(imageContent);
  });

  it("still rejects unsafe media URLs after normalization", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_image",
      toolCalls: [
        {
          id: "call_1",
          name: "add_media_block",
          input: {
            mediaType: "image",
            title: "Unsafe image",
            url: "javascript:alert(1)",
            altText: "Unsafe image",
            caption: null,
            sourceRightsNotes: null,
          },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      message: "Use an internal media path or an http(s) URL.",
    });
  });

  it("rejects video URLs when the AI tries to create an image block", () => {
    const result = applyPageBuilderAiToolCalls({
      content,
      makeBlockId: () => "block_ai_image",
      toolCalls: [
        {
          id: "call_1",
          name: "add_media_block",
          input: {
            mediaType: "image",
            title: "Video as image",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            altText: "Video as image",
            caption: null,
            sourceRightsNotes: null,
          },
        },
      ],
    });

    expect(result.content).toEqual(content);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      message: "Use an internal image path or an approved remote image URL.",
    });
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
});
