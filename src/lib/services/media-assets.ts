import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaAssetReference } from "@/lib/media/referenced-assets";
import { collectMediaAssetIds } from "@/lib/media/referenced-assets";
import { pageContentSchema } from "@/lib/page-builder/blocks";
import {
  buildMediaUsageIndexFromRows,
  publicMediaAssetUrl,
} from "@/lib/services/media-usage-index";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables, TablesInsert } from "@/types/database";
import type { MediaUsageIndex } from "@/lib/services/media-usage-index";

export {
  publicMediaAssetUrl,
  type MediaUsageIndex,
} from "@/lib/services/media-usage-index";

export type MediaAsset = Tables<"media_assets">;
export type MediaAssetType = "image" | "video" | "embed";

type MediaClient = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = {
  client?: MediaClient;
};

export type MediaAssetListOptions = {
  search?: string;
  assetTypes?: MediaAssetType[];
};

export type CreateMediaAssetInput = {
  assetType?: MediaAssetType;
  title: string;
  altText: string;
  sourceRightsNotes: string;
  caption?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  durationSeconds?: number | null;
  tags?: string[];
  uploadedBy?: string | null;
};

export type UpdateMediaAssetInput = {
  title?: string;
  altText?: string;
  sourceRightsNotes?: string;
  caption?: string | null;
  externalUrl?: string | null;
  durationSeconds?: number | null;
  tags?: string[];
};

export type MediaAssetUsage = {
  seoPages: Array<{ id: string; title: string; slug: string }>;
  newsPosts: Array<{ id: string; title: string; slug: string }>;
  proofItems: Array<{ id: string; body: string }>;
  sourceDocuments: Array<{ id: string; title: string }>;
  totalCount: number;
};

const MEDIA_ASSET_FIELDS =
  "id, asset_type, title, alt_text, caption, source_rights_notes, storage_bucket, storage_path, external_url, thumbnail_asset_id, width, height, duration_seconds, tags, uploaded_by, created_at, updated_at" as const;

const DEFAULT_LIST_TYPES: MediaAssetType[] = ["image", "video", "embed"];

