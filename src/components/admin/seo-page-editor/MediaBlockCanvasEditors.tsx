"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import Image from "next/image";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { blockCanvasPlaceholders } from "@/lib/page-builder/block-editor-placeholders";
import { syncedTrackingName } from "@/lib/page-builder/editor-helpers";
import {
  MediaDropTarget,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import {
  OptionalBlockField,
  builderOptionalFieldScopeClass,
} from "@/components/admin/seo-page-editor/OptionalBlockField";
import { EditorCharLimit } from "@/components/admin/seo-page-editor/EditorInputs";
import { HERO_BODY_MAX_LENGTH } from "@/components/admin/seo-page-editor/editor-limits";
import {
  applyMediaAssetToImageBlock,
  applyMediaAssetToSplitHeroBlock,
} from "@/components/admin/seo-page-editor/editor-media";
import {
  eyebrowInputClass,
  heroHeadingInputClass,
  leadInputClass,
} from "@/components/admin/seo-page-editor/editor-styles";

function AutoResizeTextarea({
  className,
  value,
  onChange,
  rows = 1,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={textareaRef}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
      }}
      className={`${className ?? ""} overflow-hidden`}
    />
  );
}

export function HeroInlineContentFields({
  block,
  onChange,
  className = `${builderOptionalFieldScopeClass} px-3 py-8 sm:px-4`,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  onChange: (block: PageBlock) => void;
  className?: string;
}) {
  const heroBodyInputId = `${block.id}-hero-body`;

  return (
    <div className={className}>
      <OptionalBlockField
        block={block}
        field="eyebrow"
        onChange={onChange}
        compact
      >
        <label className="block">
          <span className="sr-only">Eyebrow</span>
          <input
            aria-label="Eyebrow"
            value={block.props.eyebrow}
            placeholder={blockCanvasPlaceholders.hero.eyebrow}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, eyebrow: event.target.value },
              })
            }
            className={eyebrowInputClass}
          />
        </label>
      </OptionalBlockField>
      <label className="mt-3 block">
        <span className="sr-only">Heading</span>
        <textarea
          aria-label="Heading"
          value={block.props.heading}
          placeholder={blockCanvasPlaceholders.hero.heading}
          onChange={(event) =>
            onChange({
              ...block,
              props: { ...block.props, heading: event.target.value },
            })
          }
          rows={2}
          className={heroHeadingInputClass}
        />
      </label>
      <OptionalBlockField
        block={block}
        field="body"
        onChange={onChange}
        compact
      >
        <label htmlFor={heroBodyInputId} className="mt-5 block max-w-3xl">
          <span className="sr-only">Body</span>
          <AutoResizeTextarea
            id={heroBodyInputId}
            aria-label="Body"
            value={block.props.body}
            placeholder={blockCanvasPlaceholders.hero.body}
            maxLength={HERO_BODY_MAX_LENGTH}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, body: event.target.value },
              })
            }
            rows={3}
            className={leadInputClass}
          />
          <EditorCharLimit
            value={block.props.body}
            max={HERO_BODY_MAX_LENGTH}
          />
        </label>
      </OptionalBlockField>
      <OptionalBlockField block={block} field="cta" onChange={onChange} compact>
        <div className="mt-8">
          <label className="inline-flex max-w-xs rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-5 py-3 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111]">
            <span className="sr-only">CTA label</span>
            <input
              aria-label="CTA label"
              value={block.props.ctaLabel}
              placeholder={blockCanvasPlaceholders.hero.ctaLabel}
              onChange={(event) => {
                const nextLabel = event.target.value;
                onChange({
                  ...block,
                  props: {
                    ...block.props,
                    ctaLabel: nextLabel,
                    ctaTrackingName: syncedTrackingName({
                      currentTrackingName: block.props.ctaTrackingName,
                      previousLabel: block.props.ctaLabel,
                      nextLabel,
                      fallback: "hero-cta",
                    }),
                  },
                });
              }}
              className="w-full min-w-24 bg-transparent outline-none placeholder:text-[#111111]/55"
            />
          </label>
        </div>
      </OptionalBlockField>
    </div>
  );
}

