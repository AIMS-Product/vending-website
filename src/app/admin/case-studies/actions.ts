"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminCreateCaseStudy,
  adminGetCaseStudyById,
  adminUpdateCaseStudy,
  parseStats,
  type CaseStudyStat,
} from "@/lib/services/case-studies";
import {
  parseCommaList,
  parseOptionalInt,
  resolveYoutubeVideoId,
} from "@/components/admin/case-study-editor-helpers";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";
import { createSignedImageStorageUpload } from "@/lib/supabase/signed-upload";
import { normalizeCaseStudySlug } from "./case-study-slug";

export type EditorActionState =
  | { status: "idle"; message?: string }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

// I13: authoritative server-side slug guard, same rule the client uses on
// every keystroke — see news actions.ts for the original rationale.
const slugField = z
  .string()
  .trim()
  .transform(normalizeCaseStudySlug)
  .refine((value) => value.length > 0, {
    message: "Add a URL-safe slug using letters, numbers, and hyphens.",
  })
  .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
    message: "Use a URL-safe slug using letters, numbers, and hyphens.",
  });

// Optional whole-number field: "" -> null; anything non-numeric is a
// validation error rather than a silent 0/NaN write.
const optionalIntField = z.string().transform((value, ctx) => {
  const parsed = parseOptionalInt(value);
  if (parsed === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a whole number or leave blank.",
    });
    return z.NEVER;
  }
  return parsed;
});

// Accepts a bare YouTube id or a full YouTube URL and resolves to the bare
// id the DB check constraint (`^[A-Za-z0-9_-]{6,}$`) expects. An
// unparseable, non-blank value is a validation error here — never a raw
// Postgres constraint violation surfaced to the admin.
const youtubeField = z.string().transform((value, ctx) => {
  const resolved = resolveYoutubeVideoId(value);
  if (resolved === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid YouTube video ID or URL.",
    });
    return z.NEVER;
  }
  return resolved;
});

const postSchema = z
  .object({
    id: z.uuid().optional(),
    title: z.string().trim().min(3, "Title needs at least 3 characters."),
    slug: slugField,
    member_name: z.string().trim().min(1, "Member name is required."),
    member_role: z.string().trim().max(180, "Keep the role under 180 characters."),
    excerpt: z.string().trim().max(240, "Keep excerpts under 240 characters."),
    body: z.string(),
    cover_url: z.string().trim(),
    cover_alt: z.string().trim().max(180, "Alt text is too long."),
    youtube_video_id: youtubeField,
    quote: z.string().trim().max(600, "Keep the quote under 600 characters."),
    quote_attribution: z
      .string()
      .trim()
      .max(180, "Keep the attribution under 180 characters."),
    monthly_revenue_usd: optionalIntField,
    machine_count: optionalIntField,
    location_count: optionalIntField,
    months_to_result: optionalIntField,
    prior_occupation: z
      .string()
      .trim()
      .max(180, "Keep this under 180 characters."),
    location_types: z.string(),
    tags: z.string(),
    related_slugs: z.string(),
    stats: z.string(),
    intent: z.enum(["save", "publish", "unpublish", "archive"]),
  })
  // The DB enforces `status <> 'published' or youtube_video_id is not
  // null`. Block a publish attempt with no video here so the admin sees a
  // clear message instead of a raw constraint-violation 500.
  .superRefine((data, ctx) => {
    if (data.intent === "publish" && !data.youtube_video_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["youtube_video_id"],
        message: "Add a YouTube video before publishing.",
      });
    }
  });

// I5: draft-only autosave payload. Deliberately NARROWER than postSchema — it
// carries content fields only and has NO `intent`, so autosave can never
// publish, unpublish, archive, or otherwise change a case study's status.
// `id` is required: autosave only ever updates an existing draft row, never
// creates one.
const autosaveSchema = z.object({
  id: z.uuid(),
  title: z.string().trim(),
  slug: z.string().trim().transform(normalizeCaseStudySlug),
  member_name: z.string().trim(),
  member_role: z.string().trim().max(180),
  excerpt: z.string().trim().max(240),
  body: z.string(),
  cover_url: z.string().trim(),
  cover_alt: z.string().trim().max(180),
  youtube_video_id: youtubeField,
  quote: z.string().trim().max(600),
  quote_attribution: z.string().trim().max(180),
  monthly_revenue_usd: optionalIntField,
  machine_count: optionalIntField,
  location_count: optionalIntField,
  months_to_result: optionalIntField,
  prior_occupation: z.string().trim().max(180),
  location_types: z.string(),
  tags: z.string(),
  related_slugs: z.string(),
  stats: z.string(),
});

