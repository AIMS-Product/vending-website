import type { MediaAsset } from "@/lib/services/media-assets";

export type MediaCollection =
  | "all"
  | "in-use"
  | "unused"
  | "needs-metadata"
  | "resource-pages"
  | "news"
  | "proof"
  | "brand";

const mediaCollectionFilters: Array<{
  label: string;
  value: MediaCollection;
  description: string;
}> = [
  { label: "All assets", value: "all", description: "Every media asset" },
  { label: "In use", value: "in-use", description: "Referenced in content" },
  { label: "Unused", value: "unused", description: "Not referenced anywhere" },
  {
    label: "Needs metadata",
    value: "needs-metadata",
    description: "Missing alt, rights, or tags",
  },
  {
    label: "Resource pages",
    value: "resource-pages",
    description: "Tagged for SEO/resource content",
  },
  { label: "News", value: "news", description: "Tagged for news and blog" },
  { label: "Proof", value: "proof", description: "Tagged for proof points" },
  { label: "Brand", value: "brand", description: "Tagged for brand assets" },
];

export const mediaStatusFilters = mediaCollectionFilters.filter((item) =>
  ["all", "in-use", "unused", "needs-metadata"].includes(item.value),
);

export const mediaPurposeFilters = mediaCollectionFilters.filter((item) =>
  ["resource-pages", "news", "proof", "brand"].includes(item.value),
);

export function isPurposeCollection(
  collection: MediaCollection,
): collection is "resource-pages" | "news" | "proof" | "brand" {
  return mediaPurposeFilters.some((item) => item.value === collection);
}

const COLLECTION_TAG_BUNDLES: Record<
  Exclude<MediaCollection, "all" | "in-use" | "unused" | "needs-metadata">,
  string[]
> = {
  "resource-pages": ["resource", "seo", "page", "hero"],
  news: ["news", "blog", "cover"],
  proof: ["proof", "testimonial", "case-study"],
  brand: ["brand", "logo"],
};

export function normalizeMediaCollection(
  value: string | undefined,
): MediaCollection {
  if (
    value === "in-use" ||
    value === "unused" ||
    value === "needs-metadata" ||
    value === "resource-pages" ||
    value === "news" ||
    value === "proof" ||
    value === "brand"
  ) {
    return value;
  }
  return "all";
}

function assetNeedsMetadata(
  asset: Pick<
    MediaAsset,
    "asset_type" | "alt_text" | "source_rights_notes" | "tags"
  >,
) {
  if (asset.asset_type === "image" && !asset.alt_text?.trim()) return true;
  if (!asset.source_rights_notes?.trim()) return true;
  if (asset.tags.length === 0) return true;
  return false;
}

export function assetMatchesCollection(
  asset: Pick<
    MediaAsset,
    "asset_type" | "alt_text" | "source_rights_notes" | "tags"
  >,
  collection: MediaCollection,
  usageCount: number,
) {
  if (collection === "all") return true;
  if (collection === "in-use") return usageCount > 0;
  if (collection === "unused") return usageCount === 0;
  if (collection === "needs-metadata") return assetNeedsMetadata(asset);

  const bundle = COLLECTION_TAG_BUNDLES[collection];
  return asset.tags.some((tag) => bundle.includes(tag));
}

export function countByCollection(
  assets: MediaAsset[],
  usageIndex: Record<string, number>,
) {
  return mediaCollectionFilters.reduce(
    (counts, filter) => {
      if (filter.value === "all") {
        counts[filter.value] = assets.length;
        return counts;
      }
      counts[filter.value] = assets.filter((asset) =>
        assetMatchesCollection(asset, filter.value, usageIndex[asset.id] ?? 0),
      ).length;
      return counts;
    },
    {} as Record<MediaCollection, number>,
  );
}
