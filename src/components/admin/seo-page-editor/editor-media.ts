import type { PageBlock } from "@/lib/page-builder/blocks";
import { setBlockFieldVisibility } from "@/lib/page-builder/block-field-visibility";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";

export function applyMediaAssetToSplitHeroBlock(
  block: Extract<PageBlock, { type: "hero" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "hero" }> {
  const nextBlock: Extract<PageBlock, { type: "hero" }> = {
    ...block,
    props: {
      ...block.props,
      mediaAssetId: asset.id,
      mediaSrc: asset.publicUrl,
      mediaAltText: asset.altText,
      mediaCaption: asset.caption ?? "",
    },
  };
  return asset.caption
    ? (setBlockFieldVisibility(nextBlock, "mediaCaption", true) as Extract<
        PageBlock,
        { type: "hero" }
      >)
    : nextBlock;
}

export function applyMediaAssetToImageBlock(
  block: Extract<PageBlock, { type: "image" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "image" }> {
  return {
    ...block,
    props: {
      ...block.props,
      assetId: asset.id,
      src: asset.publicUrl,
      altText: asset.altText,
      caption: asset.caption ?? block.props.caption,
      sourceRightsNotes: asset.sourceRightsNotes,
    },
  };
}

export function applyMediaAssetToVideoBlock(
  block: Extract<PageBlock, { type: "video" }>,
  asset: EditorMediaAsset,
): Extract<PageBlock, { type: "video" }> {
  return {
    ...block,
    props: {
      ...block.props,
      assetId: asset.id,
      url: asset.publicUrl,
      title: block.props.title || asset.title,
      caption: asset.caption ?? block.props.caption,
    },
  };
}

export function selectedMediaAssetLabel(
  assets: EditorMediaAsset[],
  assetId?: string,
  fallbackUrl?: string,
) {
  if (assetId) {
    return (
      assets.find((asset) => asset.id === assetId)?.title ?? "Selected asset"
    );
  }
  if (fallbackUrl) {
    return (
      assets.find((asset) => asset.publicUrl === fallbackUrl)?.title ??
      "Custom media URL"
    );
  }
  return "No asset selected";
}