export type CaseStudyAutosaveResult =
  | { status: "saved"; savedAt: string }
  | { status: "skipped"; message: string }
  | { status: "error"; message: string };

const PUBLIC_CASE_STUDIES_PATH = "/case-studies";

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function parseStatsField(value: string): CaseStudyStat[] {
  try {
    return parseStats(JSON.parse(value));
  } catch {
    return [];
  }
}

function revalidateCaseStudyPaths(slug: string, previousSlug?: string) {
  revalidatePath("/admin/case-studies");
  revalidatePath(PUBLIC_CASE_STUDIES_PATH);
  revalidatePath(`${PUBLIC_CASE_STUDIES_PATH}/${slug}`);
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`${PUBLIC_CASE_STUDIES_PATH}/${previousSlug}`);
  }
}

function errorState(error: unknown): EditorActionState {
  console.error("case studies admin action failed", error);
  return {
    status: "error",
    message: "Could not save the case study. Check the fields and try again.",
  };
}

export async function saveCaseStudy(
  _prev: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  await requireAuth();

  const parsed = postSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    member_name: formData.get("member_name"),
    member_role: formData.get("member_role") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body") ?? "",
    cover_url: formData.get("cover_url") ?? "",
    cover_alt: formData.get("cover_alt") ?? "",
    youtube_video_id: formData.get("youtube_video_id") ?? "",
    quote: formData.get("quote") ?? "",
    quote_attribution: formData.get("quote_attribution") ?? "",
    monthly_revenue_usd: formData.get("monthly_revenue_usd") ?? "",
    machine_count: formData.get("machine_count") ?? "",
    location_count: formData.get("location_count") ?? "",
    months_to_result: formData.get("months_to_result") ?? "",
    prior_occupation: formData.get("prior_occupation") ?? "",
    location_types: formData.get("location_types") ?? "",
    tags: formData.get("tags") ?? "",
    related_slugs: formData.get("related_slugs") ?? "",
    stats: formData.get("stats") ?? "[]",
    intent: formData.get("intent") ?? "save",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid case study fields.",
    };
  }

  const post = parsed.data;
  if (post.cover_url && !post.cover_alt) {
    return {
      status: "error",
      message: "Add alt text for the cover image before saving.",
    };
  }

  const sharedPatch = {
    title: post.title,
    slug: post.slug,
    member_name: post.member_name,
    member_role: nullable(post.member_role),
    excerpt: nullable(post.excerpt),
    body: post.body,
    cover_url: nullable(post.cover_url),
    cover_alt: nullable(post.cover_alt),
    youtube_video_id: post.youtube_video_id,
    quote: nullable(post.quote),
    quote_attribution: nullable(post.quote_attribution),
    monthly_revenue_usd: post.monthly_revenue_usd,
    machine_count: post.machine_count,
    location_count: post.location_count,
    months_to_result: post.months_to_result,
    prior_occupation: nullable(post.prior_occupation),
    location_types: parseCommaList(post.location_types),
    tags: parseCommaList(post.tags),
    related_slugs: parseCommaList(post.related_slugs),
    stats: parseStatsField(post.stats),
  };

  let redirectTo: string | null = null;

  try {
    if (!post.id) {
      const created = await adminCreateCaseStudy({
        ...sharedPatch,
        status: post.intent === "publish" ? "published" : "draft",
        published_at:
          post.intent === "publish" ? new Date().toISOString() : null,
      });
      revalidateCaseStudyPaths(created.slug);
      redirectTo = `/admin/case-studies/${created.id}?saved=1`;
    } else {
      const existing = await adminGetCaseStudyById(post.id);
      if (!existing) {
        return { status: "error", message: "Case study not found." };
      }

      const patch = {
        ...sharedPatch,
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

      await adminUpdateCaseStudy(post.id, patch);
      revalidateCaseStudyPaths(post.slug, existing.slug);
      return { status: "saved", message: "Case study saved." };
    }
  } catch (error) {
    return errorState(error);
  }

  if (redirectTo) redirect(redirectTo);
  return { status: "saved", message: "Case study saved." };
}

