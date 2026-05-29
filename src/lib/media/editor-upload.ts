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

type StorageUploadClient = {
  storage: {
    from(bucket: string): {
      uploadToSignedUrl(
        path: string,
        token: string,
        file: File,
        options: { contentType: string; upsert: false },
      ): Promise<{ error: unknown | null }>;
    };
  };
};

type UploadImageFileDeps = {
  createSignedUpload?: typeof createSignedMediaUpload;
  createStorageClient?: () => StorageUploadClient;
  createMediaAsset?: typeof createMediaAssetFromEditor;
};

export type UploadedImageStorage = {
  storageBucket: string;
  storagePath: string;
};

export function defaultEditorImageFields(file: File) {
  return {
    title: mediaTitleFromFilename(file.name),
    altText: mediaAltFromFilename(file.name),
    sourceRightsNotes: EDITOR_UPLOAD_RIGHTS_NOTES,
  };
}

export async function uploadImageFileToStorage(
  file: File,
  deps: Pick<
    UploadImageFileDeps,
    "createSignedUpload" | "createStorageClient"
  > = {},
): Promise<UploadedImageStorage> {
  if (!isAcceptedEditorImageFile(file)) {
    throw new Error("Use an AVIF, WebP, PNG, or JPEG image.");
  }

  const request = new FormData();
  request.set("filename", file.name);
  const createSignedUpload = deps.createSignedUpload ?? createSignedMediaUpload;
  const signed = await createSignedUpload(request);
  const createStorageClient: () => StorageUploadClient =
    deps.createStorageClient ?? createClient;
  const supabase = createStorageClient();
  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;

  return {
    storageBucket: signed.bucket,
    storagePath: signed.path,
  };
}

export async function uploadImageFileToMediaLibrary(
  file: File,
  deps: UploadImageFileDeps = {},
): Promise<EditorMediaAsset> {
  const uploaded = await uploadImageFileToStorage(file, deps);
  const defaults = defaultEditorImageFields(file);

  const formData = new FormData();
  formData.set("assetType", "image");
  formData.set("title", defaults.title);
  formData.set("altText", defaults.altText);
  formData.set("sourceRightsNotes", defaults.sourceRightsNotes);
  formData.set("storageBucket", uploaded.storageBucket);
  formData.set("storagePath", uploaded.storagePath);

  const createMediaAsset = deps.createMediaAsset ?? createMediaAssetFromEditor;
  return createMediaAsset(formData);
}

export { IMAGE_ACCEPT };