export function SplitHeroBlockCanvas({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "hero" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const { openMediaPicker } = useMediaPicker();
  const imageClass =
    "aspect-[4/5] w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]";
  const mediaNode = block.props.mediaSrc ? (
    <figure>
      <Image
        src={block.props.mediaSrc}
        alt={block.props.mediaAltText ?? ""}
        width={900}
        height={1125}
        sizes="(max-width: 1024px) 100vw, 40vw"
        className={imageClass}
      />
      <OptionalBlockField
        block={block}
        field="mediaCaption"
        onChange={onChange}
        compact
      >
        <label className="mt-4 block">
          <span className="sr-only">Media caption</span>
          <input
            aria-label="Media caption"
            value={block.props.mediaCaption ?? ""}
            placeholder={blockCanvasPlaceholders.hero.mediaCaption}
            onChange={(event) =>
              onChange({
                ...block,
                props: { ...block.props, mediaCaption: event.target.value },
              })
            }
            className="focus:ring-brand-100 w-full bg-transparent text-sm font-semibold text-slate-600 outline-none focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2"
          />
        </label>
      </OptionalBlockField>
      {!block.props.mediaAltText?.trim() && (
        <p className="mt-2 text-xs text-amber-700">
          Add alt text in block settings before publishing.
        </p>
      )}
    </figure>
  ) : block.props.proofText ? (
    <aside className="rounded-[10px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]">
      <p className="text-sm font-black text-[#066a99] uppercase">Proof</p>
      <p className="mt-4 text-xl leading-8 font-black text-[#111111]">
        {block.props.proofText}
      </p>
    </aside>
  ) : (
    <MediaDropTarget
      label={blockCanvasPlaceholders.image.dropLabel}
      hint={blockCanvasPlaceholders.image.dropHint}
      className={`${imageClass} border-dashed bg-slate-50 px-4 transition focus-within:ring-4 focus-within:ring-[#0b63f6]/20 hover:border-[#0b63f6]/40 hover:bg-white`}
      onAsset={(asset) =>
        onChange(applyMediaAssetToSplitHeroBlock(block, asset))
      }
      onOpenLibrary={() =>
        openMediaPicker({
          allowedTypes: ["image"],
          onSelect: (asset) =>
            onChange(applyMediaAssetToSplitHeroBlock(block, asset)),
        })
      }
    />
  );

  return (
    <div className="grid items-center gap-10 px-3 py-8 sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <HeroInlineContentFields
        block={block}
        onChange={onChange}
        className="max-w-none p-0"
      />
      <div>{mediaNode}</div>
    </div>
  );
}

export function ImageBlockCanvas({
  block,
  onChange,
}: {
  block: Extract<PageBlock, { type: "image" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const { openMediaPicker } = useMediaPicker();
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
          : "aspect-video w-full rounded-[10px] border-2 border-[#111111] object-cover shadow-[7px_7px_0_#55b8e8]";
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
    <MediaDropTarget
      label={blockCanvasPlaceholders.image.dropLabel}
      hint={blockCanvasPlaceholders.image.dropHint}
      className={`${imageClass} border-dashed bg-slate-50 px-4 transition focus-within:ring-4 focus-within:ring-[#0b63f6]/20 hover:border-[#0b63f6]/40 hover:bg-white`}
      onAsset={(asset) => onChange(applyMediaAssetToImageBlock(block, asset))}
      onOpenLibrary={() =>
        openMediaPicker({
          allowedTypes: ["image"],
          onSelect: (asset) =>
            onChange(applyMediaAssetToImageBlock(block, asset)),
        })
      }
    />
  );
  const captionInput = (
    <input
      aria-label="Caption"
      value={block.props.caption}
      placeholder={blockCanvasPlaceholders.image.caption}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, caption: event.target.value },
        })
      }
      className="focus:ring-brand-100 w-full bg-transparent text-sm text-slate-500 outline-none focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2"
    />
  );

  if (block.variant === "feature") {
    return (
      <div className={`px-3 py-4 sm:px-4 ${builderOptionalFieldScopeClass}`}>
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <figure className={imageFrameClass}>
            <figcaption className="text-base leading-7 font-semibold text-slate-600">
              <p className="text-sm font-black text-[#066a99] uppercase">
                Featured media
              </p>
              <label className="mt-3 block">
                <span className="sr-only">Caption</span>
                {captionInput}
              </label>
            </figcaption>
            <div className="md:order-2">{mediaNode}</div>
          </figure>
        </OptionalBlockField>
      </div>
    );
  }

  return (
    <figure className={`px-3 py-4 sm:px-4 ${imageFrameClass}`}>
      {mediaNode}
      <div className={builderOptionalFieldScopeClass}>
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <label
            className={block.variant === "inline" ? "block" : "mt-3 block"}
          >
            <span className="sr-only">Caption</span>
            {captionInput}
          </label>
        </OptionalBlockField>
      </div>
    </figure>
  );
}

