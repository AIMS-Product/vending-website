"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminCreatePost,
  adminGetPostById,
  adminUpdatePost,
} from "@/lib/services/news";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";
import { createSignedImageStorageUpload } from "@/lib/supabase/signed-upload";

export type EditorActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const postSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Title needs at least 3 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug."),
  excerpt: z.string().trim().max(240, "Keep excerpts under 240 characters."),
  body: z.string().trim().min(1, "Body is required."),
  cover_url: z.string().trim(),
  cover_alt: z.string().trim().max(180, "Alt text is too long."),
  intent: z.enum(["save", "publish", "unpublish", "archive"]),
});

const PUBLIC_NEWS_PATH = "/news";

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function revalidateNewsPaths(slug: string, previousSlug?: string) {
  revalidatePath("/admin/news");
  revalidatePath(PUBLIC_NEWS_PATH);
  revalidatePath(`${PUBLIC_NEWS_PATH}/${slug}`);
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`${PUBLIC_NEWS_PATH}/${previousSlug}`);
  }
}

function errorState(error: unknown): EditorActionState {
  console.error("news admin action failed", error);
  return {
    status: "error",
    message: "Could not save the post. Check the fields and try again.",
  };
}

export async function savePost(
  _prev: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  await requireAuth();

  const parsed = postSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body"),
    cover_url: formData.get("cover_url") ?? "",
    cover_alt: formData.get("cover_alt") ?? "",
    intent: formData.get("intent") ?? "save",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid post fields.",
    };
  }

  const post = parsed.data;
  if (post.cover_url && !post.cover_alt) {
    return {
      status: "error",
      message: "Add alt text for the cover image before saving.",
    };
  }

  let redirectTo: string | null = null;

  try {
    if (!post.id) {
      const created = await adminCreatePost({
        title: post.title,
        slug: post.slug,
        excerpt: nullable(post.excerpt),
        body: post.body,
        cover_url: nullable(post.cover_url),
        cover_alt: nullable(post.cover_alt),
        status: post.intent === "publish" ? "published" : "draft",
        published_at:
          post.intent === "publish" ? new Date().toISOString() : null,
      });
      revalidateNewsPaths(created.slug);
      redirectTo = `/admin/news/${created.id}?saved=1`;
    } else {
      const existing = await adminGetPostById(post.id);
      if (!existing) {
        return { status: "error", message: "Post not found." };
      }

      const patch = {
        title: post.title,
        slug: post.slug,
        excerpt: nullable(post.excerpt),
        body: post.body,
        cover_url: nullable(post.cover_url),
        cover_alt: nullable(post.cover_alt),
        status:
          post.intent === "archive"
            ? "archived"
            : post.intent === "unpublish"
              ? "draft"
              : post.intent === "publish"
                ? "published"
                : existing.status,
        published_at:
          post.intent === "publish"
            ? (existing.published_at ?? new Date().toISOString())
            : post.intent === "unpublish"
              ? null
              : existing.published_at,
      };

      await adminUpdatePost(post.id, patch);
      revalidateNewsPaths(post.slug, existing.slug);
      return { status: "saved", message: "Post saved." };
    }
  } catch (error) {
    return errorState(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { status: "saved", message: "Post saved." };
}

export async function createSignedImageUpload(formData: FormData) {
  await requireAuth();

  const upload = await createSignedImageStorageUpload({
    bucket: "news-images",
    directory: "covers",
    filename: String(formData.get("filename") ?? "cover"),
    fallbackBase: "cover",
  });

  return {
    path: upload.path,
    token: upload.token,
    signedUrl: upload.signedUrl,
    publicUrl: upload.publicUrl,
  };
}
