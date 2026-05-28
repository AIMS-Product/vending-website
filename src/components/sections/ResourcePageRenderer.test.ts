import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourcePageRenderer } from "./ResourcePageRenderer";
import type { PageContent } from "@/lib/page-builder/blocks";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

vi.mock("@/app/apply/actions", () => ({
  submitApplicationLead: vi.fn(),
}));

const emptyContent: PageContent = {
  version: 1,
  sections: [],
};

const nonEmptyContent: PageContent = {
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
              id: "hero_1",
              type: "hero",
              variant: "standard",
              props: {
                eyebrow: "Preview",
                heading: "Draft headline",
                body: "Draft body copy.",
                ctaLabel: "Apply now",
                ctaHref: "/apply",
                ctaTrackingName: "draft_apply",
              },
            },
          ],
        },
      ],
    },
  ],
};

function page(content: PageContent): PublishedSeoPage {
  return {
    id: "page_1",
    slug: "draft-preview",
    title: "Draft Preview",
    target_keyword: "draft preview",
    published_content: content,
    seo_title: "Draft Preview SEO",
    meta_description: "A draft preview page.",
    canonical_url: null,
    noindex: true,
    sitemap_enabled: false,
    structured_data_settings: {},
    published_at: null,
    updated_at: "2026-05-28T00:00:00.000Z",
  };
}

describe("ResourcePageRenderer", () => {
  it("shows preview-only guidance for empty draft previews", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(emptyContent),
        idempotencyKeyPrefix: "test",
        showPreviewEmptyState: true,
      }),
    );

    expect(html).toContain("Draft preview");
    expect(html).toContain("No page content yet");
    expect(html).toContain("save and preview again");
  });

  it("does not show preview guidance for the published renderer path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(emptyContent),
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).not.toContain("No page content yet");
    expect(html).not.toContain("save and preview again");
  });

  it("renders non-empty previews as page content", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(nonEmptyContent),
        idempotencyKeyPrefix: "test",
        showPreviewEmptyState: true,
      }),
    );

    expect(html).toContain("Draft headline");
    expect(html).not.toContain("No page content yet");
  });
});
