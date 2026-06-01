export type SeoPageEditorFormDataInput = {
  pageId?: string | null;
  title: string;
  slug: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataBreadcrumb: boolean;
  structuredDataFaq: boolean;
  draftContentJson: string;
};

export function buildSeoPageEditorFormData({
  pageId,
  title,
  slug,
  targetKeyword,
  seoTitle,
  metaDescription,
  canonicalUrl,
  noindex,
  sitemapEnabled,
  structuredDataBreadcrumb,
  structuredDataFaq,
  draftContentJson,
}: SeoPageEditorFormDataInput) {
  const formData = new FormData();
  if (pageId) formData.set("id", pageId);
  formData.set("title", title);
  formData.set("slug", slug);
  formData.set("targetKeyword", targetKeyword);
  formData.set("seoTitle", seoTitle);
  formData.set("metaDescription", metaDescription);
  formData.set("canonicalUrl", canonicalUrl);
  if (noindex) formData.set("noindex", "on");
  if (sitemapEnabled && !noindex) formData.set("sitemapEnabled", "on");
  if (structuredDataBreadcrumb) {
    formData.set("structuredDataBreadcrumb", "on");
  }
  if (structuredDataFaq) {
    formData.set("structuredDataFaq", "on");
  }
  formData.set("draftContent", draftContentJson);
  formData.set("intent", "save");
  return formData;
}
