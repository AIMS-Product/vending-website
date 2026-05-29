import { describe, expect, it } from "vitest";
import { createPageBlock } from "@/lib/page-builder/content-ops";
import {
  blockLabel,
  blockSummary,
  collectBuilderBlockEntries,
  completionMessagesForBlock,
  createPageBlockWithVariant,
  editableRichTextBodyText,
  parseInitialContent,
  parseInitialDraftSettings,
  parsePublishedContent,
  richTextBodyFromEditableText,
  slugify,
  syncedTrackingName,
  updateCard,
  updateColumn,
  updateFaqItem,
  type CardGridBlock,
  type FaqBlock,
  type SeoPageEditorPage,
} from "@/lib/page-builder/editor-helpers";
import type { PageContent } from "@/lib/page-builder/blocks";

describe("page builder editor helpers", () => {
  it("parses draft content and draft settings with safe fallbacks", () => {
    const content = singleBlockContent(createPageBlock("cta", "block_cta"));
    const page = seoPage({
      draft_content: content,
      published_content: content,
      draft_settings: {
        slug: "route-plan",
        title: "Route plan",
        targetKeyword: "vending route",
        noindex: true,
        sitemapEnabled: false,
        structuredDataSettings: { breadcrumb: false, faq: true },
      },
    });

    expect(parseInitialContent(page)).toEqual(content);
    expect(parsePublishedContent(page)).toEqual(content);
    expect(parseInitialDraftSettings(page)).toMatchObject({
      slug: "route-plan",
      title: "Route plan",
      targetKeyword: "vending route",
      noindex: true,
      sitemapEnabled: false,
      structuredDataSettings: { breadcrumb: false, faq: true },
    });
    expect(
      parseInitialDraftSettings(seoPage({ draft_settings: {} })),
    ).toBeNull();
  });

  it("collects block entries and updates nested columns immutably", () => {
    const content = singleBlockContent(createPageBlock("cta", "block_cta"));
    const entries = collectBuilderBlockEntries(content);
    const updated = updateColumn(
      content,
      "section_1",
      "column_1",
      (column) => ({
        ...column,
        blocks: [createPageBlock("hero", "block_hero")],
      }),
    );

    expect(entries).toMatchObject([
      {
        sectionId: "section_1",
        columnId: "column_1",
        blockNumber: 1,
        sectionNumber: 1,
        columnNumber: 1,
      },
    ]);
    expect(updated.sections[0]?.columns[0]?.blocks[0]?.type).toBe("hero");
    expect(content.sections[0]?.columns[0]?.blocks[0]?.type).toBe("cta");
  });

  it("applies new-block defaults for checklist, card, FAQ, CTA, and lead form blocks", () => {
    const checklist = createPageBlockWithVariant(
      "rich_text",
      "block_text",
      "checklist",
    );
    const cards = createPageBlockWithVariant("card_grid", "block_cards");
    const faq = createPageBlockWithVariant("faq", "block_faq");
    const cta = createPageBlockWithVariant("cta", "block_cta");
    const leadForm = createPageBlockWithVariant("lead_form", "block_form");

    expect(
      checklist.type === "rich_text" && checklist.props.body.nodes[0],
    ).toMatchObject({
      type: "list",
      items: ["", "", ""],
    });
    expect(cards.type === "card_grid" && cards.props.cards).toHaveLength(3);
    expect(faq.type === "faq" && faq.props.items).toEqual([
      { question: "", answer: "" },
    ]);
    expect(cta.type === "cta" && cta.props.trackingName).toBe("cta");
    expect(leadForm.type === "lead_form" && leadForm.props.trackingName).toBe(
      "lead-form",
    );
  });

  it("round-trips editable rich text bodies and preserves generated tracking names", () => {
    const checklist = createPageBlockWithVariant(
      "rich_text",
      "block_text",
      "checklist",
    );
    if (checklist.type !== "rich_text") throw new Error("Expected rich text");

    const nextBody = richTextBodyFromEditableText(
      checklist,
      "- First step\n2. Second step",
    );

    expect(nextBody.nodes[0]).toMatchObject({
      type: "list",
      items: ["First step", "Second step"],
    });
    expect(
      editableRichTextBodyText({
        ...checklist,
        props: { ...checklist.props, body: nextBody },
      }),
    ).toBe("First step\nSecond step");
    expect(
      syncedTrackingName({
        currentTrackingName: "old-label",
        previousLabel: "Old label",
        nextLabel: "New label",
        fallback: "cta",
      }),
    ).toBe("new-label");
  });

  it("keeps labels, summaries, card updates, and completion messages deterministic", () => {
    const cta = createPageBlock("cta", "block_cta");
    const faq = createPageBlock("faq", "block_faq") as FaqBlock;
    const cards = createPageBlock("card_grid", "block_cards") as CardGridBlock;

    expect(blockLabel("rich_text")).toBe("Rich text");
    expect(blockSummary(cta)).toBe("CTA needs button copy");
    expect(completionMessagesForBlock(cta)).toEqual([
      "Add button text for this CTA.",
    ]);
    expect(updateFaqItem(faq.props.items, 0, { question: "Budget?" })).toEqual([
      { question: "Budget?", answer: "" },
    ]);
    expect(
      updateCard(cards.props.cards, 0, { title: "Plan" })[0],
    ).toMatchObject({
      title: "Plan",
    });
    expect(slugify(" Route Planning! ")).toBe("route-planning");
  });
});

function singleBlockContent(
  block: PageContent["sections"][number]["columns"][number]["blocks"][number],
): PageContent {
  return {
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
            blocks: [block],
          },
        ],
      },
    ],
  };
}

function seoPage(
  overrides: Partial<SeoPageEditorPage> = {},
): SeoPageEditorPage {
  return {
    id: "page_1",
    title: "Page",
    slug: "page",
    status: "draft",
    draft_content: null,
    published_content: null,
    draft_settings: null,
    noindex: false,
    sitemap_enabled: true,
    structured_data_settings: null,
    ...overrides,
  } as SeoPageEditorPage;
}
