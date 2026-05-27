import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  type PageBlock,
  type PageContent,
  type RichTextNode,
} from "@/lib/page-builder/blocks";
import {
  resourceColumnGridClass,
  resourceSectionClass,
} from "@/components/sections/resource-page-content-classes";

export type ResourcePageRenderMode = "public" | "editor";
export type ResourcePageLinkMode = "live" | "disabled";
export type LeadFormBlock = Extract<PageBlock, { type: "lead_form" }>;

type ResourcePageContentViewProps = {
  content: PageContent;
  renderLeadForm?: (block: LeadFormBlock) => ReactNode;
  renderMode?: ResourcePageRenderMode;
  linkMode?: ResourcePageLinkMode;
};

type ResourcePageBlockViewProps = {
  block: PageBlock;
  renderLeadForm?: (block: LeadFormBlock) => ReactNode;
  renderMode?: ResourcePageRenderMode;
  linkMode?: ResourcePageLinkMode;
  isPrimaryHero?: boolean;
};

export function ResourcePageContentView({
  content,
  renderLeadForm,
  renderMode = "public",
  linkMode = "live",
}: ResourcePageContentViewProps) {
  const primaryHeroId = findPrimaryHeroId(content);

  return (
    <div className="space-y-14">
      {content.sections.map((section) => (
        <section
          key={section.id}
          className={resourceSectionClass(section.background, section.spacing)}
        >
          <div className={resourceColumnGridClass(section.columns.length)}>
            {section.columns.map((column) => (
              <div key={column.id} className="space-y-8">
                {column.blocks.map((block) => (
                  <ResourcePageBlockView
                    key={block.id}
                    block={block}
                    renderLeadForm={renderLeadForm}
                    renderMode={renderMode}
                    linkMode={linkMode}
                    isPrimaryHero={block.id === primaryHeroId}
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

function ResourcePageBlockView({
  block,
  renderLeadForm,
  renderMode = "public",
  linkMode = "live",
  isPrimaryHero = false,
}: ResourcePageBlockViewProps) {
  if (block.type === "hero") {
    const HeadingTag = isPrimaryHero ? "h1" : "h2";

    if (block.variant === "split") {
      return (
        <div className="grid items-center gap-10 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div>
            {block.props.eyebrow && (
              <p className="text-sm font-black text-[#55b8e8] uppercase">
                {block.props.eyebrow}
              </p>
            )}
            <HeadingTag className="mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl">
              {editorFallback(block.props.heading, "Hero headline", renderMode)}
            </HeadingTag>
            {(block.props.body || renderMode === "editor") && (
              <p className="mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700">
                {editorFallback(block.props.body, "Hero body copy", renderMode)}
              </p>
            )}
            {((block.props.ctaLabel && block.props.ctaHref) ||
              renderMode === "editor") && (
              <ResourceLink
                href={block.props.ctaHref || "#"}
                trackingName={block.props.ctaTrackingName}
                linkMode={linkMode}
                className={`${resourceCtaClass("primary")} mt-7`}
              >
                {editorFallback(block.props.ctaLabel, "CTA label", renderMode)}
              </ResourceLink>
            )}
          </div>
          <HeroSplitAside block={block} renderMode={renderMode} />
        </div>
      );
    }

    if (block.variant === "compact") {
      return (
        <div className="mx-auto max-w-3xl py-8 text-center">
          {block.props.eyebrow && (
            <p className="text-sm font-black text-[#55b8e8] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <HeadingTag className="mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl">
            {editorFallback(block.props.heading, "Hero headline", renderMode)}
          </HeadingTag>
          {(block.props.body || renderMode === "editor") && (
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
              {editorFallback(block.props.body, "Hero body copy", renderMode)}
            </p>
          )}
          {((block.props.ctaLabel && block.props.ctaHref) ||
            renderMode === "editor") && (
            <ResourceLink
              href={block.props.ctaHref || "#"}
              trackingName={block.props.ctaTrackingName}
              linkMode={linkMode}
              className={`${resourceCtaClass("primary")} mt-7`}
            >
              {editorFallback(block.props.ctaLabel, "CTA label", renderMode)}
            </ResourceLink>
          )}
        </div>
      );
    }

    if (block.variant === "editorial") {
      return (
        <div className="max-w-4xl rounded-[12px] bg-[#eaf8ff] px-6 py-8 shadow-[inset_4px_0_0_#55b8e8]">
          {block.props.eyebrow && (
            <p className="text-sm font-black text-[#55b8e8] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <HeadingTag className="mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl">
            {editorFallback(block.props.heading, "Hero headline", renderMode)}
          </HeadingTag>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500 uppercase">
            <span>Resource guide</span>
            <span className="size-1 rounded-full bg-slate-400" />
            <span>Editor approved block</span>
          </div>
          {(block.props.body || renderMode === "editor") && (
            <p className="mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700">
              {editorFallback(block.props.body, "Hero body copy", renderMode)}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="max-w-4xl py-8">
        {block.props.eyebrow && (
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <HeadingTag className="mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl">
          {editorFallback(block.props.heading, "Hero headline", renderMode)}
        </HeadingTag>
        {(block.props.body || renderMode === "editor") && (
          <p className="mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700">
            {editorFallback(block.props.body, "Hero body copy", renderMode)}
          </p>
        )}
        {((block.props.ctaLabel && block.props.ctaHref) ||
          renderMode === "editor") && (
          <ResourceLink
            href={block.props.ctaHref || "#"}
            trackingName={block.props.ctaTrackingName}
            linkMode={linkMode}
            className={`${resourceCtaClass("primary")} mt-7`}
          >
            {editorFallback(block.props.ctaLabel, "CTA label", renderMode)}
          </ResourceLink>
        )}
      </div>
    );
  }

  if (block.type === "rich_text") {
    const richTextFrameClass =
      block.variant === "intro"
        ? "max-w-4xl border-l-4 border-[#55b8e8] pl-6"
        : block.variant === "compact"
          ? "max-w-2xl"
          : block.variant === "checklist"
            ? "max-w-3xl rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]"
            : "max-w-3xl";
    const richTextHeadingClass =
      block.variant === "intro"
        ? "mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl"
        : block.variant === "compact"
          ? "mt-3 text-xl leading-tight font-black text-[#111111] uppercase md:text-2xl"
          : "mt-4 text-2xl leading-tight font-black text-[#111111] uppercase md:text-3xl";

    return (
      <div className={richTextFrameClass}>
        {block.props.eyebrow && (
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        {(block.props.heading || renderMode === "editor") && (
          <h2 className={richTextHeadingClass}>
            {editorFallback(block.props.heading, "Section heading", renderMode)}
          </h2>
        )}
        <div className="mt-5 space-y-4 text-base leading-8 font-semibold text-slate-700">
          {block.variant === "checklist" &&
          block.props.body.nodes.length === 0 &&
          renderMode === "editor" ? (
            <ChecklistPlaceholder />
          ) : block.props.body.nodes.length === 0 && renderMode === "editor" ? (
            <p className="text-slate-400">Write the page copy here.</p>
          ) : (
            block.props.body.nodes.map((node) => {
              if (node.type === "heading") {
                return (
                  <h3
                    key={richTextNodeKey(node)}
                    className="pt-2 text-xl font-black text-[#111111] uppercase"
                  >
                    {editorFallback(node.text, "Subheading", renderMode)}
                  </h3>
                );
              }
              if (node.type === "list") {
                const ListTag = node.style === "numbered" ? "ol" : "ul";
                return (
                  <ListTag
                    key={richTextNodeKey(node)}
                    className={
                      block.variant === "checklist"
                        ? "ml-0 list-none space-y-3"
                        : "ml-5 list-outside space-y-2"
                    }
                  >
                    {node.items.map((item) => (
                      <li
                        key={item}
                        className={
                          block.variant === "checklist"
                            ? "flex gap-3 before:mt-1 before:block before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-[#111111] before:bg-[#55b8e8] before:content-['']"
                            : undefined
                        }
                      >
                        {editorFallback(item, "List item", renderMode)}
                      </li>
                    ))}
                  </ListTag>
                );
              }
              return (
                <p key={richTextNodeKey(node)}>
                  <RichTextParagraphContent
                    node={node}
                    linkMode={linkMode}
                    renderMode={renderMode}
                  />
                </p>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (block.type === "image") {
    const imageFrameClass =
      block.variant === "inline"
        ? "grid items-center gap-6 md:grid-cols-[minmax(160px,0.75fr)_minmax(0,1fr)]"
        : block.variant === "feature"
          ? "grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.75fr)]"
          : "";
    const imageClass =
      block.variant === "wide"
        ? "aspect-[16/7] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
        : block.variant === "inline"
          ? "aspect-square w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
          : block.variant === "feature"
            ? "aspect-[4/3] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[9px_9px_0_#55b8e8]"
            : "w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]";
    const mediaNode = block.props.src ? (
      <Image
        src={block.props.src}
        alt={block.props.altText}
        width={1600}
        height={900}
        sizes="(max-width: 1024px) 100vw, 900px"
        className={imageClass}
      />
    ) : (
      <div
        className={`${imageClass} grid place-items-center border-dashed bg-white text-sm font-semibold text-slate-400`}
      >
        Image preview
      </div>
    );
    const captionNode =
      block.props.caption || renderMode === "editor" ? (
        <figcaption
          className={
            block.variant === "inline" || block.variant === "feature"
              ? "text-base leading-7 font-semibold text-slate-600"
              : "mt-4 text-sm font-semibold text-slate-600"
          }
        >
          {editorFallback(block.props.caption, "Image caption", renderMode)}
        </figcaption>
      ) : null;

    if (block.variant === "feature") {
      return (
        <figure className={imageFrameClass}>
          {(block.props.caption || renderMode === "editor") && (
            <figcaption className="text-base leading-7 font-semibold text-slate-600">
              <p className="text-sm font-black text-[#55b8e8] uppercase">
                Featured media
              </p>
              <p className="mt-4">
                {editorFallback(
                  block.props.caption,
                  "Image caption",
                  renderMode,
                )}
              </p>
            </figcaption>
          )}
          <div className="md:order-2">{mediaNode}</div>
        </figure>
      );
    }

    return (
      <figure className={imageFrameClass}>
        {mediaNode}
        {captionNode}
      </figure>
    );
  }

  if (block.type === "video") {
    if (block.variant === "inline") {
      return (
        <div className="grid items-center gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8] md:grid-cols-[180px_minmax(0,1fr)]">
          <VideoPanel />
          <div>
            {(block.props.title || renderMode === "editor") && (
              <h2 className="text-xl font-black text-[#111111] uppercase">
                {editorFallback(block.props.title, "Video title", renderMode)}
              </h2>
            )}
            {(block.props.caption || renderMode === "editor") && (
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-600">
                {editorFallback(
                  block.props.caption,
                  "Video caption",
                  renderMode,
                )}
              </p>
            )}
            {(block.props.url || renderMode === "editor") && (
              <ResourceLink
                href={block.props.url || "#"}
                linkMode={linkMode}
                className="mt-4 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111]"
              >
                Watch video
              </ResourceLink>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8] ${
          block.variant === "wide" ? "p-6" : "p-5"
        }`}
      >
        <VideoPanel wide={block.variant === "wide"} />
        {(block.props.title || renderMode === "editor") && (
          <h2 className="mt-5 text-xl font-black text-[#111111] uppercase">
            {editorFallback(block.props.title, "Video title", renderMode)}
          </h2>
        )}
        {(block.props.url || renderMode === "editor") && (
          <ResourceLink
            href={block.props.url || "#"}
            linkMode={linkMode}
            className="mt-3 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111]"
          >
            Watch video
          </ResourceLink>
        )}
        {(block.props.caption || renderMode === "editor") && (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {editorFallback(block.props.caption, "Video caption", renderMode)}
          </p>
        )}
      </div>
    );
  }

  if (block.type === "faq") {
    const faqFrameClass =
      block.variant === "compact"
        ? "max-w-2xl"
        : block.variant === "accordion"
          ? "max-w-3xl"
          : "max-w-3xl";
    return (
      <div className={faqFrameClass}>
        {(block.props.heading || renderMode === "editor") && (
          <h2 className="text-2xl font-black text-[#111111] uppercase">
            {editorFallback(block.props.heading, "FAQ heading", renderMode)}
          </h2>
        )}
        <div className="mt-5 divide-y-2 divide-[#bfeeff] rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8]">
          {block.props.items.length === 0 && renderMode === "editor" ? (
            <div className="p-5 text-sm font-semibold text-slate-400">
              Add at least one FAQ question and answer.
            </div>
          ) : (
            block.props.items.map((item, index) => (
              <details
                key={faqItemKey(item)}
                className="group p-5"
                open={block.variant === "standard" && index === 0}
              >
                <summary className="cursor-pointer text-sm font-black text-[#111111] uppercase">
                  {editorFallback(item.question, "Question", renderMode)}
                </summary>
                {block.variant !== "compact" && (
                  <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                    {editorFallback(item.answer, "Answer", renderMode)}
                  </p>
                )}
              </details>
            ))
          )}
        </div>
      </div>
    );
  }

  if (block.type === "card_grid") {
    const gridClass =
      block.variant === "compact"
        ? "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        : block.variant === "feature"
          ? "mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]"
          : "mt-5 grid gap-4 md:grid-cols-3";
    return (
      <div>
        {(block.props.heading || renderMode === "editor") && (
          <h2 className="text-2xl font-black text-[#111111] uppercase">
            {editorFallback(
              block.props.heading,
              "Card grid heading",
              renderMode,
            )}
          </h2>
        )}
        <div className={gridClass}>
          {block.props.cards.length === 0 && renderMode === "editor" ? (
            <div className="rounded-[10px] border-2 border-dashed border-[#111111]/35 bg-white p-5 text-sm font-semibold text-slate-400 shadow-[5px_5px_0_#55b8e8]">
              Add cards in block settings.
            </div>
          ) : (
            block.props.cards.map((card, index) => (
              <div
                key={cardKey(card)}
                className={`rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8] ${
                  block.variant === "feature" && index === 0
                    ? "md:row-span-2 md:min-h-64"
                    : ""
                } ${block.variant === "compact" ? "p-4" : ""}`}
              >
                <h3 className="text-base font-black text-[#111111] uppercase">
                  {editorFallback(card.title, "Card title", renderMode)}
                </h3>
                <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                  {editorFallback(card.body, "Card body", renderMode)}
                </p>
                {((card.href && card.href.length > 0) ||
                  renderMode === "editor") && (
                  <ResourceLink
                    href={card.href || "#"}
                    linkMode={linkMode}
                    className="mt-4 inline-flex text-sm font-black text-[#2d9fd6] uppercase hover:text-[#111111]"
                  >
                    Learn more
                  </ResourceLink>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (block.type === "proof") {
    if (block.variant === "stat") {
      return (
        <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
          {block.props.eyebrow && (
            <p className="text-sm font-black text-[#55b8e8] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <blockquote className="mt-4 text-4xl leading-none font-black text-[#111111] uppercase md:text-5xl">
            {editorFallback(block.props.body, "Proof stat", renderMode)}
          </blockquote>
          {(block.props.name ||
            block.props.context ||
            renderMode === "editor") && (
            <figcaption className="mt-5 text-sm font-semibold text-slate-600">
              {editorFallback(block.props.name, "Source", renderMode)}
              {(block.props.name || renderMode === "editor") &&
              (block.props.context || renderMode === "editor")
                ? " - "
                : ""}
              {editorFallback(block.props.context, "Context", renderMode)}
            </figcaption>
          )}
        </figure>
      );
    }

    if (block.variant === "logo") {
      return (
        <aside className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
          {block.props.eyebrow && (
            <p className="text-sm font-black text-[#55b8e8] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[block.props.name, block.props.context, block.props.body]
              .filter((item) => item || renderMode === "editor")
              .slice(0, 3)
              .map((item) => (
                <div
                  key={item || "proof-placeholder"}
                  className="grid min-h-20 place-items-center rounded-[8px] border-2 border-[#111111] bg-[#f5fbff] px-4 text-center text-sm font-black text-[#111111] uppercase"
                >
                  {editorFallback(item, "Proof", renderMode)}
                </div>
              ))}
          </div>
        </aside>
      );
    }

    return (
      <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
        {block.props.eyebrow && (
          <p className="text-sm font-black text-[#55b8e8] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <blockquote className="mt-3 text-xl leading-8 font-black text-[#111111]">
          {editorFallback(block.props.body, "Proof quote or stat", renderMode)}
        </blockquote>
        {(block.props.name ||
          block.props.context ||
          renderMode === "editor") && (
          <figcaption className="mt-4 text-sm font-semibold text-slate-600">
            {editorFallback(block.props.name, "Name", renderMode)}
            {(block.props.name || renderMode === "editor") &&
            (block.props.context || renderMode === "editor")
              ? " - "
              : ""}
            {editorFallback(block.props.context, "Context", renderMode)}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "lead_form") {
    if (block.variant === "sidebar") {
      return (
        <div className="grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <div>
            {(block.props.heading || renderMode === "editor") && (
              <h2 className="text-2xl font-black text-[#111111] uppercase">
                {editorFallback(
                  block.props.heading,
                  "Lead form heading",
                  renderMode,
                )}
              </h2>
            )}
            {(block.props.body || renderMode === "editor") && (
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                {editorFallback(block.props.body, "Lead form copy", renderMode)}
              </p>
            )}
          </div>
          {renderLeadForm ? (
            renderLeadForm(block)
          ) : (
            <ResourceLeadFormPreview
              submitLabel={block.props.submitLabel}
              compact
            />
          )}
        </div>
      );
    }

    return (
      <div
        className={`grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8] ${
          block.variant === "compact" ? "p-5" : "p-6"
        }`}
      >
        {(block.props.heading ||
          block.props.body ||
          renderMode === "editor") && (
          <div>
            {(block.props.heading || renderMode === "editor") && (
              <h2 className="text-2xl font-black text-[#111111] uppercase">
                {editorFallback(
                  block.props.heading,
                  "Lead form heading",
                  renderMode,
                )}
              </h2>
            )}
            {(block.props.body || renderMode === "editor") && (
              <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                {editorFallback(block.props.body, "Lead form copy", renderMode)}
              </p>
            )}
          </div>
        )}
        {renderLeadForm ? (
          renderLeadForm(block)
        ) : (
          <ResourceLeadFormPreview
            submitLabel={block.props.submitLabel}
            compact={block.variant === "compact"}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <ResourceLink
        href={block.props.href || "#"}
        trackingName={block.props.trackingName}
        linkMode={linkMode}
        className={resourceCtaClass(block.variant)}
      >
        {editorFallback(block.props.label, "CTA label", renderMode)}
      </ResourceLink>
    </div>
  );
}

function ResourceLeadFormPreview({
  submitLabel,
  compact = false,
}: {
  submitLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid rounded-[12px] border-2 border-[#111111] bg-white shadow-[8px_8px_0_#55b8e8] ${
        compact ? "gap-4 p-4" : "gap-5 p-5 sm:p-7"
      }`}
    >
      <div className={`grid gap-5 ${compact ? "" : "sm:grid-cols-2"}`}>
        {(compact
          ? ["Name", "Email"]
          : [
              "Name",
              "Email",
              "Phone",
              "City",
              "State",
              "Business stage",
              "Available startup budget",
              "Launch timeline",
            ]
        ).map((label) => (
          <div key={label}>
            <div className="mb-2 block text-sm font-black text-[#111111] uppercase">
              {label}
            </div>
            <div className="min-h-12 rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-400">
              {label}
            </div>
          </div>
        ))}
      </div>
      {!compact && (
        <div>
          <div className="mb-2 block text-sm font-black text-[#111111] uppercase">
            What are you trying to build?
          </div>
          <div className="min-h-24 rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-400">
            Message
          </div>
        </div>
      )}
      <span
        aria-disabled="true"
        className="inline-flex min-h-12 max-w-max items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 py-3 text-sm font-black text-[#111111] uppercase opacity-80 shadow-[5px_5px_0_#111111]"
      >
        {submitLabel || "Submit application"}
      </span>
    </div>
  );
}

function ChecklistPlaceholder() {
  return (
    <ul className="space-y-3">
      {["Checklist item 1", "Checklist item 2", "Checklist item 3"].map(
        (item) => (
          <li
            key={item}
            className="flex gap-3 text-slate-400 before:mt-1 before:block before:size-5 before:shrink-0 before:rounded-full before:border-2 before:border-[#111111] before:bg-[#55b8e8] before:content-['']"
          >
            Checklist item
          </li>
        ),
      )}
    </ul>
  );
}

function VideoPanel({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`grid place-items-center rounded-[10px] border-2 border-[#111111] bg-[#f5fbff] ${
        wide ? "aspect-[16/7]" : "aspect-video"
      }`}
    >
      <span className="grid size-14 place-items-center rounded-full border-2 border-[#111111] bg-white shadow-[4px_4px_0_#55b8e8]">
        <span className="ml-1 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-[#111111]" />
      </span>
    </div>
  );
}

function HeroSplitAside({
  block,
  renderMode,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  renderMode: ResourcePageRenderMode;
}) {
  if (block.props.mediaSrc) {
    return (
      <figure>
        <Image
          src={block.props.mediaSrc}
          alt={block.props.mediaAltText ?? ""}
          width={900}
          height={1125}
          sizes="(max-width: 1024px) 100vw, 40vw"
          className="aspect-[4/5] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]"
        />
        {block.props.mediaCaption && (
          <figcaption className="mt-4 text-sm font-semibold text-slate-600">
            {block.props.mediaCaption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.props.proofText) {
    return (
      <aside className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
        <p className="text-sm font-black text-[#55b8e8] uppercase">Proof</p>
        <p className="mt-4 text-xl leading-8 font-black text-[#111111]">
          {block.props.proofText}
        </p>
      </aside>
    );
  }

  if (renderMode !== "editor") return null;

  return (
    <aside className="grid aspect-[4/5] place-items-center rounded-[10px] border-2 border-dashed border-[#111111]/35 bg-white p-6 text-center text-sm font-semibold text-slate-400 shadow-[7px_7px_0_#55b8e8]">
      Add split hero media or proof in block settings.
    </aside>
  );
}

function ResourceLink({
  href,
  trackingName,
  linkMode,
  className,
  children,
}: {
  href: string;
  trackingName?: string;
  linkMode: ResourcePageLinkMode;
  className: string;
  children: ReactNode;
}) {
  const disabled = linkMode === "disabled" || href === "#";

  if (disabled) {
    return (
      <span
        data-tracking-name={trackingName}
        aria-disabled="true"
        className={className}
      >
        {children}
      </span>
    );
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} data-tracking-name={trackingName} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      data-tracking-name={trackingName}
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function RichTextParagraphContent({
  node,
  linkMode,
  renderMode,
}: {
  node: Extract<RichTextNode, { type: "paragraph" }>;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
}) {
  return renderRichTextParagraph(node, linkMode, renderMode);
}

function renderRichTextParagraph(
  node: Extract<RichTextNode, { type: "paragraph" }>,
  linkMode: ResourcePageLinkMode,
  renderMode: ResourcePageRenderMode,
) {
  if (!("spans" in node)) {
    return editorFallback(node.text, "Paragraph copy", renderMode);
  }

  if (node.spans.length === 0 && renderMode === "editor") {
    return <span className="text-slate-400">Paragraph copy</span>;
  }

  return node.spans.map((span) => {
    const text = editorFallback(span.text, "Link text", renderMode);
    if (!span.href) return <span key={richTextSpanKey(span)}>{text}</span>;
    return (
      <ResourceLink
        key={richTextSpanKey(span)}
        href={span.href}
        linkMode={linkMode}
        className="text-[#2d9fd6] underline underline-offset-4 hover:text-[#111111]"
      >
        {text}
      </ResourceLink>
    );
  });
}

function richTextNodeKey(node: RichTextNode) {
  if (node.type === "list") {
    return `${node.type}:${node.style}:${node.items.join("|")}`;
  }
  if ("spans" in node) {
    return `${node.type}:${node.spans.map(richTextSpanKey).join("|")}`;
  }
  return `${node.type}:${node.text}`;
}

function richTextSpanKey(span: { text: string; href?: string }) {
  return `${span.text}:${span.href ?? ""}`;
}

function faqItemKey(
  item: Extract<PageBlock, { type: "faq" }>["props"]["items"][number],
) {
  return `${item.question}:${item.answer}`;
}

function cardKey(
  card: Extract<PageBlock, { type: "card_grid" }>["props"]["cards"][number],
) {
  return `${card.title}:${card.body}:${card.href ?? ""}`;
}

function editorFallback(
  value: string | null | undefined,
  fallback: string,
  renderMode: ResourcePageRenderMode,
) {
  if (value && value.trim().length > 0) return value;
  if (renderMode === "editor") {
    return <span className="text-slate-400">{fallback}</span>;
  }
  return "";
}

function findPrimaryHeroId(content: PageContent) {
  for (const section of content.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        if (block.type === "hero") return block.id;
      }
    }
  }
  return undefined;
}

function resourceCtaClass(variant: PageBlock["variant"]) {
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
