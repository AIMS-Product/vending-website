import { submitApplicationLead } from "@/app/apply/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { ResourcePageContentView } from "@/components/sections/ResourcePageContent";
import { flattenBlocks } from "@/lib/page-builder/blocks";
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
  return (
    <article className="bg-[#f5fbff]">
      <StructuredData page={page} />
      <header className="border-b-2 border-[#111111] bg-[#f5fbff]">
        <div className="mx-auto max-w-5xl px-5 py-16 lg:px-10">
          {page.target_keyword && (
            <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
              {page.target_keyword}
            </p>
          )}
          <h1 className="mt-8 text-[clamp(3rem,6vw,5.5rem)] leading-[0.95] font-black text-[#111111] uppercase">
            {page.title}
          </h1>
          {page.meta_description && (
            <p className="mt-7 max-w-3xl text-xl leading-8 font-semibold text-slate-700">
              {page.meta_description}
            </p>
          )}
        </div>
      </header>

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
