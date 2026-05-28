"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import {
  adminBulkAddTagsToAssets,
  adminBulkDeleteMediaAssets,
  adminCreateMediaAsset,
  adminDeleteMediaAsset,
  adminGetMediaAssetUsage,
  adminListMediaAssets,
  adminUpdateMediaAsset,
  type MediaAssetType,
} from "@/lib/services/media-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";

export type MediaAssetActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const MEDIA_BUCKET = "page-builder-media";
const ADMIN_MEDIA_PATH = "/admin/media";

const mediaAssetSchema = z.object({
  assetType: z.enum(["image", "video", "embed"]).default("image"),
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  altText: z.string().trim().max(180),
  sourceRightsNotes: z
    .string()
    .trim()
    .min(1, "Source and rights notes are required.")
    .max(500),
  caption: z.string().trim().max(240),
  externalUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "External URL must be a valid HTTP(S) URL.",
    }),
  storageBucket: z.string().trim(),
  storagePath: z.string().trim(),
  tags: z.string().trim().max(240),
  durationSeconds: z.string().trim(),
});

const updateMediaAssetSchema = z.object({
  assetId: z.uuid(),
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  altText: z.string().trim().max(180),
  sourceRightsNotes: z
    .string()
    .trim()
    .min(1, "Source and rights notes are required.")
    .max(500),
  caption: z.string().trim().max(240),
  externalUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "External URL must be a valid HTTP(S) URL.",
    }),
  tags: z.string().trim().max(240),
  durationSeconds: z.string().trim(),
});

