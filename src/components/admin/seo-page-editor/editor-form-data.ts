export type SeoPageEditorFormDataInput = {
  pageId?: string | null;
  title: string;
  slug: string;
  routePrefix: string;
  targetKeyword: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  sitemapEnabled: boolean;
  structuredDataBreadcrumb: boolean;
  structuredDataFaq: boolean;
  pageType: string;
  templateKey: string;
  draftContentJson: string;
};

export function buildSeoPageEditorFormData({
  pageId,
  title,
  slug,
  routePrefix,
  targetKeyword,
  seoTitle,
  metaDescription,
  canonicalUrl,
  noindex,
  sitemapEnabled,
  structuredDataBreadcrumb,
  structuredDataFaq,
  pageType,
  templateKey,
  draftContentJson,
}: SeoPageEditorFormDataInput) {
  const formData = new FormData();
  if (pageId) formData.set("id", pageId);
  formData.set("title", title);
  formData.set("slug", slug);
  formData.set("routePrefix", routePrefix);
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
  formData.set("pageType", pageType);
  formData.set("templateKey", templateKey);
  formData.set("draftContent", draftContentJson);
  formData.set("intent", "save");
  return formData;
}
