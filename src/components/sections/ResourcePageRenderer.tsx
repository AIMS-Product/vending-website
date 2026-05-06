import Link from "next/link";
import { submitApplicationLead } from "@/app/apply/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  flattenBlocks,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

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
    <article className="bg-white">
      <StructuredData page={page} />
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
          {page.target_keyword && (
            <p className="text-brand-500 text-sm font-semibold tracking-wide uppercase">
              {page.target_keyword}
            </p>
          )}
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            {page.title}
          </h1>
          {page.meta_description && (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {page.meta_description}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-14 lg:px-10">
        <PageContentRenderer
          content={page.published_content}
          page={page}
          leadAttribution={leadAttribution}
          idempotencyKeyPrefix={idempotencyKeyPrefix}
        />
      </div>
    </article>
  );
}

function PageContentRenderer({
  content,
  page,
  leadAttribution,
  idempotencyKeyPrefix,
}: {
  content: PageContent;
  page: PublishedSeoPage;
  leadAttribution?: LeadAttribution;
  idempotencyKeyPrefix: string;
}) {
  return (
    <div className="space-y-14">
      {content.sections.map((section) => (
        <section
          key={section.id}
          className={sectionClass(section.background, section.spacing)}
        >
          <div className={columnGridClass(section.columns.length)}>
            {section.columns.map((column) => (
              <div key={column.id} className="space-y-8">
                {column.blocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    page={page}
                    leadAttribution={leadAttribution}
                    idempotencyKeyPrefix={idempotencyKeyPrefix}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockRenderer({
  block,
  page,
  leadAttribution,
  idempotencyKeyPrefix,
}: {
  block: PageBlock;
  page: PublishedSeoPage;
  leadAttribution?: LeadAttribution;
  idempotencyKeyPrefix: string;
}) {
  if (block.type === "hero") {
    return (
      <div className="max-w-4xl py-8">
        {block.props.eyebrow && (
          <p className="text-brand-500 text-sm font-semibold tracking-wide uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <h2 className="mt-3 text-3xl font-semibold text-slate-950 md:text-4xl">
          {block.props.heading}
        </h2>
        {block.props.body && (
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            {block.props.body}
          </p>
        )}
        {block.props.ctaLabel && block.props.ctaHref && (
          <Link
            href={block.props.ctaHref}
            data-tracking-name={block.props.ctaTrackingName}
            className={`${ctaClass("primary")} mt-7`}
          >
            {block.props.ctaLabel}
          </Link>
        )}
      </div>
    );
  }

  if (block.type === "rich_text") {
    return (
      <div className="max-w-3xl">
        {block.props.eyebrow && (
          <p className="text-brand-500 text-sm font-semibold tracking-wide uppercase">
            {block.props.eyebrow}
          </p>
        )}
        {block.props.heading && (
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
          {block.props.body.nodes.map((node, index) => {
            if (node.type === "heading") {
              return (
                <h3
                  key={index}
                  className="pt-2 text-xl font-semibold text-slate-950"
                >
                  {node.text}
                </h3>
              );
            }
            if (node.type === "list") {
              const ListTag = node.style === "numbered" ? "ol" : "ul";
              return (
                <ListTag key={index} className="ml-5 list-outside space-y-2">
                  {node.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ListTag>
              );
            }
            return <p key={index}>{node.text}</p>;
          })}
        </div>
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.props.src}
          alt={block.props.altText}
          className="w-full rounded-xl border border-slate-200 object-cover shadow-sm"
        />
        {block.props.caption && (
          <figcaption className="mt-3 text-sm text-slate-500">
            {block.props.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "video") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        {block.props.title && (
          <h2 className="text-xl font-semibold text-slate-950">
            {block.props.title}
          </h2>
        )}
        <Link
          href={block.props.url}
          className="text-brand-600 hover:text-brand-500 mt-3 inline-flex text-sm font-semibold"
        >
          Watch video
        </Link>
        {block.props.caption && (
          <p className="mt-3 text-sm text-slate-500">{block.props.caption}</p>
        )}
      </div>
    );
  }

  if (block.type === "faq") {
    return (
      <div className="max-w-3xl">
        {block.props.heading && (
          <h2 className="text-2xl font-semibold text-slate-950">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {block.props.items.map((item, index) => (
            <details key={index} className="group p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "card_grid") {
    return (
      <div>
        {block.props.heading && (
          <h2 className="text-2xl font-semibold text-slate-950">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {block.props.cards.map((card, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-950">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {card.body}
              </p>
              {card.href && (
                <Link
                  href={card.href}
                  className="text-brand-600 hover:text-brand-500 mt-4 inline-flex text-sm font-semibold"
                >
                  Learn more
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "proof") {
    return (
      <figure className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        {block.props.eyebrow && (
          <p className="text-brand-500 text-sm font-semibold uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <blockquote className="mt-3 text-xl leading-8 font-semibold text-slate-950">
          {block.props.body}
        </blockquote>
        {(block.props.name || block.props.context) && (
          <figcaption className="mt-4 text-sm text-slate-600">
            {block.props.name}
            {block.props.name && block.props.context ? " - " : ""}
            {block.props.context}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "lead_form") {
    const attribution = {
      ...(leadAttribution ?? emptyLeadAttribution(`/resources/${page.slug}`)),
      source_page_id: page.id,
      source_page_slug: page.slug,
      target_keyword: page.target_keyword ?? "",
      source_block_id: block.id,
      source_cta_tracking_name: block.props.trackingName,
    };
    return (
      <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
        {(block.props.heading || block.props.body) && (
          <div>
            {block.props.heading && (
              <h2 className="text-2xl font-semibold text-slate-950">
                {block.props.heading}
              </h2>
            )}
            {block.props.body && (
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {block.props.body}
              </p>
            )}
          </div>
        )}
        <PublicLeadForm
          action={submitApplicationLead}
          attribution={attribution}
          idempotencyKey={`${idempotencyKeyPrefix}:${block.id}`}
          intent="apply"
          submitLabel={block.props.submitLabel}
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        href={block.props.href}
        data-tracking-name={block.props.trackingName}
        className={ctaClass(block.variant)}
      >
        {block.props.label}
      </Link>
    </div>
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

function emptyLeadAttribution(landingPath: string): LeadAttribution {
  return {
    source_path: landingPath,
    landing_path: landingPath,
    referrer: "",
    source_page_id: "",
    source_page_slug: "",
    target_keyword: "",
    source_block_id: "",
    source_cta_tracking_name: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  };
}

function sectionClass(background: string, spacing: string) {
  const bg =
    background === "muted"
      ? "rounded-xl bg-slate-50"
      : background === "brand"
        ? "rounded-xl bg-brand-50"
        : "";
  const pad =
    spacing === "compact" ? "py-6" : spacing === "spacious" ? "py-12" : "py-8";
  return `${bg} ${pad}`;
}

function columnGridClass(count: number) {
  if (count <= 1) return "grid gap-8";
  return "grid gap-8 md:grid-cols-2";
}

function ctaClass(variant: PageBlock["variant"]) {
  const base =
    "inline-flex rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";
  if (variant === "secondary") {
    return `${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
  }
  if (variant === "text") {
    return "text-brand-600 hover:text-brand-500 text-sm font-semibold";
  }
  return `${base} bg-brand-500 text-white hover:bg-brand-600`;
}
