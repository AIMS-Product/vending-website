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
      <input type="hidden" name="routePrefix" value={editor.routePrefix} />
      <input
        type="hidden"
        name="metaDescription"
        value={editor.metaDescription}
      />
      <input type="hidden" name="seoTitle" value={editor.seoTitle} />
      <input type="hidden" name="targetKeyword" value={editor.targetKeyword} />
      <input type="hidden" name="canonicalUrl" value={editor.canonicalUrl} />
      <input type="hidden" name="pageType" value={editor.pageType} />
      <input type="hidden" name="templateKey" value={editor.templateKey} />
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
      {editor.isCancellingSchedule && (
        <input type="hidden" name="cancelScheduledPublish" value="on" />
      )}
    </>
  );
}
