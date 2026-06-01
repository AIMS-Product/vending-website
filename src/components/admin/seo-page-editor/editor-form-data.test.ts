import { describe, expect, it } from "vitest";
import { buildSeoPageEditorFormData } from "./editor-form-data";

describe("buildSeoPageEditorFormData", () => {
  it("includes an auto-created draft id when saving a preview", () => {
    const formData = buildSeoPageEditorFormData({
      pageId: "11111111-1111-4111-8111-111111111111",
      title: "Vending in Colleges",
      slug: "vending-in-colleges",
      targetKeyword: "college vending",
      seoTitle: "Vending in Colleges",
      metaDescription: "A draft preview page.",
      canonicalUrl: "",
      noindex: false,
      sitemapEnabled: true,
      structuredDataBreadcrumb: true,
      structuredDataFaq: false,
      draftContentJson: JSON.stringify({ version: 1, sections: [] }),
    });

    expect(formData.get("id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(formData.get("slug")).toBe("vending-in-colleges");
    expect(formData.get("sitemapEnabled")).toBe("on");
    expect(formData.get("structuredDataBreadcrumb")).toBe("on");
  });

  it("omits page id and sitemap when there is no persisted draft or indexing is disabled", () => {
    const formData = buildSeoPageEditorFormData({
      pageId: null,
      title: "Vending in Colleges",
      slug: "vending-in-colleges",
      targetKeyword: "",
      seoTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      noindex: true,
      sitemapEnabled: true,
      structuredDataBreadcrumb: false,
      structuredDataFaq: true,
      draftContentJson: JSON.stringify({ version: 1, sections: [] }),
    });

    expect(formData.has("id")).toBe(false);
    expect(formData.get("noindex")).toBe("on");
    expect(formData.has("sitemapEnabled")).toBe(false);
    expect(formData.get("structuredDataFaq")).toBe("on");
  });
});
