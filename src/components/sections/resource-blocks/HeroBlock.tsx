import Image from "next/image";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { LeadAttributionLinkContext } from "@/lib/lead-attribution-links";
import {
  ResourceLink,
  editorFallback,
  previewLayoutClass,
  resourceCtaClass,
  type ResourcePageLinkMode,
  type ResourcePageRenderMode,
} from "./shared";

type HeroBlockProps = {
  block: Extract<PageBlock, { type: "hero" }>;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  renderMode: ResourcePageRenderMode;
  linkMode: ResourcePageLinkMode;
  isPrimaryHero?: boolean;
  previewLayout?: boolean;
};

export function HeroBlock({
  block,
  leadAttribution,
  linkContext,
  renderMode,
  linkMode,
  isPrimaryHero = false,
  previewLayout = false,
}: HeroBlockProps) {
  const HeadingTag = isPrimaryHero ? "h1" : "h2";
  const heroHeadingClass = previewLayoutClass(
    previewLayout,
    "mt-4 text-3xl leading-tight font-black text-[#111111] uppercase",
    "mt-4 text-3xl leading-tight font-black text-[#111111] uppercase md:text-4xl",
  );
  const heroSectionClass = previewLayoutClass(previewLayout, "py-4", "py-8");

  if (block.variant === "split") {
    return (
      <div
        className={`grid items-center gap-10 ${heroSectionClass} ${previewLayoutClass(
          previewLayout,
          "grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]",
          "lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]",
        )}`}
      >
        <HeroIntro
          block={block}
          HeadingTag={HeadingTag}
          headingClass={heroHeadingClass}
          renderMode={renderMode}
          leadAttribution={leadAttribution}
          linkContext={linkContext}
          linkMode={linkMode}
        />
        <HeroSplitAside block={block} renderMode={renderMode} />
      </div>
    );
  }

  if (block.variant === "compact") {
    return (
      <div className={`mx-auto max-w-3xl text-center ${heroSectionClass}`}>
        <HeroIntro
          block={block}
          HeadingTag={HeadingTag}
          headingClass={heroHeadingClass}
          bodyClass="mx-auto mt-5 max-w-2xl text-lg leading-8 font-semibold text-slate-700"
          renderMode={renderMode}
          leadAttribution={leadAttribution}
          linkContext={linkContext}
          linkMode={linkMode}
        />
      </div>
    );
  }

  if (block.variant === "editorial") {
    return (
      <div className="max-w-4xl rounded-[12px] bg-[#eaf8ff] px-6 py-8 shadow-[inset_4px_0_0_#55b8e8]">
        {isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow && (
          <p className="text-sm font-black text-[#066a99] uppercase">
            {block.props.eyebrow}
          </p>
        )}
        <HeadingTag className={heroHeadingClass}>
          {editorFallback(block.props.heading, "Hero headline", renderMode)}
        </HeadingTag>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-600 uppercase">
          <span>Resource guide</span>
          <span className="size-1 rounded-full bg-slate-400" />
          <span>Editor approved block</span>
        </div>
        {isBlockFieldVisible(block, "body") &&
          (block.props.body || renderMode === "editor") && (
            <p className="mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700">
              {editorFallback(block.props.body, "Hero body copy", renderMode)}
            </p>
          )}
      </div>
    );
  }

  return (
    <div className={`max-w-4xl ${heroSectionClass}`}>
      <HeroIntro
        block={block}
        HeadingTag={HeadingTag}
        headingClass={heroHeadingClass}
        renderMode={renderMode}
        leadAttribution={leadAttribution}
        linkContext={linkContext}
        linkMode={linkMode}
      />
    </div>
  );
}

function HeroIntro({
  block,
  bodyClass = "mt-5 max-w-3xl text-lg leading-8 font-semibold text-slate-700",
  HeadingTag,
  headingClass,
  leadAttribution,
  linkContext,
  linkMode,
  renderMode,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  bodyClass?: string;
  HeadingTag: "h1" | "h2";
  headingClass: string;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
}) {
  return (
    <div>
      <HeroEyebrow block={block} />
      <HeadingTag className={headingClass}>
        {editorFallback(block.props.heading, "Hero headline", renderMode)}
      </HeadingTag>
      <HeroBody block={block} className={bodyClass} renderMode={renderMode} />
      <HeroCta
        block={block}
        leadAttribution={leadAttribution}
        linkContext={linkContext}
        linkMode={linkMode}
        renderMode={renderMode}
      />
    </div>
  );
}

function HeroEyebrow({
  block,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
}) {
  return isBlockFieldVisible(block, "eyebrow") && block.props.eyebrow ? (
    <p className="text-sm font-black text-[#066a99] uppercase">
      {block.props.eyebrow}
    </p>
  ) : null;
}

function HeroBody({
  block,
  className,
  renderMode,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  className: string;
  renderMode: ResourcePageRenderMode;
}) {
  return isBlockFieldVisible(block, "body") &&
    (block.props.body || renderMode === "editor") ? (
    <p className={className}>
      {editorFallback(block.props.body, "Hero body copy", renderMode)}
    </p>
  ) : null;
}

function HeroCta({
  block,
  leadAttribution,
  linkContext,
  linkMode,
  renderMode,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  leadAttribution?: LeadAttribution | null;
  linkContext?: LeadAttributionLinkContext;
  linkMode: ResourcePageLinkMode;
  renderMode: ResourcePageRenderMode;
}) {
  return isBlockFieldVisible(block, "cta") &&
    ((block.props.ctaLabel && block.props.ctaHref) ||
      renderMode === "editor") ? (
    <ResourceLink
      href={block.props.ctaHref || "#"}
      trackingName={block.props.ctaTrackingName}
      leadAttribution={leadAttribution}
      linkContext={linkContext}
      linkMode={linkMode}
      className={`${resourceCtaClass("primary")} mt-7`}
    >
      {editorFallback(block.props.ctaLabel, "CTA label", renderMode)}
    </ResourceLink>
  ) : null;
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
        {isBlockFieldVisible(block, "mediaCaption") &&
          block.props.mediaCaption && (
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
        <p className="text-sm font-black text-[#066a99] uppercase">Proof</p>
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
