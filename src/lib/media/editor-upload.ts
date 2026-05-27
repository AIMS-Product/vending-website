import {
  createMediaAssetFromEditor,
  createSignedMediaUpload,
} from "@/app/admin/media/actions";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import { createClient } from "@/lib/supabase/client";

export const EDITOR_UPLOAD_RIGHTS_NOTES =
  "Uploaded from the page editor. Confirm source and usage rights before publishing.";

const IMAGE_ACCEPT = "image/avif,image/webp,image/png,image/jpeg";

export function mediaTitleFromFilename(filename: string) {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "Page image";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function mediaAltFromFilename(filename: string) {
  return mediaTitleFromFilename(filename);
}

export function isAcceptedEditorImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return ["image/avif", "image/webp", "image/png", "image/jpeg"].includes(
      file.type,
    );
  }
  return /\.(avif|webp|png|jpe?g)$/i.test(file.name);
}

export async function uploadImageFileToMediaLibrary(
  file: File,
): Promise<EditorMediaAsset> {
  if (!isAcceptedEditorImageFile(file)) {
    throw new Error("Use an AVIF, WebP, PNG, or JPEG image.");
  }

  const request = new FormData();
  request.set("filename", file.name);
  const signed = await createSignedMediaUpload(request);
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;

  const formData = new FormData();
  formData.set("assetType", "image");
  formData.set("title", mediaTitleFromFilename(file.name));
  formData.set("altText", mediaAltFromFilename(file.name));
  formData.set("sourceRightsNotes", EDITOR_UPLOAD_RIGHTS_NOTES);
  formData.set("storageBucket", signed.bucket);
  formData.set("storagePath", signed.path);

  return createMediaAssetFromEditor(formData);
}

export { IMAGE_ACCEPT };
