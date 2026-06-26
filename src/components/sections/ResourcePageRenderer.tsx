import { submitApplicationLead } from "@/app/apply/actions";
import { submitQualificationLead } from "@/app/qualification-intake/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { ResourcePageContentView } from "@/components/sections/ResourcePageContent";
import { flattenBlocks, pageChromeSettings } from "@/lib/page-builder/blocks";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";
import {
  buildResourceLeadFormAttribution,
  resolveResourceQualificationAttachment,
} from "@/lib/page-builder/resource-lead-attribution";
import { buildResourcePageStructuredDataGraphs } from "./resource-page-structured-data";

type ResourcePageRendererProps = {
  page: PublishedSeoPage;
  defaultQualificationFormId?: string | null;
  leadAttribution?: LeadAttribution;
  idempotencyKeyPrefix: string;
  showPreviewEmptyState?: boolean;
};

export function ResourcePageRenderer({
  page,
  defaultQualificationFormId,
  leadAttribution,
  idempotencyKeyPrefix,
  showPreviewEmptyState = false,
}: ResourcePageRendererProps) {
  const chromeSettings = pageChromeSettings(page.published_content);
  const isEmptyPreview =
    showPreviewEmptyState && flattenBlocks(page.published_content).length === 0;

  return (
    <article className="bg-[#f5fbff]">
      <PageChromeVisibilityMarker settings={chromeSettings} />
      <StructuredData page={page} />
      <div className="mx-auto max-w-5xl px-5 py-14 lg:px-10">
        {isEmptyPreview ? (
          <ResourcePreviewEmptyState />
        ) : (
          <ResourcePageContentView
            content={page.published_content}
            leadAttribution={leadAttribution}
            linkAttributionContext={{
              sourcePath: page.route_path,
              sourcePageId: page.id,
              sourcePageSlug: page.slug,
              targetKeyword: page.target_keyword,
            }}
            renderLeadForm={(block) => {
              const attribution = buildResourceLeadFormAttribution({
                baseAttribution: leadAttribution,
                page,
                block,
              });
              const qualification = resolveResourceQualificationAttachment({
                page: page.published_content,
                block,
                globalDefaultFormId: defaultQualificationFormId,
              });
              const layout =
                block.variant === "compact" || block.variant === "sidebar"
                  ? "compact"
                  : "standard";

              if (qualification.formId) {
                return (
                  <PublicLeadForm
                    action={submitQualificationLead}
                    attribution={attribution}
                    hiddenFields={{
                      qualification_form_id: qualification.formId,
                      qualification_completion_redirect_path:
                        qualification.completionRedirectPath,
                      qualification_experiment_key: qualification.experimentKey,
                      qualification_variant_key: qualification.variantKey,
                    }}
                    idempotencyKey={`${idempotencyKeyPrefix}:${block.id}`}
                    intent="qualification"
                    layout={layout}
                    submitLabel={block.props.submitLabel}
                  />
                );
              }

              return (
                <PublicLeadForm
                  action={submitApplicationLead}
                  attribution={attribution}
                  idempotencyKey={`${idempotencyKeyPrefix}:${block.id}`}
                  intent="apply"
                  layout={layout}
                  submitLabel={block.props.submitLabel}
                />
              );
            }}
          />
        )}
      </div>
    </article>
  );
}

function ResourcePreviewEmptyState() {
  return (
    <section
      aria-labelledby="resource-preview-empty-title"
      className="rounded-[12px] border-2 border-dashed border-[#111111]/35 bg-white px-6 py-14 text-center shadow-[7px_7px_0_#55b8e8]"
    >
      <p className="text-sm font-black text-[#066a99] uppercase">
        Draft preview
      </p>
      <h1
        id="resource-preview-empty-title"
        className="mt-3 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl"
      >
        No page content yet
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 font-semibold text-slate-700">
        This preview link is working, but the page body is empty. Add a hero,
        copy, media, or lead form block in the editor, then save and preview
        again.
      </p>
    </section>
  );
}

function PageChromeVisibilityMarker({
  settings,
}: {
  settings: ReturnType<typeof pageChromeSettings>;
}) {
  if (settings.showHeader && settings.showFooter) return null;

  return (
    <span
      hidden
      aria-hidden="true"
      data-hide-site-header={settings.showHeader ? undefined : "true"}
      data-hide-site-footer={settings.showFooter ? undefined : "true"}
    />
  );
}

function StructuredData({ page }: { page: PublishedSeoPage }) {
  const graphs = buildResourcePageStructuredDataGraphs(page);

  return (
    <>
      {graphs.map((graph) => (
        <script key={structuredDataKey(graph)} type="application/ld+json">
          {JSON.stringify(graph)}
        </script>
      ))}
    </>
  );
}

function structuredDataKey(graph: unknown) {
  return typeof graph === "object" && graph && "@type" in graph
    ? String(graph["@type" as keyof typeof graph])
    : "structured-data";
}