export async function createMediaAsset(
  _prev: MediaAssetActionState,
  formData: FormData,
): Promise<MediaAssetActionState> {
  const admin = await requireAuth();
  const parsed = mediaAssetSchema.safeParse({
    assetType: formData.get("assetType") ?? "image",
    title: formData.get("title"),
    altText: formData.get("altText"),
    sourceRightsNotes: formData.get("sourceRightsNotes"),
    caption: formData.get("caption") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    storageBucket: formData.get("storageBucket") ?? "",
    storagePath: formData.get("storagePath") ?? "",
    tags: formData.get("tags") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid media fields.",
    };
  }

  const media = parsed.data;
  if (
    media.assetType === "image" &&
    !media.externalUrl &&
    (!media.storageBucket || !media.storagePath)
  ) {
    return {
      status: "error",
      message: "Upload an image or provide an external URL.",
    };
  }
  if (media.assetType !== "image" && !media.externalUrl) {
    return {
      status: "error",
      message: "Video and embed assets require an external URL.",
    };
  }
  if (media.assetType === "image" && !media.altText.trim()) {
    return {
      status: "error",
      message: "Alt text is required for image assets.",
    };
  }

  try {
    await adminCreateMediaAsset({
      assetType: media.assetType,
      title: media.title,
      altText: media.altText || media.title,
      sourceRightsNotes: media.sourceRightsNotes,
      caption: nullable(media.caption),
      externalUrl: nullable(media.externalUrl),
      storageBucket: nullable(media.storageBucket),
      storagePath: nullable(media.storagePath),
      durationSeconds: parseDuration(media.durationSeconds),
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

export async function updateMediaAsset(
  _prev: MediaAssetActionState,
  formData: FormData,
): Promise<MediaAssetActionState> {
  await requireAuth();
  const parsed = updateMediaAssetSchema.safeParse({
    assetId: formData.get("assetId"),
    title: formData.get("title"),
    altText: formData.get("altText"),
    sourceRightsNotes: formData.get("sourceRightsNotes"),
    caption: formData.get("caption") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    tags: formData.get("tags") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid media fields.",
    };
  }

  try {
    await adminUpdateMediaAsset(parsed.data.assetId, {
      title: parsed.data.title,
      altText: parsed.data.altText,
      sourceRightsNotes: parsed.data.sourceRightsNotes,
      caption: nullable(parsed.data.caption),
      externalUrl: nullable(parsed.data.externalUrl),
      durationSeconds: parseDuration(parsed.data.durationSeconds),
      tags: parseTags(parsed.data.tags),
    });
    revalidatePath(ADMIN_MEDIA_PATH);
    return { status: "saved", message: "Media asset updated." };
  } catch (error) {
    console.error("media asset update failed", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update media.",
    };
  }
}

export async function deleteMediaAsset(assetId: string) {
  await requireAuth();
  try {
    await adminDeleteMediaAsset(assetId);
    revalidatePath(ADMIN_MEDIA_PATH);
    return { status: "saved" as const, message: "Media asset deleted." };
  } catch (error) {
    console.error("media asset delete failed", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Could not delete media.",
    };
  }
}

export async function fetchMediaAssetUsage(assetId: string) {
  await requireAuth();
  return adminGetMediaAssetUsage(assetId);
}

const bulkTagSchema = z.object({
  assetIds: z.array(z.uuid()).min(1, "Choose at least one asset."),
  tag: z.string().trim().min(1, "Tag is required.").max(40, "Tag is too long."),
});

const bulkDeleteSchema = z.object({
  assetIds: z.array(z.uuid()).min(1, "Choose at least one asset."),
});

const bulkCreateItemSchema = z.object({
  title: z.string().trim().min(2, "Title needs at least 2 characters."),
  altText: z.string().trim().max(180),
  storageBucket: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
  tags: z.string().trim().max(240).optional(),
});

export async function bulkAddMediaTags(assetIds: string[], tag: string) {
  await requireAuth();
  const parsed = bulkTagSchema.safeParse({ assetIds, tag });
  if (!parsed.success) {
    return {
      status: "error" as const,
      message: parsed.error.issues[0]?.message ?? "Invalid bulk tag request.",
    };
  }

  try {
    const result = await adminBulkAddTagsToAssets(
      parsed.data.assetIds,
      parsed.data.tag,
    );
    revalidatePath(ADMIN_MEDIA_PATH);
    return {
      status: "saved" as const,
      message: `Added “${result.tag}” to ${result.updated} asset${result.updated === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    console.error("bulk media tag failed", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Could not add tags in bulk.",
    };
  }
}

export async function bulkDeleteMediaAssets(assetIds: string[]) {
  await requireAuth();
  const parsed = bulkDeleteSchema.safeParse({ assetIds });
  if (!parsed.success) {
    return {
      status: "error" as const,
      message:
        parsed.error.issues[0]?.message ?? "Invalid bulk delete request.",
    };
  }

  try {
    const result = await adminBulkDeleteMediaAssets(parsed.data.assetIds);
    revalidatePath(ADMIN_MEDIA_PATH);
    const skippedNote =
      result.skipped > 0
        ? ` ${result.skipped} in-use asset${result.skipped === 1 ? "" : "s"} skipped.`
        : "";
    const errorNote = result.errors.length > 0 ? ` ${result.errors[0]}` : "";
    if (result.deleted === 0) {
      return {
        status: "error" as const,
        message:
          result.skipped > 0
            ? "Selected assets are still in use and were not deleted."
            : errorNote || "Could not delete selected assets.",
      };
    }
    return {
      status: "saved" as const,
      message: `Deleted ${result.deleted} asset${result.deleted === 1 ? "" : "s"}.${skippedNote}${errorNote}`,
    };
  } catch (error) {
    console.error("bulk media delete failed", error);
    return {
      status: "error" as const,
      message:
        error instanceof Error
          ? error.message
          : "Could not delete selected assets.",
    };
  }
}

export async function bulkCreateMediaAssets(
  items: Array<{
    title: string;
    altText: string;
    storageBucket: string;
    storagePath: string;
    tags?: string;
  }>,
) {
  const admin = await requireAuth();
  if (items.length === 0) {
    return {
      status: "error" as const,
      message: "Choose at least one image to upload.",
    };
  }
  if (items.length > 20) {
    return {
      status: "error" as const,
      message: "Upload up to 20 images at a time.",
    };
  }

  let created = 0;
  const errors: string[] = [];

  for (const item of items) {
    const parsed = bulkCreateItemSchema.safeParse(item);
    if (!parsed.success) {
      errors.push(parsed.error.issues[0]?.message ?? "Invalid upload item.");
      continue;
    }

    try {
      await adminCreateMediaAsset({
        assetType: "image",
        title: parsed.data.title,
        altText: parsed.data.altText || parsed.data.title,
        sourceRightsNotes:
          "Uploaded in bulk from the media library. Confirm source and usage rights before publishing.",
        storageBucket: parsed.data.storageBucket,
        storagePath: parsed.data.storagePath,
        tags: parseTags(parsed.data.tags ?? ""),
        uploadedBy: admin.user.id,
      });
      created += 1;
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Could not save uploaded image.",
      );
    }
  }

  revalidatePath(ADMIN_MEDIA_PATH);

  if (created === 0) {
    return {
      status: "error" as const,
      message: errors[0] ?? "Could not save uploaded images.",
    };
  }

  const errorNote =
    errors.length > 0 ? ` ${errors.length} file(s) failed.` : "";
  return {
    status: "saved" as const,
    message: `Saved ${created} image${created === 1 ? "" : "s"}.${errorNote}`,
  };
}

export async function fetchEditorMediaAssets(
  assetTypes: MediaAssetType[] = ["image", "video", "embed"],
) {
  await requireAuth();
  const assets = await adminListMediaAssets({ assetTypes });
  return assets.map(toEditorMediaAsset);
}

export async function createMediaAssetFromEditor(formData: FormData) {
  const admin = await requireAuth();
  const parsed = mediaAssetSchema.safeParse({
    assetType: formData.get("assetType") ?? "image",
    title: formData.get("title"),
    altText: formData.get("altText"),
    sourceRightsNotes: formData.get("sourceRightsNotes"),
    caption: formData.get("caption") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
    storageBucket: formData.get("storageBucket") ?? "",
    storagePath: formData.get("storagePath") ?? "",
    tags: formData.get("tags") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid media fields.");
  }

  const media = parsed.data;
  if (
    media.assetType === "image" &&
    !media.externalUrl &&
    (!media.storageBucket || !media.storagePath)
  ) {
    throw new Error("Upload an image or provide an external URL.");
  }
  if (media.assetType !== "image" && !media.externalUrl) {
    throw new Error("Video and embed assets require an external URL.");
  }

  const asset = await adminCreateMediaAsset({
    assetType: media.assetType,
    title: media.title,
    altText: media.altText || media.title,
    sourceRightsNotes: media.sourceRightsNotes,
    caption: nullable(media.caption),
    externalUrl: nullable(media.externalUrl),
    storageBucket: nullable(media.storageBucket),
    storagePath: nullable(media.storagePath),
    durationSeconds: parseDuration(media.durationSeconds),
    tags: parseTags(media.tags),
    uploadedBy: admin.user.id,
  });

  revalidatePath(ADMIN_MEDIA_PATH);
  return toEditorMediaAsset(asset);
}

export async function createSignedMediaUpload(formData: FormData) {
  await requireAuth();

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
  if (error) {
    console.error("signed media upload creation failed", error);
    throw new Error("Could not prepare upload. Please try again.");
  }

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

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .flatMap((tag) => {
          const trimmed = tag.trim().toLowerCase();
          return trimmed ? [trimmed] : [];
        })
        .slice(0, 20),
    ),
  ];
}

function parseDuration(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