// I5: background autosave for the case study editor. Same invariants as the
// news editor's autosaveNewsDraft — DRAFT rows only, never touches
// status/published_at, only ever UPDATES an existing row. Returns a typed
// result instead of throwing so a transient failure surfaces
// non-destructively in the editor's quiet indicator and the retry policy.
export async function autosaveCaseStudyDraft(
  formData: FormData,
): Promise<CaseStudyAutosaveResult> {
  await requireAuth();

  const parsed = autosaveSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    title: formData.get("title") ?? "",
    slug: formData.get("slug") ?? "",
    member_name: formData.get("member_name") ?? "",
    member_role: formData.get("member_role") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body") ?? "",
    cover_url: formData.get("cover_url") ?? "",
    cover_alt: formData.get("cover_alt") ?? "",
    youtube_video_id: formData.get("youtube_video_id") ?? "",
    quote: formData.get("quote") ?? "",
    quote_attribution: formData.get("quote_attribution") ?? "",
    monthly_revenue_usd: formData.get("monthly_revenue_usd") ?? "",
    machine_count: formData.get("machine_count") ?? "",
    location_count: formData.get("location_count") ?? "",
    months_to_result: formData.get("months_to_result") ?? "",
    prior_occupation: formData.get("prior_occupation") ?? "",
    location_types: formData.get("location_types") ?? "",
    tags: formData.get("tags") ?? "",
    related_slugs: formData.get("related_slugs") ?? "",
    stats: formData.get("stats") ?? "[]",
  });

  if (!parsed.success) {
    // A half-typed field (an empty slug mid-edit, an unresolved YouTube
    // paste, a stray character in a number field) should not error loudly —
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
    const existing = await adminGetCaseStudyById(draft.id);
    if (!existing) {
      return { status: "error", message: "Case study not found." };
    }

    if (existing.status !== "draft") {
      // Single-source guard: this row's content is (or was) live. Only the
      // explicit Save/Publish buttons may write it.
      return {
        status: "skipped",
        message:
          "Autosave only runs on drafts. Use Save to update this case study.",
      };
    }

    // Content-only patch. `status` and `published_at` are intentionally
    // omitted so autosave can never change publication state.
    await adminUpdateCaseStudy(draft.id, {
      title: draft.title,
      slug: draft.slug,
      member_name: draft.member_name,
      member_role: nullable(draft.member_role),
      excerpt: nullable(draft.excerpt),
      body: draft.body,
      cover_url: nullable(draft.cover_url),
      cover_alt: nullable(draft.cover_alt),
      youtube_video_id: draft.youtube_video_id,
      quote: nullable(draft.quote),
      quote_attribution: nullable(draft.quote_attribution),
      monthly_revenue_usd: draft.monthly_revenue_usd,
      machine_count: draft.machine_count,
      location_count: draft.location_count,
      months_to_result: draft.months_to_result,
      prior_occupation: nullable(draft.prior_occupation),
      location_types: parseCommaList(draft.location_types),
      tags: parseCommaList(draft.tags),
      related_slugs: parseCommaList(draft.related_slugs),
      stats: parseStatsField(draft.stats),
    });

    revalidatePath("/admin/case-studies");
    return { status: "saved", savedAt: new Date().toISOString() };
  } catch (error) {
    console.error("case study draft autosave failed", error);
    return {
      status: "error",
      message: "Could not autosave. Your work is not saved yet.",
    };
  }
}

export async function createSignedCaseStudyImageUpload(formData: FormData) {
  await requireAuth();

  const upload = await createSignedImageStorageUpload({
    bucket: "case-study-images",
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
