import { config } from "@/lib/config";
import { collectMediaAssetIds } from "@/lib/media/referenced-assets";
import { pageContentSchema } from "@/lib/page-builder/blocks";

export type MediaUsageIndex = Record<string, number>;

type MediaAssetPublicUrlInput = {
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  [key: string]: unknown;
};

type MediaUsageAsset = MediaAssetPublicUrlInput & { id: string };

type SeoPageUsageRow = {
  og_asset_id: string | null;
  draft_content: unknown;
  published_content: unknown;
};

type NewsPostUsageRow = {
  cover_url: string | null;
};

type DirectAssetUsageRow = {
  asset_id: string | null;
};

export type MediaUsageIndexRows = {
  mediaAssets: MediaUsageAsset[] | null;
  seoPages: SeoPageUsageRow[] | null;
  newsPosts: NewsPostUsageRow[] | null;
  proofItems: DirectAssetUsageRow[] | null;
  sourceDocuments: DirectAssetUsageRow[] | null;
};

export function buildMediaUsageIndexFromRows({
  mediaAssets,
  seoPages,
  newsPosts,
  proofItems,
  sourceDocuments,
}: MediaUsageIndexRows): MediaUsageIndex {
  const counts: MediaUsageIndex = {};

  const bump = (assetId: string) => {
    counts[assetId] = (counts[assetId] ?? 0) + 1;
  };

  const publicUrlToAssetId = new Map<string, string>();
  for (const asset of mediaAssets ?? []) {
    const url = publicMediaAssetUrl(asset);
    if (url) publicUrlToAssetId.set(url, asset.id);
  }

  for (const page of seoPages ?? []) {
    const seenOnPage = new Set<string>();
    if (page.og_asset_id) {
      bump(page.og_asset_id);
      seenOnPage.add(page.og_asset_id);
    }

    for (const content of [page.draft_content, page.published_content]) {
      const parsed = pageContentSchema.safeParse(content);
      if (!parsed.success) continue;
      for (const assetId of collectMediaAssetIds(parsed.data)) {
        if (seenOnPage.has(assetId)) continue;
        seenOnPage.add(assetId);
        bump(assetId);
      }
    }
  }

  for (const post of newsPosts ?? []) {
    if (!post.cover_url) continue;
    const assetId = publicUrlToAssetId.get(post.cover_url);
    if (assetId) bump(assetId);
  }

  for (const item of proofItems ?? []) {
    if (item.asset_id) bump(item.asset_id);
  }

  for (const document of sourceDocuments ?? []) {
    if (document.asset_id) bump(document.asset_id);
  }

  return counts;
}

export function publicMediaAssetUrl(asset: MediaAssetPublicUrlInput) {
  if (asset.external_url) return asset.external_url;
  if (asset.storage_bucket && asset.storage_path) {
    const base = config.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`;
  }
  return "";
}
