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
import { normalizeNewsSlug } from "./news-slug";

export type EditorActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

// I13: authoritative server-side slug guard. The client slugifies on every
// keystroke, but paste/edge paths (and any non-browser caller) can still submit
// a raw value like "Invalid Slug With Spaces!!". We normalize with the SAME rule
// the client uses, then require that something URL-safe survived — so the stored
// slug is always lowercase a-z0-9 with single hyphens, never spaces/punctuation.
const slugField = z
  .string()
  .trim()
  .transform(normalizeNewsSlug)
  .refine((value) => value.length > 0, {
    message: "Add a URL-safe slug using letters, numbers, and hyphens.",
  })
  .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
    message: "Use a URL-safe slug using letters, numbers, and hyphens.",
  });

const postSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3, "Title needs at least 3 characters."),
  slug: slugField,
  excerpt: z.string().trim().max(240, "Keep excerpts under 240 characters."),
  body: z.string().trim().min(1, "Body is required."),
  cover_url: z.string().trim(),
  cover_alt: z.string().trim().max(180, "Alt text is too long."),
  intent: z.enum(["save", "publish", "unpublish", "archive"]),
});

// I5: draft-only autosave payload. Deliberately NARROWER than postSchema — it
// carries content fields only and has NO `intent`, so autosave can never
// publish, unpublish, archive, or otherwise change a post's status. `id` is
// required: autosave only ever updates an existing draft row, never creates one.
const autosaveSchema = z.object({
  id: z.uuid(),
  title: z.string().trim(),
  slug: z.string().trim().transform(normalizeNewsSlug),
  excerpt: z.string().trim().max(240),
  body: z.string(),
  cover_url: z.string().trim(),
  cover_alt: z.string().trim().max(180),
});

export type NewsAutosaveResult =
  | { status: "saved"; savedAt: string }
  | { status: "skipped"; message: string }
  | { status: "error"; message: string };

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

// I5: background autosave for the news editor. INVARIANTS (this codebase had a
// production autosave incident):
//   - DRAFT rows only. News is single-source — a published post's body/slug ARE
//     the live content — so autosaving anything but a draft would silently edit
//     the public site. Enforced here (status check below) and in the client
//     gate (newsAutosaveEnabled).
//   - never sends `status` or `published_at`, so it can never change
//     publication state.
//   - only ever UPDATES an existing row (id required); it never creates posts
//     and never publishes.
//   - returns a typed result instead of throwing, so a transient failure surfaces
//     non-destructively in the editor's quiet indicator and the retry policy.
export async function autosaveNewsDraft(
  formData: FormData,
): Promise<NewsAutosaveResult> {
  await requireAuth();

  const parsed = autosaveSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    title: formData.get("title") ?? "",
    slug: formData.get("slug") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body") ?? "",
    cover_url: formData.get("cover_url") ?? "",
    cover_alt: formData.get("cover_alt") ?? "",
  });

  if (!parsed.success) {
    // A half-typed field (e.g. an empty slug mid-edit) should not error loudly —
    // skip this autosave and let the next debounced attempt or a manual save
    // persist once the fields are valid. Never destructive.
    return {
      status: "skipped",
      message:
        parsed.error.issues[0]?.message ?? "Draft not ready to autosave.",
    };
  }

  const draft = parsed.data;

  try {
    const existing = await adminGetPostById(draft.id);
    if (!existing) {
      return { status: "error", message: "Post not found." };
    }

    if (existing.status !== "draft") {
      // Single-source guard: this row's content is (or was) live. Only the
      // explicit Save/Publish buttons may write it.
      return {
        status: "skipped",
        message: "Autosave only runs on drafts. Use Save to update this post.",
      };
    }

    // Content-only patch. `status` and `published_at` are intentionally omitted
    // so autosave can never change publication state.
    await adminUpdatePost(draft.id, {
      title: draft.title,
      slug: draft.slug,
      excerpt: nullable(draft.excerpt),
      body: draft.body,
      cover_url: nullable(draft.cover_url),
      cover_alt: nullable(draft.cover_alt),
    });

    revalidatePath("/admin/news");
    return { status: "saved", savedAt: new Date().toISOString() };
  } catch (error) {
    console.error("news draft autosave failed", error);
    return {
      status: "error",
      message: "Could not autosave. Your work is not saved yet.",
    };
  }
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
