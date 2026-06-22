import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type SignedStorageUpload = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

export type SignedImageUploadRequest = {
  bucket: string;
  directory: string;
  filename: string;
  fallbackBase: string;
};

export async function createSignedImageStorageUpload(
  request: SignedImageUploadRequest,
): Promise<SignedStorageUpload> {
  const path = createImageStoragePath(request);
  const supabase = createAdminClient();
  const bucket = request.bucket;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error) throw error;

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: publicUrl.publicUrl,
  };
}

export function createImageStoragePath({
  directory,
  filename,
  fallbackBase,
}: Pick<SignedImageUploadRequest, "directory" | "filename" | "fallbackBase">) {
  const rawName = filename.trim().toLowerCase() || fallbackBase;
  const extension = rawName.match(/\.(avif|webp|png|jpe?g)$/)?.[1] ?? "jpg";
  const safeBase =
    rawName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || fallbackBase;
  const safeDirectory = directory.replace(/^\/+|\/+$/g, "");
  return `${safeDirectory}/${crypto.randomUUID()}-${safeBase}.${extension}`;
}
