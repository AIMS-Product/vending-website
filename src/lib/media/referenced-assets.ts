import { flattenBlocks, type PageContent } from "@/lib/page-builder/blocks";

export type MediaAssetReference = {
  assetId: string;
  expectedTypes: Array<"image" | "video" | "embed">;
  path: string;
};

export function collectMediaAssetReferences(
  content: PageContent,
): MediaAssetReference[] {
  const refs: MediaAssetReference[] = [];

  for (const [index, block] of flattenBlocks(content).entries()) {
    if (block.type === "image" && block.props.assetId) {
      refs.push({
        assetId: block.props.assetId,
        expectedTypes: ["image"],
        path: `blocks.${index}.props.assetId`,
      });
    }
    if (block.type === "hero" && block.props.mediaAssetId) {
      refs.push({
        assetId: block.props.mediaAssetId,
        expectedTypes: ["image"],
        path: `blocks.${index}.props.mediaAssetId`,
      });
    }
    if (block.type === "video" && block.props.assetId) {
      refs.push({
        assetId: block.props.assetId,
        expectedTypes: ["video", "embed"],
        path: `blocks.${index}.props.assetId`,
      });
    }
  }

  return refs;
}

export function collectMediaAssetIds(content: PageContent): string[] {
  return [
    ...new Set(collectMediaAssetReferences(content).map((ref) => ref.assetId)),
  ];
}
