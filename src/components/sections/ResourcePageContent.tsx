import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import {
  cardGridLinkLabel,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import {
  getVideoEmbed,
  type VideoEmbed,
} from "@/lib/page-builder/video-embeds";
import {
  resourceColumnGridClass,
  resourceSectionClass,
} from "@/components/sections/resource-page-content-classes";
import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";
import { HeroBlock } from "@/components/sections/resource-blocks/HeroBlock";
import { RichTextBlock } from "@/components/sections/resource-blocks/RichTextBlock";
import { YouTubeEmbedFrame } from "@/components/sections/YouTubeEmbedFrame";
import {
  ResourceLink,
  editorFallback,
  previewLayoutClass,
  resourceCtaClass,
  type LeadFormBlock,
  type ResourcePageLinkMode,
  type ResourcePageRenderMode,
} from "@/components/sections/resource-blocks/shared";

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
  previewLayout?: boolean;
};

export function ResourcePageBlockPreview({ block }: { block: PageBlock }) {
  return (
    <ResourcePageBlockView
      block={block}
      linkMode="disabled"
      renderMode="public"
      isPrimaryHero={block.type === "hero"}
      previewLayout
    />
  );
}

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
  previewLayout = false,
}: ResourcePageBlockViewProps) {
  if (block.type === "hero") {
    return (
      <HeroBlock
        block={block}
        renderMode={renderMode}
        linkMode={linkMode}
        isPrimaryHero={isPrimaryHero}
        previewLayout={previewLayout}
      />
    );
  }

  if (block.type === "rich_text") {
    return (
      <RichTextBlock
        block={block}
        renderMode={renderMode}
        linkMode={linkMode}
      />
    );
  }

  if (block.type === "image") {
    const imageFrameClass =
      block.variant === "inline"
        ? previewLayoutClass(
            previewLayout,
            "grid items-center gap-6 grid-cols-[minmax(160px,0.75fr)_minmax(0,1fr)]",
            "grid items-center gap-6 md:grid-cols-[minmax(160px,0.75fr)_minmax(0,1fr)]",
          )
        : block.variant === "feature"
          ? previewLayoutClass(
              previewLayout,
              "grid items-center gap-6 grid-cols-[minmax(0,1fr)_minmax(180px,0.75fr)]",
              "grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.75fr)]",
            )
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
      isBlockFieldVisible(block, "caption") &&
      (block.props.caption || renderMode === "editor") ? (
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
          {isBlockFieldVisible(block, "caption") &&
            (block.props.caption || renderMode === "editor") && (
              <figcaption className="text-base leading-7 font-semibold text-slate-600">
                <p className="text-sm font-black text-[#066a99] uppercase">
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
          <div
            className={previewLayoutClass(
              previewLayout,
              "order-2",
              "md:order-2",
            )}
          >
            {mediaNode}
          </div>
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
    const videoEmbed = getVideoEmbed(block.props.url);
    const videoPanel = (
      <ResourceVideoPanel
        embed={videoEmbed}
        title={block.props.title || "Video"}
        linkMode={linkMode}
        renderMode={renderMode}
        thumbnailUrl={block.props.thumbnailSrc}
        url={block.props.url}
      />
    );
    const showFallbackLink =
      !videoEmbed && (Boolean(block.props.url) || renderMode === "editor");

    if (block.variant === "inline") {
      return (
        <div
          className={`grid items-center gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8] ${previewLayoutClass(
            previewLayout,
            "grid-cols-[180px_minmax(0,1fr)]",
            "md:grid-cols-[180px_minmax(0,1fr)]",
          )}`}
        >
          {videoPanel}
          <div>
            {isBlockFieldVisible(block, "title") &&
              (block.props.title || renderMode === "editor") && (
                <h2 className="text-xl font-black text-[#111111] uppercase">
                  {editorFallback(block.props.title, "Video title", renderMode)}
                </h2>
              )}
            {isBlockFieldVisible(block, "caption") &&
              (block.props.caption || renderMode === "editor") && (
                <p className="mt-3 text-sm leading-7 font-semibold text-slate-600">
                  {editorFallback(
                    block.props.caption,
                    "Video caption",
                    renderMode,
                  )}
                </p>
              )}
            {showFallbackLink && (
              <ResourceLink
                href={block.props.url || "#"}
                linkMode={linkMode}
                className="mt-4 inline-flex text-sm font-black text-[#066a99] uppercase hover:text-[#111111]"
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
        {videoPanel}
        {isBlockFieldVisible(block, "title") &&
          (block.props.title || renderMode === "editor") && (
            <h2 className="mt-5 text-xl font-black text-[#111111] uppercase">
              {editorFallback(block.props.title, "Video title", renderMode)}
            </h2>
          )}
        {showFallbackLink && (
          <ResourceLink
            href={block.props.url || "#"}
            linkMode={linkMode}
            className="mt-3 inline-flex text-sm font-black text-[#066a99] uppercase hover:text-[#111111]"
          >
            Watch video
          </ResourceLink>
        )}
        {isBlockFieldVisible(block, "caption") &&
          (block.props.caption || renderMode === "editor") && (
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
        {isBlockFieldVisible(block, "heading") &&
          (block.props.heading || renderMode === "editor") && (
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
                key={faqItemKey(item, index)}
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
        ? previewLayoutClass(
            previewLayout,
            "mt-5 grid gap-3 grid-cols-2 lg:grid-cols-4",
            "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
          )
        : block.variant === "feature"
          ? previewLayoutClass(
              previewLayout,
              "mt-5 grid gap-4 grid-cols-[1.1fr_0.9fr]",
              "mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]",
            )
          : previewLayoutClass(
              previewLayout,
              "mt-5 grid gap-4 grid-cols-3",
              "mt-5 grid gap-4 md:grid-cols-3",
            );
    return (
      <div>
        {isBlockFieldVisible(block, "heading") &&
          (block.props.heading || renderMode === "editor") && (
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
                key={cardKey(card, index)}
                className={`rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8] ${
                  block.variant === "feature" && index === 0
                    ? previewLayoutClass(
                        previewLayout,
                        "row-span-2 min-h-64",
                        "md:row-span-2 md:min-h-64",
                      )
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
                    className="mt-4 inline-flex text-sm font-black text-[#066a99] uppercase hover:text-[#111111]"
                  >
                    {cardGridLinkLabel(card)}
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
          {isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow && (
            <p className="text-sm font-black text-[#066a99] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <blockquote className="mt-4 text-4xl leading-none font-black text-[#111111] uppercase md:text-5xl">
            {editorFallback(block.props.body, "Proof stat", renderMode)}
          </blockquote>
          {((isBlockFieldVisible(block, "name") &&
            (block.props.name || renderMode === "editor")) ||
            (isBlockFieldVisible(block, "context") &&
              (block.props.context || renderMode === "editor"))) && (
            <figcaption className="mt-5 text-sm font-semibold text-slate-600">
              {isBlockFieldVisible(block, "name") &&
                editorFallback(block.props.name, "Source", renderMode)}
              {isBlockFieldVisible(block, "name") &&
              isBlockFieldVisible(block, "context") &&
              (block.props.name || renderMode === "editor") &&
              (block.props.context || renderMode === "editor")
                ? " - "
                : ""}
              {isBlockFieldVisible(block, "context") &&
                editorFallback(block.props.context, "Context", renderMode)}
            </figcaption>
          )}
        </figure>
      );
    }

    if (block.variant === "logo") {
      const logoProofItems = [
        { key: "name", value: block.props.name },
        { key: "context", value: block.props.context },
        { key: "body", value: block.props.body },
      ]
        .filter((item) => item.value || renderMode === "editor")
        .slice(0, 3);

      return (
        <aside className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
          {isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow && (
            <p className="text-sm font-black text-[#066a99] uppercase">
              {block.props.eyebrow}
            </p>
          )}
          <div
            className={`mt-5 grid gap-3 ${previewLayoutClass(
              previewLayout,
              "grid-cols-3",
              "sm:grid-cols-3",
            )}`}
          >
            {logoProofItems.map((item) => (
              <div
                key={item.key}
                className="grid min-h-20 place-items-center rounded-[8px] border-2 border-[#111111] bg-[#f5fbff] px-4 text-center text-sm font-black text-[#111111] uppercase"
              >
                {editorFallback(item.value, "Proof", renderMode)}
              </div>
            ))}
          </div>
        </aside>
      );
    }

    return (
      <figure className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
        {isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow && (
          <p className="text-sm font-black text-[#066a99] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <blockquote className="mt-3 text-xl leading-8 font-black text-[#111111]">
          {editorFallback(block.props.body, "Proof quote or stat", renderMode)}
        </blockquote>
        {((isBlockFieldVisible(block, "name") &&
          (block.props.name || renderMode === "editor")) ||
          (isBlockFieldVisible(block, "context") &&
            (block.props.context || renderMode === "editor"))) && (
          <figcaption className="mt-4 text-sm font-semibold text-slate-600">
            {isBlockFieldVisible(block, "name") &&
              editorFallback(block.props.name, "Name", renderMode)}
            {isBlockFieldVisible(block, "name") &&
            isBlockFieldVisible(block, "context") &&
            (block.props.name || renderMode === "editor") &&
            (block.props.context || renderMode === "editor")
              ? " - "
              : ""}
            {isBlockFieldVisible(block, "context") &&
              editorFallback(block.props.context, "Context", renderMode)}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "lead_form") {
    if (block.variant === "sidebar") {
      return (
        <div
          className={`grid gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8] ${previewLayoutClass(
            previewLayout,
            "grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start",
            "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start",
          )}`}
        >
          <div>
            {isBlockFieldVisible(block, "heading") &&
              (block.props.heading || renderMode === "editor") && (
                <h2 className="text-2xl font-black text-[#111111] uppercase">
                  {editorFallback(
                    block.props.heading,
                    "Lead form heading",
                    renderMode,
                  )}
                </h2>
              )}
            {isBlockFieldVisible(block, "body") &&
              (block.props.body || renderMode === "editor") && (
                <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                  {editorFallback(
                    block.props.body,
                    "Lead form copy",
                    renderMode,
                  )}
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
        {((isBlockFieldVisible(block, "heading") &&
          (block.props.heading || renderMode === "editor")) ||
          (isBlockFieldVisible(block, "body") &&
            (block.props.body || renderMode === "editor"))) && (
          <div>
            {isBlockFieldVisible(block, "heading") &&
              (block.props.heading || renderMode === "editor") && (
                <h2 className="text-2xl font-black text-[#111111] uppercase">
                  {editorFallback(
                    block.props.heading,
                    "Lead form heading",
                    renderMode,
                  )}
                </h2>
              )}
            {isBlockFieldVisible(block, "body") &&
              (block.props.body || renderMode === "editor") && (
                <p className="mt-3 text-sm leading-7 font-semibold text-slate-700">
                  {editorFallback(
                    block.props.body,
                    "Lead form copy",
                    renderMode,
                  )}
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
        {[
          "Name",
          "Email",
          "Phone",
          "City",
          "State",
          "Business stage",
          "Available startup budget",
          "Launch timeline",
        ].map((label) => (
          <div key={label}>
            <div className="mb-2 block text-sm font-black text-[#111111] uppercase">
              {label}
            </div>
            <div className="min-h-12 rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-600">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 block text-sm font-black text-[#111111] uppercase">
          What are you trying to build?
        </div>
        <div className="min-h-24 rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3 text-base font-semibold text-slate-600">
          Message
        </div>
      </div>
      <span
        aria-disabled="true"
        className="inline-flex min-h-12 max-w-max items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 py-3 text-sm font-black text-[#111111] uppercase opacity-80 shadow-[5px_5px_0_#111111]"
      >
        {submitLabel || "Submit application"}
      </span>
    </div>
  );
}

function ResourceVideoPanel({
  embed,
  linkMode,
  renderMode,
  thumbnailUrl,
  title,
  url,
}: {
  embed: VideoEmbed | null;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
  thumbnailUrl?: string;
  title: string;
  url: string;
}) {
  const frameClass =
    "aspect-video w-full rounded-[10px] border-2 border-[#111111] shadow-[7px_7px_0_#55b8e8]";
  const previewThumbnailUrl = thumbnailUrl?.trim();
  const thumbnailStyle: CSSProperties | undefined = previewThumbnailUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.35)), url("${previewThumbnailUrl}")`,
      }
    : undefined;
  const previewFrameClass = `${frameClass} ${
    previewThumbnailUrl
      ? "relative block overflow-hidden bg-black bg-cover bg-center"
      : "grid place-items-center bg-[#f5fbff]"
  }`;

  if (embed) {
    return (
      <YouTubeEmbedFrame
        embed={embed}
        title={title}
        className={frameClass}
        thumbnailUrl={previewThumbnailUrl || undefined}
      />
    );
  }

  if (url && linkMode === "live") {
    return (
      <a
        href={url}
        rel="noopener noreferrer"
        style={thumbnailStyle}
        className={`${previewFrameClass} transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none`}
      >
        <VideoPlayIcon floating={Boolean(previewThumbnailUrl)} />
      </a>
    );
  }

  return (
    <div
      style={thumbnailStyle}
      className={`${previewFrameClass} ${
        renderMode === "editor" ? "border-dashed" : ""
      }`}
    >
      <VideoPlayIcon floating={Boolean(previewThumbnailUrl)} />
    </div>
  );
}

function VideoPlayIcon({ floating = false }: { floating?: boolean }) {
  return (
    <span
      className={`grid size-14 place-items-center rounded-full border-2 border-[#111111] bg-white shadow-[4px_4px_0_#55b8e8] ${
        floating
          ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          : ""
      }`}
    >
      <span className="sr-only">Play video</span>
      <span className="ml-1 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-[#111111]" />
    </span>
  );
}

function faqItemKey(
  item: Extract<PageBlock, { type: "faq" }>["props"]["items"][number],
  index: number,
) {
  return `${index}:${item.question}:${item.answer}`;
}

function cardKey(
  card: Extract<PageBlock, { type: "card_grid" }>["props"]["cards"][number],
  index: number,
) {
  return `${index}:${card.title}:${card.body}:${card.href ?? ""}:${
    card.linkLabel ?? ""
  }`;
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
