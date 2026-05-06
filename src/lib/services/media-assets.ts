import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables, TablesInsert } from "@/types/database";

export type MediaAsset = Tables<"media_assets">;

type MediaClient = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = {
  client?: MediaClient;
};

export type MediaAssetListOptions = {
  search?: string;
};

export type CreateMediaAssetInput = {
  title: string;
  altText: string;
  sourceRightsNotes: string;
  caption?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  tags?: string[];
  uploadedBy?: string | null;
};

const MEDIA_ASSET_FIELDS =
  "id, asset_type, title, alt_text, caption, source_rights_notes, storage_bucket, storage_path, external_url, thumbnail_asset_id, width, height, duration_seconds, tags, uploaded_by, created_at, updated_at" as const;

export async function adminListMediaAssets(
  { search }: MediaAssetListOptions = {},
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  let query = client
    .from("media_assets")
    .select(MEDIA_ASSET_FIELDS)
    .eq("asset_type", "image")
    .order("created_at", { ascending: false });

  const term = normalizeSearch(search);
  if (term) {
    query = query.ilike("title", `%${term}%`);
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
  const row: TablesInsert<"media_assets"> = {
    asset_type: "image",
    title: input.title.trim(),
    alt_text: input.altText.trim(),
    caption: input.caption?.trim() || null,
    source_rights_notes: input.sourceRightsNotes.trim(),
    storage_bucket: input.storageBucket ?? null,
    storage_path: input.storagePath ?? null,
    external_url: input.externalUrl ?? null,
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

export function publicMediaAssetUrl(asset: MediaAsset) {
  if (asset.external_url) return asset.external_url;
  if (asset.storage_bucket && asset.storage_path) {
    const base = config.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`;
  }
  return "";
}

function validateMediaAssetRow(row: TablesInsert<"media_assets">) {
  if (!row.title.trim()) return new Error("Media title is required.");
  if (!row.alt_text?.trim()) return new Error("Alt text is required.");
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
  if (!hasStoredAsset && !hasExternalAsset) {
    return new Error("Upload an image or provide an external URL.");
  }
  return null;
}

function normalizeSearch(search: string | undefined) {
  const term = search?.trim().replace(/[%_]/g, "").slice(0, 80);
  return term || "";
}
