import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourcePageRenderer } from "./ResourcePageRenderer";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

vi.mock("@/app/apply/actions", () => ({
  submitApplicationLead: vi.fn(),
}));

vi.mock("@/app/qualification-intake/actions", () => ({
  submitQualificationLead: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const richTextHeadingContent = pageContentSchema.parse({
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
                heading: "Page section",
                body: {
                  version: 1,
                  nodes: [
                    {
                      type: "heading",
                      level: 2,
                      text: "Section detail",
                    },
                    {
                      type: "heading",
                      level: 3,
                      text: "Subsection detail",
                    },
                    {
                      type: "heading",
                      level: 4,
                      text: "Checklist detail",
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
});

const videoThumbnailContent = pageContentSchema.parse({
  version: 1,
  sections: [
    {
      id: "section_video",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_video",
          width: "1/1",
          blocks: [
            {
              id: "block_video",
              type: "video",
              variant: "standard",
              props: {
                title: "Route planning walkthrough",
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                thumbnailSrc: "/images/custom-video-thumbnail.webp",
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

const leadFormContent = pageContentSchema.parse({
  version: 1,
  sections: [
    {
      id: "section_form",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_form",
          width: "1/1",
          blocks: [
            {
              id: "block_form",
              type: "lead_form",
              variant: "standard",
              props: {
                heading: "Get the vending checklist",
                body: "Tell us where to send the next step.",
                submitLabel: "Continue",
                trackingName: "resource_lead_form",
              },
            },
          ],
        },
      ],
    },
  ],
});

const qualifiedLeadFormContent = pageContentSchema.parse({
  ...leadFormContent,
  qualification: {
    formId: "11111111-1111-4111-8111-111111111111",
    completionRedirectPath: "/book-call",
    experimentKey: "post_submit_qualification",
    variantKey: "page-a",
  },
});

function page(content: PageContent): PublishedSeoPage {
  return {
    id: "page_1",
    slug: "draft-preview",
    route_prefix: "/resources",
    route_path: "/resources/draft-preview",
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

  it("preserves nested rich text heading levels in public markup", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(richTextHeadingContent),
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).toContain("<h2");
    expect(html).toContain(">Section detail</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain(">Subsection detail</h3>");
    expect(html).toContain("<h4");
    expect(html).toContain(">Checklist detail</h4>");
  });

  it("uses video thumbnail overrides in public video previews", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(videoThumbnailContent),
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).toContain("/images/custom-video-thumbnail.webp");
    expect(html).toContain("Route planning walkthrough");
  });

  it("keeps non-opt-in lead forms on the legacy application path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(leadFormContent),
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).toContain("Business stage");
    expect(html).toContain("Available startup budget");
    expect(html).toContain('name="source_block_id"');
    expect(html).toContain('value="block_form"');
    expect(html).not.toContain('name="qualification_form_id"');
  });

  it("renders an opted-in lead form as short qualification intake with resolved attribution", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(qualifiedLeadFormContent),
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).toContain("Get the vending checklist");
    expect(html).toContain("Name");
    expect(html).toContain("Email");
    expect(html).toContain("Phone");
    expect(html).not.toContain("Business stage");
    expect(html).not.toContain("Available startup budget");
    expect(html).toContain('name="qualification_form_id"');
    expect(html).toContain('value="11111111-1111-4111-8111-111111111111"');
    expect(html).toContain('name="qualification_completion_redirect_path"');
    expect(html).toContain('value="/book-call"');
    expect(html).toContain('name="qualification_experiment_key"');
    expect(html).toContain('value="post_submit_qualification"');
    expect(html).toContain('name="qualification_variant_key"');
    expect(html).toContain('value="page-a"');
    expect(html).toContain('name="source_page_id"');
    expect(html).toContain('value="page_1"');
    expect(html).toContain('name="source_block_id"');
    expect(html).toContain('value="block_form"');
    expect(html).toContain('name="source_cta_tracking_name"');
    expect(html).toContain('value="resource_lead_form"');
  });

  it("uses the global default qualification form when page and block do not override it", () => {
    const html = renderToStaticMarkup(
      createElement(ResourcePageRenderer, {
        page: page(leadFormContent),
        defaultQualificationFormId: "33333333-3333-4333-8333-333333333333",
        idempotencyKeyPrefix: "test",
      }),
    );

    expect(html).toContain('name="qualification_form_id"');
    expect(html).toContain('value="33333333-3333-4333-8333-333333333333"');
    expect(html).not.toContain("Business stage");
  });
});
