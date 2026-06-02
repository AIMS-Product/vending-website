import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SeoPageCommentsPanel } from "./SeoPageCommentsPanel";
import type { Tables } from "@/types/database";

vi.mock("@/app/admin/pages/actions", () => ({
  createSeoPageComment: vi.fn(),
}));

describe("SeoPageCommentsPanel", () => {
  it("renders accessible comment fields and visible submit errors", () => {
    const html = renderToStaticMarkup(
      createElement(SeoPageCommentsPanel, {
        pageId: "page_1",
        comments: [],
        commentError: "Could not add the comment. Please try again.",
      }),
    );

    expect(html).toContain('for="seo-comment-block-id"');
    expect(html).toContain('id="seo-comment-block-id"');
    expect(html).toContain('for="seo-comment-body"');
    expect(html).toContain('id="seo-comment-body"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not add the comment. Please try again.");
  });

  it("keeps existing comments visible", () => {
    const html = renderToStaticMarkup(
      createElement(SeoPageCommentsPanel, {
        pageId: "page_1",
        comments: [
          {
            id: "comment_1",
            page_id: "page_1",
            block_id: "block_intro",
            body: "Check this proof point.",
            resolved_at: null,
            created_by: "admin_1",
            created_at: "2026-06-01T12:30:00.000Z",
          } as Tables<"page_builder_comments">,
        ],
      }),
    );

    expect(html).toContain("Check this proof point.");
    expect(html).toContain("Block block_intro");
  });
});
