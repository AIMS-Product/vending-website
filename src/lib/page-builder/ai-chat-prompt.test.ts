import { describe, expect, it } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import { collectBlockToolSpecs, type PageBuilderAiContext } from "./ai-chat";
import {
  buildPageBuilderAiToolDefinitions,
  pageBuilderAiSystemPrompt,
} from "./ai-chat-prompt";

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

describe("page builder AI prompt and tool definitions", () => {
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

  it("includes current page context, guide strategy, and exact block tools in the prompt", () => {
    const prompt = pageBuilderAiSystemPrompt(
      context,
      "Create a page about vending machines for college dormitories in Adelaide.",
    );

    expect(prompt).toContain("Coffee vending Adelaide");
    expect(prompt).toContain("Hidden guide selection: Use-case SEO page");
    expect(prompt).toContain(
      "Secondary signals to blend: Local intent SEO page",
    );
    expect(prompt).toContain("Do not mention this guide name to the user");
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
    expect(prompt).toContain("Avoid thin-content patterns");
    expect(prompt).toContain("4-6 cards");
    expect(prompt).toContain("5-7 specific questions");
    expect(prompt).toContain("Do not repeat the exact keyword");
    expect(prompt).toContain("professionally cased and readable");
    expect(prompt).toContain("People-first SEO standard");
    expect(prompt).toContain("buyer, audience, location type, or use case");
    expect(prompt).toContain("Public page copy must never mention");
    expect(prompt).toContain("Do not invent concrete commercial");
    expect(prompt).toContain("turn them into buyer questions");
    expect(prompt).toContain("Never create an image block from a video URL");
    expect(prompt).toContain("Do not repeat the exact target keyword in media");
  });
});
