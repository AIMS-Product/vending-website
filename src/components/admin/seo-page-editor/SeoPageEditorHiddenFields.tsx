"use client";

import type { SeoPageEditorController } from "@/components/admin/seo-page-editor/useSeoPageEditorController";

export function SeoPageEditorHiddenFields({
  editor,
}: {
  editor: SeoPageEditorController;
}) {
  return (
    <>
      <input type="hidden" name="title" value={editor.title} />
      <input type="hidden" name="slug" value={editor.visibleSlug} />
      <input
        type="hidden"
        name="metaDescription"
        value={editor.metaDescription}
      />
      <input type="hidden" name="seoTitle" value={editor.seoTitle} />
      <input type="hidden" name="targetKeyword" value={editor.targetKeyword} />
      <input type="hidden" name="canonicalUrl" value={editor.canonicalUrl} />
      {editor.noindex && <input type="hidden" name="noindex" value="on" />}
      {editor.sitemapEnabled && !editor.noindex && (
        <input type="hidden" name="sitemapEnabled" value="on" />
      )}
      {editor.structuredDataBreadcrumb && (
        <input type="hidden" name="structuredDataBreadcrumb" value="on" />
      )}
      {editor.structuredDataFaq && (
        <input type="hidden" name="structuredDataFaq" value="on" />
      )}
    </>
  );
}