export async function adminListMediaAssets(
  { search, assetTypes = DEFAULT_LIST_TYPES }: MediaAssetListOptions = {},
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  let query = client
    .from("media_assets")
    .select(MEDIA_ASSET_FIELDS)
    .in("asset_type", assetTypes)
    .order("created_at", { ascending: false });

  const term = normalizeSearch(search);
  if (term) {
    query = query.or(`title.ilike.%${term}%,tags.cs.{${term}}`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Could not list media assets.");
  return data ?? [];
}

export async function adminCreateMediaAsset(
  input: CreateMediaAssetInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const assetType = input.assetType ?? "image";
  const row: TablesInsert<"media_assets"> = {
    asset_type: assetType,
    title: input.title.trim(),
    alt_text: input.altText.trim(),
    caption: input.caption?.trim() || null,
    source_rights_notes: input.sourceRightsNotes.trim(),
    storage_bucket: input.storageBucket ?? null,
    storage_path: input.storagePath ?? null,
    external_url: input.externalUrl ?? null,
    duration_seconds: input.durationSeconds ?? null,
    tags: input.tags ?? [],
    uploaded_by: input.uploadedBy ?? null,
  };

  const validation = validateMediaAssetRow(row);
  if (validation) throw validation;

  const { data, error } = await client
    .from("media_assets")
    .insert(row)
    .select(MEDIA_ASSET_FIELDS)
    .single();

  if (error) throw new Error("Could not create media asset.");
  return data;
}

export async function adminUpdateMediaAsset(
  assetId: string,
  input: UpdateMediaAssetInput,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data: existing, error: loadError } = await client
    .from("media_assets")
    .select(MEDIA_ASSET_FIELDS)
    .eq("id", assetId)
    .maybeSingle();

  if (loadError) throw new Error("Could not load media asset.");
  if (!existing) throw new Error("Media asset not found.");

  const nextRow: TablesInsert<"media_assets"> = {
    asset_type: existing.asset_type,
    title: input.title?.trim() ?? existing.title,
    alt_text:
      input.altText !== undefined
        ? input.altText.trim()
        : (existing.alt_text ?? ""),
    caption:
      input.caption !== undefined
        ? input.caption?.trim() || null
        : existing.caption,
    source_rights_notes:
      input.sourceRightsNotes?.trim() ?? existing.source_rights_notes ?? "",
    storage_bucket: existing.storage_bucket,
    storage_path: existing.storage_path,
    external_url:
      input.externalUrl !== undefined
        ? input.externalUrl?.trim() || null
        : existing.external_url,
    duration_seconds:
      input.durationSeconds !== undefined
        ? input.durationSeconds
        : existing.duration_seconds,
    tags: input.tags ?? existing.tags,
    uploaded_by: existing.uploaded_by,
  };

  const validation = validateMediaAssetRow(nextRow);
  if (validation) throw validation;

  const { data, error } = await client
    .from("media_assets")
    .update({
      title: nextRow.title,
      alt_text: nextRow.alt_text,
      caption: nextRow.caption,
      source_rights_notes: nextRow.source_rights_notes,
      external_url: nextRow.external_url,
      duration_seconds: nextRow.duration_seconds,
      tags: nextRow.tags,
    })
    .eq("id", assetId)
    .select(MEDIA_ASSET_FIELDS)
    .single();

  if (error) throw new Error("Could not update media asset.");
  return data;
}

export async function adminDeleteMediaAsset(
  assetId: string,
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const usage = await adminGetMediaAssetUsage(assetId, { client });
  if (usage.totalCount > 0) {
    throw new Error(
      "This asset is still referenced elsewhere. Remove those references before deleting.",
    );
  }

  const { error } = await client
    .from("media_assets")
    .delete()
    .eq("id", assetId);
  if (error) throw new Error("Could not delete media asset.");
}

export async function adminBuildMediaUsageIndex(
  deps: ServiceDeps = {},
): Promise<MediaUsageIndex> {
  const client = deps.client ?? createAdminClient();
  const [
    { data: mediaAssets, error: mediaError },
    { data: seoPages, error: seoError },
    { data: newsPosts, error: newsError },
    { data: proofItems, error: proofError },
    { data: sourceDocuments, error: sourceError },
  ] = await Promise.all([
    client.from("media_assets").select(MEDIA_ASSET_FIELDS),
    client
      .from("seo_pages")
      .select("id, og_asset_id, draft_content, published_content"),
    client.from("news_posts").select("id, cover_url"),
    client.from("proof_items").select("id, asset_id"),
    client.from("source_documents").select("id, asset_id"),
  ]);

  if (mediaError) throw new Error("Could not build media usage index.");
  if (seoError) throw new Error("Could not build media usage index.");
  if (newsError) throw new Error("Could not build media usage index.");
  if (proofError) throw new Error("Could not build media usage index.");
  if (sourceError) throw new Error("Could not build media usage index.");

  return buildMediaUsageIndexFromRows({
    mediaAssets,
    seoPages,
    newsPosts,
    proofItems,
    sourceDocuments,
  });
}

export async function adminBulkAddTagsToAssets(
  assetIds: string[],
  tag: string,
  deps: ServiceDeps = {},
) {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) throw new Error("Tag is required.");
  if (assetIds.length === 0) throw new Error("Choose at least one asset.");

  const uniqueIds = [...new Set(assetIds)];
  let updated = 0;

  for (const assetId of uniqueIds) {
    const client = deps.client ?? createAdminClient();
    const { data: existing, error } = await client
      .from("media_assets")
      .select(MEDIA_ASSET_FIELDS)
      .eq("id", assetId)
      .maybeSingle();
    if (error) throw new Error("Could not load media asset.");
    if (!existing) continue;

    const nextTags = [
      ...new Set([...(existing.tags ?? []), normalizedTag]),
    ].slice(0, 20);
    await adminUpdateMediaAsset(assetId, { tags: nextTags }, deps);
    updated += 1;
  }

  return { updated, tag: normalizedTag };
}

export async function adminBulkDeleteMediaAssets(
  assetIds: string[],
  deps: ServiceDeps = {},
) {
  if (assetIds.length === 0) throw new Error("Choose at least one asset.");

  const usageIndex = await adminBuildMediaUsageIndex(deps);
  const uniqueIds = [...new Set(assetIds)];
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const assetId of uniqueIds) {
    if ((usageIndex[assetId] ?? 0) > 0) {
      skipped += 1;
      continue;
    }
    try {
      await adminDeleteMediaAsset(assetId, deps);
      deleted += 1;
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Could not delete media asset.",
      );
    }
  }

  return { deleted, skipped, errors };
}

