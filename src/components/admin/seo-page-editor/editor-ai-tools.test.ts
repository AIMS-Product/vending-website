import { describe, expect, it, vi } from "vitest";
import { applyPageBuilderAiToolsToEditor } from "./editor-ai-tools";
import type { PageContent } from "@/lib/page-builder/blocks";

const content: PageContent = {
  version: 1,
  sections: [],
};

function callbacks() {
  return {
    replaceContent: vi.fn(),
    setTitle: vi.fn(),
    setSlugTouched: vi.fn(),
    setSlug: vi.fn(),
    setTargetKeyword: vi.fn(),
    setSeoTitle: vi.fn(),
    setMetaDescription: vi.fn(),
    setSelectedBlockId: vi.fn(),
    scheduleBlockScroll: vi.fn(),
  };
}

describe("applyPageBuilderAiToolsToEditor", () => {
  it("applies SEO patches to editor state setters", () => {
    const editor = callbacks();

    const result = applyPageBuilderAiToolsToEditor({
      ...editor,
      content,
      toolCalls: [
        {
          id: "call_1",
          name: "set_seo_metadata",
          input: {
            title: "Campus vending",
            slug: "campus-vending",
            targetKeyword: "campus vending",
            seoTitle: "Campus Vending Services",
            metaDescription: "A useful campus vending page.",
          },
        },
      ],
      makeBlockId: () => "block_ai",
    });

    expect(result.seoPatch).toEqual({
      title: "Campus vending",
      slug: "campus-vending",
      targetKeyword: "campus vending",
      seoTitle: "Campus Vending Services",
      metaDescription: "A useful campus vending page.",
    });
    expect(editor.setTitle).toHaveBeenCalledWith("Campus vending");
    expect(editor.setSlugTouched).toHaveBeenCalledWith(true);
    expect(editor.setSlug).toHaveBeenCalledWith("campus-vending");
    expect(editor.setTargetKeyword).toHaveBeenCalledWith("campus vending");
    expect(editor.setSeoTitle).toHaveBeenCalledWith("Campus Vending Services");
    expect(editor.setMetaDescription).toHaveBeenCalledWith(
      "A useful campus vending page.",
    );
    expect(editor.setSelectedBlockId).not.toHaveBeenCalled();
    expect(editor.scheduleBlockScroll).not.toHaveBeenCalled();
  });

  it("selects and schedules scroll for the last highlighted block", () => {
    const editor = callbacks();

    const result = applyPageBuilderAiToolsToEditor({
      ...editor,
      content,
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
      makeBlockId: () => "block_ai",
    });

    expect(result.highlightedBlockIds).toEqual(["block_ai"]);
    expect(editor.replaceContent).toHaveBeenCalledOnce();
    expect(editor.setSelectedBlockId).toHaveBeenCalledWith("block_ai");
    expect(editor.scheduleBlockScroll).toHaveBeenCalledWith("block_ai");
  });
});
