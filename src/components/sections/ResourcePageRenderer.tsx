import Link from "next/link";
import { submitApplicationLead } from "@/app/apply/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  flattenBlocks,
  type PageBlock,
  type PageContent,
  type RichTextNode,
} from "@/lib/page-builder/blocks";
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
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <h2 className="mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl">
          {block.props.heading}
        </h2>
        {block.props.body && (
          <p className="mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700">
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
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        {block.props.heading && (
          <h2 className="mt-4 text-2xl leading-tight font-black text-[#111111] uppercase md:text-3xl">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-5 space-y-4 text-base leading-8 font-semibold text-slate-700">
          {block.props.body.nodes.map((node, index) => {
            if (node.type === "heading") {
              return (
                <h3
                  key={index}
                  className="pt-2 text-xl font-black text-[#111111] uppercase"
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
            return <p key={index}>{renderRichTextParagraph(node)}</p>;
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
          className="w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
        />
        {block.props.caption && (
          <figcaption className="mt-4 text-sm font-semibold text-slate-600">
            {block.props.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "video") {
    return (
      <div className="rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8]">
        {block.props.title && (
          <h2 className="text-xl font-black text-[#111111] uppercase">
            {block.props.title}
          </h2>
        )}
        <Link
          href={block.props.url}
          className="mt-3 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111]"
        >
          Watch video
        </Link>
        {block.props.caption && (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {block.props.caption}
          </p>
        )}
      </div>
    );
  }

  if (block.type === "faq") {
    return (
      <div className="max-w-3xl">
        {block.props.heading && (
          <h2 className="text-2xl font-black text-[#111111] uppercase">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-5 divide-y-2 divide-[#bfeeff] rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8]">
          {block.props.items.map((item, index) => (
            <details key={index} className="group p-5">
              <summary className="cursor-pointer text-sm font-black text-[#111111] uppercase">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
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
          <h2 className="text-2xl font-black text-[#111111] uppercase">
            {block.props.heading}
          </h2>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {block.props.cards.map((card, index) => (
            <div
              key={index}
              className="rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8]"
            >
              <h3 className="text-base font-black text-[#111111] uppercase">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                {card.body}
              </p>
              {card.href && (
                <Link
                  href={card.href}
                  className="mt-4 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111]"
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
      <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
        {block.props.eyebrow && (
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <blockquote className="mt-3 text-xl leading-8 font-black text-[#111111]">
          {block.props.body}
        </blockquote>
        {(block.props.name || block.props.context) && (
          <figcaption className="mt-4 text-sm font-semibold text-slate-600">
            {block.props.name}
            {block.props.name && block.props.context ? " - " : ""}
            {block.props.context}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "lead_form") {
    const attribution = buildResourceLeadFormAttribution({
      baseAttribution: leadAttribution,
      page,
      block,
    });
    return (
      <div className="grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
        {(block.props.heading || block.props.body) && (
          <div>
            {block.props.heading && (
              <h2 className="text-2xl font-black text-[#111111] uppercase">
                {block.props.heading}
              </h2>
            )}
            {block.props.body && (
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
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

function renderRichTextParagraph(
  node: Extract<RichTextNode, { type: "paragraph" }>,
) {
  if (!("spans" in node)) return node.text;

  return node.spans.map((span, index) => {
    if (!span.href) return <span key={index}>{span.text}</span>;
    if (span.href.startsWith("/")) {
      return (
        <Link key={index} href={span.href}>
          {span.text}
        </Link>
      );
    }
    return (
      <a key={index} href={span.href} rel="noopener noreferrer">
        {span.text}
      </a>
    );
  });
}

function sectionClass(background: string, spacing: string) {
  const bg =
    background === "muted"
      ? "rounded-[12px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]"
      : background === "brand"
        ? "rounded-[12px] border-2 border-[#111111] bg-[#eaf8ff] p-6 shadow-[7px_7px_0_#111111]"
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
    "inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] px-5 py-3 text-sm font-black uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2";
  if (variant === "secondary") {
    return `${base} bg-white text-[#111111] hover:bg-[#eaf8ff]`;
  }
  if (variant === "text") {
    return "text-sm font-black uppercase text-[#2d9fd6] hover:text-[#111111]";
  }
  return `${base} bg-[#f47b3b] text-[#111111]`;
}