export async function adminGetMediaAssetUsage(
  assetId: string,
  deps: ServiceDeps = {},
): Promise<MediaAssetUsage> {
  const client = deps.client ?? createAdminClient();

  const [
    { data: asset, error: assetError },
    { data: seoPages, error: seoError },
    { data: newsPosts, error: newsError },
    { data: proofItems, error: proofError },
    { data: sourceDocuments, error: sourceError },
  ] = await Promise.all([
    client
      .from("media_assets")
      .select(MEDIA_ASSET_FIELDS)
      .eq("id", assetId)
      .maybeSingle(),
    client
      .from("seo_pages")
      .select("id, title, slug, og_asset_id, draft_content, published_content"),
    client.from("news_posts").select("id, title, slug, cover_url"),
    client.from("proof_items").select("id, body").eq("asset_id", assetId),
    client.from("source_documents").select("id, title").eq("asset_id", assetId),
  ]);

  if (assetError) throw new Error("Could not load media asset usage.");
  if (seoError) throw new Error("Could not load media asset usage.");
  if (newsError) throw new Error("Could not load media asset usage.");
  if (proofError) throw new Error("Could not load media asset usage.");
  if (sourceError) throw new Error("Could not load media asset usage.");
  if (!asset) throw new Error("Media asset not found.");

  const publicUrl = publicMediaAssetUrl(asset);
  const seoPageMatches: MediaAssetUsage["seoPages"] = [];

  for (const page of seoPages ?? []) {
    if (page.og_asset_id === assetId) {
      seoPageMatches.push({
        id: page.id,
        title: page.title,
        slug: page.slug,
      });
      continue;
    }

    for (const content of [page.draft_content, page.published_content]) {
      const parsed = pageContentSchema.safeParse(content);
      if (!parsed.success) continue;
      if (collectMediaAssetIds(parsed.data).includes(assetId)) {
        seoPageMatches.push({
          id: page.id,
          title: page.title,
          slug: page.slug,
        });
        break;
      }
    }
  }

  const newsMatches =
    publicUrl.length > 0
      ? (newsPosts ?? [])
          .filter((post) => post.cover_url === publicUrl)
          .map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
          }))
      : [];

  const proofMatches = (proofItems ?? []).map((item) => ({
    id: item.id,
    body: item.body,
  }));
  const sourceMatches = (sourceDocuments ?? []).map((doc) => ({
    id: doc.id,
    title: doc.title,
  }));

  const dedupedSeoPages = dedupeById(seoPageMatches);
  const dedupedNewsPosts = dedupeById(newsMatches);
  const totalCount =
    dedupedSeoPages.length +
    dedupedNewsPosts.length +
    proofMatches.length +
    sourceMatches.length;

  return {
    seoPages: dedupedSeoPages,
    newsPosts: dedupedNewsPosts,
    proofItems: proofMatches,
    sourceDocuments: sourceMatches,
    totalCount,
  };
}

export function validateMediaAssetReferences(
  references: MediaAssetReference[],
  assets: Map<string, MediaAsset>,
) {
  const issues: Array<{
    code: string;
    path: string;
    message: string;
  }> = [];

  for (const reference of references) {
    const row = assets.get(reference.assetId);
    if (!row) {
      issues.push({
        code: "missing_media_asset",
        path: reference.path,
        message: "Referenced media asset does not exist.",
      });
      continue;
    }
    if (!reference.expectedTypes.includes(row.asset_type as MediaAssetType)) {
      issues.push({
        code: "invalid_media_asset_type",
        path: reference.path,
        message: "This block requires a different media asset type.",
      });
    }
    if (!row.external_url && !(row.storage_bucket && row.storage_path)) {
      issues.push({
        code: "missing_media_source",
        path: reference.path,
        message: "Referenced media asset requires a public source.",
      });
    }
    if (row.asset_type === "image" && !row.alt_text?.trim()) {
      issues.push({
        code: "missing_image_alt",
        path: reference.path,
        message: "Referenced image asset requires alt text.",
      });
    }
    if (!row.source_rights_notes?.trim()) {
      issues.push({
        code: "missing_media_rights",
        path: reference.path,
        message: "Referenced media asset requires source and rights notes.",
      });
    }
  }

  return issues;
}

function validateMediaAssetRow(row: TablesInsert<"media_assets">) {
  if (!row.title.trim()) return new Error("Media title is required.");
  if (row.asset_type === "image" && !row.alt_text?.trim()) {
    return new Error("Alt text is required.");
  }
  if (!row.source_rights_notes?.trim()) {
    return new Error("Source and rights notes are required.");
  }
  const hasStoredAsset = Boolean(row.storage_bucket && row.storage_path);
  const hasExternalAsset = Boolean(row.external_url);
  if (row.storage_path && !row.storage_bucket) {
    return new Error(
      "Storage bucket is required when storage path is provided.",
    );
  }
  if (row.asset_type === "image") {
    if (!hasStoredAsset && !hasExternalAsset) {
      return new Error("Upload an image or provide an external URL.");
    }
  } else if (!hasExternalAsset) {
    return new Error("Video and embed assets require an external URL.");
  }
  return null;
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeSearch(search: string | undefined) {
  const term = search?.trim().replace(/[%_]/g, "").slice(0, 80);
  return term || "";
}

export {
  collectMediaAssetIds,
  collectMediaAssetReferences,
} from "@/lib/media/referenced-assets";
