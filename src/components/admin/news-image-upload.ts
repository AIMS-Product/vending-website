import { createSignedImageUpload } from "@/app/admin/news/actions";
import { createClient } from "@/lib/supabase/client";

// Mirrors the `news-images` bucket: 5 MB, avif/webp/png/jpeg. Checked here so
// the editor can say what is wrong instead of a bare "could not upload".
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/avif", "image/webp", "image/png", "image/jpeg"];

export class NewsImageUploadError extends Error {}

export async function uploadNewsImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new NewsImageUploadError("Use a JPG, PNG, WebP or AVIF image.");
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new NewsImageUploadError(
      `This image is ${mb} MB. The limit is 5 MB: compress it (for example at squoosh.app) and upload again.`,
    );
  }

  const request = new FormData();
  request.set("filename", file.name);
  const signed = await createSignedImageUpload(request);
  const { error } = await createClient()
    .storage.from("news-images")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;
  return signed.publicUrl;
}

// Size/type mistakes are the editor's to fix, not incidents: only log the rest.
export function uploadErrorMessage(context: string, error: unknown) {
  if (error instanceof NewsImageUploadError) return error.message;
  console.error(context, error);
  return "Could not upload the image. Try again, or choose one from the media library.";
}

// "lobby-micro-market_2.jpg" -> "lobby micro market 2": a starting alt text the
// editor can rewrite, better than an empty one.
export function altFromFilename(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
