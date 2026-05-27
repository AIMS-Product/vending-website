import type { MediaAsset } from "@/lib/services/media-assets";
import { publicMediaAssetUrl } from "@/lib/services/media-assets";

export type EditorMediaAsset = {
  id: string;
  title: string;
  altText: string;
  caption: string | null;
  sourceRightsNotes: string;
  publicUrl: string;
  assetType: "image" | "video" | "embed";
};

export function toEditorMediaAsset(asset: MediaAsset): EditorMediaAsset {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.alt_text ?? "",
    caption: asset.caption,
    sourceRightsNotes: asset.source_rights_notes ?? "",
    publicUrl: publicMediaAssetUrl(asset),
    assetType: asset.asset_type as EditorMediaAsset["assetType"],
  };
}