export function VideoBlockCanvas({
  block,
  onChange,
  onEditSettings,
}: {
  block: Extract<PageBlock, { type: "video" }>;
  onChange: (block: PageBlock) => void;
  onEditSettings: () => void;
}) {
  const videoPanel = (
    <button
      type="button"
      onClick={onEditSettings}
      className={`grid place-items-center rounded-[10px] border-2 border-[#111111] bg-[#f5fbff] transition hover:bg-white focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
        block.variant === "wide" ? "aspect-[16/7]" : "aspect-video"
      }`}
    >
      <span className="grid size-14 place-items-center rounded-full border-2 border-[#111111] bg-white shadow-[4px_4px_0_#55b8e8]">
        <span className="sr-only">Edit video settings</span>
        <span className="ml-1 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-[#111111]" />
      </span>
    </button>
  );
  const titleInput = (
    <input
      aria-label="Video title"
      value={block.props.title}
      placeholder={blockCanvasPlaceholders.video.title}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, title: event.target.value },
        })
      }
      className="w-full bg-transparent text-xl font-black text-[#111111] uppercase outline-none placeholder:text-slate-400 focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2 focus:ring-[#0b63f6]/20"
    />
  );
  const captionInput = (
    <textarea
      aria-label="Video caption"
      value={block.props.caption}
      placeholder={blockCanvasPlaceholders.video.caption}
      rows={block.variant === "inline" ? 3 : 2}
      onChange={(event) =>
        onChange({
          ...block,
          props: { ...block.props, caption: event.target.value },
        })
      }
      className="mt-3 w-full resize-y bg-transparent text-sm leading-7 font-semibold text-slate-600 outline-none placeholder:text-slate-400 focus:rounded-md focus:bg-white focus:px-2 focus:py-1 focus:ring-2 focus:ring-[#0b63f6]/20"
    />
  );
  const watchButton = (
    <button
      type="button"
      onClick={onEditSettings}
      className="mt-3 inline-flex text-sm font-black text-[#066a99] uppercase hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/30 focus-visible:outline-none"
    >
      Watch video
    </button>
  );

  if (block.variant === "inline") {
    return (
      <div className="grid items-center gap-6 rounded-[10px] border-2 border-[#111111] bg-white p-5 shadow-[7px_7px_0_#55b8e8] md:grid-cols-[180px_minmax(0,1fr)]">
        {videoPanel}
        <div className={`min-w-0 ${builderOptionalFieldScopeClass}`}>
          <OptionalBlockField
            block={block}
            field="title"
            onChange={onChange}
            compact
          >
            <label className="block">
              <span className="sr-only">Video title</span>
              {titleInput}
            </label>
          </OptionalBlockField>
          <OptionalBlockField
            block={block}
            field="caption"
            onChange={onChange}
            compact
          >
            <label className="block">
              <span className="sr-only">Video caption</span>
              {captionInput}
            </label>
          </OptionalBlockField>
          {watchButton}
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
      <div className={builderOptionalFieldScopeClass}>
        <OptionalBlockField
          block={block}
          field="title"
          onChange={onChange}
          compact
        >
          <label className="mt-5 block">
            <span className="sr-only">Video title</span>
            {titleInput}
          </label>
        </OptionalBlockField>
        {watchButton}
        <OptionalBlockField
          block={block}
          field="caption"
          onChange={onChange}
          compact
        >
          <label className="block">
            <span className="sr-only">Video caption</span>
            {captionInput}
          </label>
        </OptionalBlockField>
      </div>
    </div>
  );
}
