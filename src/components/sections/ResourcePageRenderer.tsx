import { submitApplicationLead } from "@/app/apply/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { ResourcePageContentView } from "@/components/sections/ResourcePageContent";
import { flattenBlocks, pageChromeSettings } from "@/lib/page-builder/blocks";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";
import { buildResourceLeadFormAttribution } from "@/lib/page-builder/resource-lead-attribution";

type ResourcePageRendererProps = {
  page: PublishedSeoPage;
  leadAttribution?: LeadAttribution;
  idempotencyKeyPrefix: string;
};

export function ResourcePageRenderer({
  page,
  leadAttribution,
  idempotencyKeyPrefix,
}: ResourcePageRendererProps) {
  const chromeSettings = pageChromeSettings(page.published_content);

  return (
    <article className="bg-[#f5fbff]">
      <PageChromeVisibilityMarker settings={chromeSettings} />
      <StructuredData page={page} />
      <div className="mx-auto max-w-5xl px-5 py-14 lg:px-10">
        <ResourcePageContentView
          content={page.published_content}
          renderLeadForm={(block) => {
            const attribution = buildResourceLeadFormAttribution({
              baseAttribution: leadAttribution,
              page,
              block,
            });

            return (
              <PublicLeadForm
                action={submitApplicationLead}
                attribution={attribution}
                idempotencyKey={`${idempotencyKeyPrefix}:${block.id}`}
                intent="apply"
                layout={
                  block.variant === "compact" || block.variant === "sidebar"
                    ? "compact"
                    : "standard"
                }
                submitLabel={block.props.submitLabel}
              />
            );
          }}
        />
      </div>
    </article>
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
  const blocks = flattenBlocks(page.published_content);
  const faqItems = blocks
    .filter((block) => block.type === "faq")
    .flatMap((block) => (block.type === "faq" ? block.props.items : []))
    .filter((item) => item.question && item.answer);
  const graphs: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Resources",
          item: "/resources",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: page.title,
          item: `/resources/${page.slug}`,
        },
      ],
    },
  ];

  if (faqItems.length > 0) {
    graphs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return (
    <>
      {graphs.map((graph, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
    </>
  );
}
