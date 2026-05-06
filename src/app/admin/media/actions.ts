"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminCreateMediaAsset } from "@/lib/services/media-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";

export type MediaAssetActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const MEDIA_BUCKET = "page-builder-media";
const ADMIN_MEDIA_PATH = "/admin/media";

const mediaAssetSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  altText: z.string().trim().min(1, "Alt text is required.").max(180),
  sourceRightsNotes: z
    .string()
    .trim()
    .min(1, "Source and rights notes are required.")
    .max(500),
  caption: z.string().trim().max(240),
  externalUrl: z.string().trim().max(1000),
  storageBucket: z.string().trim(),
  storagePath: z.string().trim(),
  tags: z.string().trim().max(240),
});

export async function createMediaAsset(
  _prev: MediaAssetActionState,
  formData: FormData,
): Promise<MediaAssetActionState> {
  const admin = await requireAdmin();
  const parsed = mediaAssetSchema.safeParse({
    title: formData.get("title"),
    altText: formData.get("altText"),
    sourceRightsNotes: formData.get("sourceRightsNotes"),
    caption: formData.get("caption") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    storageBucket: formData.get("storageBucket") ?? "",
    storagePath: formData.get("storagePath") ?? "",
    tags: formData.get("tags") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid media fields.",
    };
  }

  const media = parsed.data;
  if (!media.externalUrl && !media.storagePath) {
    return {
      status: "error",
      message: "Upload an image or provide an external URL.",
    };
  }

  try {
    await adminCreateMediaAsset({
      title: media.title,
      altText: media.altText,
      sourceRightsNotes: media.sourceRightsNotes,
      caption: nullable(media.caption),
      externalUrl: nullable(media.externalUrl),
      storageBucket: nullable(media.storageBucket),
      storagePath: nullable(media.storagePath),
      tags: parseTags(media.tags),
      uploadedBy: admin.user.id,
    });
    revalidatePath(ADMIN_MEDIA_PATH);
    return { status: "saved", message: "Media asset saved." };
  } catch (error) {
    console.error("media asset action failed", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not save media.",
    };
  }
}

export async function createSignedMediaUpload(formData: FormData) {
  await requireAdmin();

  const rawName = String(formData.get("filename") ?? "image").toLowerCase();
  const extension = rawName.match(/\.(avif|webp|png|jpe?g)$/)?.[1] ?? "jpg";
  const safeBase =
    rawName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "image";
  const path = `images/${crypto.randomUUID()}-${safeBase}.${extension}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path);

  return {
    bucket: MEDIA_BUCKET,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrl.publicUrl,
  };
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
}
