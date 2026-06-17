import { describe, expect, it } from "vitest";
import { pageContentSchema } from "@/lib/page-builder/blocks";
import { buildSeoPageEditorFormData } from "./editor-form-data";

describe("buildSeoPageEditorFormData", () => {
  it("includes an auto-created draft id when saving a preview", () => {
    const formData = buildSeoPageEditorFormData({
      pageId: "11111111-1111-4111-8111-111111111111",
      title: "Vending in Colleges",
      slug: "vending-in-colleges",
      routePrefix: "/blog",
      targetKeyword: "college vending",
      seoTitle: "Vending in Colleges",
      metaDescription: "A draft preview page.",
      canonicalUrl: "",
      noindex: false,
      sitemapEnabled: true,
      structuredDataBreadcrumb: true,
      structuredDataFaq: false,
      pageType: "blog",
      templateKey: "blog-standard",
      draftContentJson: JSON.stringify({ version: 1, sections: [] }),
    });

    expect(formData.get("id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(formData.get("slug")).toBe("vending-in-colleges");
    expect(formData.get("routePrefix")).toBe("/blog");
    expect(formData.get("pageType")).toBe("blog");
    expect(formData.get("templateKey")).toBe("blog-standard");
    expect(formData.get("sitemapEnabled")).toBe("on");
    expect(formData.get("structuredDataBreadcrumb")).toBe("on");
  });

  it("omits page id and sitemap when there is no persisted draft or indexing is disabled", () => {
    const formData = buildSeoPageEditorFormData({
      pageId: null,
      title: "Vending in Colleges",
      slug: "vending-in-colleges",
      routePrefix: "/resources",
      targetKeyword: "",
      seoTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      noindex: true,
      sitemapEnabled: true,
      structuredDataBreadcrumb: false,
      structuredDataFaq: true,
      pageType: "resource",
      templateKey: "blank",
      draftContentJson: JSON.stringify({ version: 1, sections: [] }),
    });

    expect(formData.has("id")).toBe(false);
    expect(formData.get("noindex")).toBe("on");
    expect(formData.has("sitemapEnabled")).toBe(false);
    expect(formData.get("structuredDataFaq")).toBe("on");
  });

  it("persists page and lead-form qualification settings inside draftContent", () => {
    const content = pageContentSchema.parse({
      version: 1,
      qualification: {
        formId: "11111111-1111-4111-8111-111111111111",
        completionRedirectPath: "/qualification-thanks",
        experimentKey: "post_submit_qualification",
        variantKey: "page_default",
      },
      sections: [
        {
          id: "section_form",
          columns: [
            {
              id: "column_form",
              blocks: [
                {
                  id: "block_form",
                  type: "lead_form",
                  props: {
                    heading: "Apply",
                    body: "Start with your contact details.",
                    submitLabel: "Continue",
                    trackingName: "resource_lead_form",
                    qualification: {
                      formId: "22222222-2222-4222-8222-222222222222",
                      completionRedirectPath: "/book-a-call",
                      experimentKey: "post_submit_qualification",
                      variantKey: "block_override",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const formData = buildSeoPageEditorFormData({
      pageId: "11111111-1111-4111-8111-111111111111",
      title: "Vending in Colleges",
      slug: "vending-in-colleges",
      routePrefix: "/resources",
      targetKeyword: "college vending",
      seoTitle: "Vending in Colleges",
      metaDescription: "A draft preview page.",
      canonicalUrl: "",
      noindex: false,
      sitemapEnabled: true,
      structuredDataBreadcrumb: false,
      structuredDataFaq: false,
      pageType: "resource",
      templateKey: "blank",
      draftContentJson: JSON.stringify(content),
    });

    expect(formData.has("qualificationFormId")).toBe(false);
    expect(
      pageContentSchema.parse(
        JSON.parse(String(formData.get("draftContent") ?? "")),
      ).qualification,
    ).toEqual({
      formId: "11111111-1111-4111-8111-111111111111",
      completionRedirectPath: "/qualification-thanks",
      experimentKey: "post_submit_qualification",
      variantKey: "page_default",
    });
  });
});
