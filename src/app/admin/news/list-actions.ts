"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminGetPostById, adminUpdatePost } from "@/lib/services/news";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";

const ADMIN_NEWS_PATH = "/admin/news";
const PUBLIC_NEWS_PATH = "/news";

// Caps a single bulk archive so one submit cannot fan out into hundreds of
// sequential update calls. Extras beyond the cap are reported as failed in the
// result banner so the admin knows to re-run for the remainder.
const BULK_ARCHIVE_LIMIT = 50;

// Archive reuses the same status change the editor's "archive" intent performs
// (status -> "archived" via adminUpdatePost). It is reversible: a later publish
// or move-to-draft restores the post. No hard delete.
async function archiveOne(postId: string): Promise<{ slug: string }> {
  const existing = await adminGetPostById(postId);
  if (!existing) {
    throw new Error("post not found");
  }
  await adminUpdatePost(postId, { status: "archived" });
  return { slug: existing.slug };
}

function revalidateNewsPaths(slug: string) {
  revalidatePath(ADMIN_NEWS_PATH);
  revalidatePath(PUBLIC_NEWS_PATH);
  revalidatePath(`${PUBLIC_NEWS_PATH}/${slug}`);
}

// returnTo is allowlisted to "/admin/news" or "/admin/news?..." so we never
// redirect to an attacker-controlled path supplied through the form.
function adminNewsListReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? ADMIN_NEWS_PATH);
  if (returnTo === ADMIN_NEWS_PATH) return returnTo;
  if (returnTo.startsWith(`${ADMIN_NEWS_PATH}?`)) return returnTo;
  return ADMIN_NEWS_PATH;
}

export async function archivePostFromList(formData: FormData) {
  const admin = await requireAuth();
  const rawId = String(formData.get("id") ?? "");
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) {
    console.error("invalid news post id from list archive action", { rawId });
    redirect(`${ADMIN_NEWS_PATH}?error=invalid-id`);
  }
  const postId = parsed.data;
  const returnTo = adminNewsListReturnPath(formData);

  try {
    const { slug } = await archiveOne(postId);
    revalidateNewsPaths(slug);
  } catch (error) {
    console.error("failed to archive news post from list", {
      adminUserId: admin.user.id,
      postId,
      error,
    });
    redirect(`${ADMIN_NEWS_PATH}/${postId}?error=archive`);
  }

  redirect(returnTo);
}

export async function bulkArchivePostsFromList(formData: FormData) {
  const admin = await requireAuth();
  const returnTo = adminNewsListReturnPath(formData);
  const rawIds = formData.getAll("ids").map((value) => String(value));
  const uniqueIds = [
    ...new Set(rawIds.filter((id) => z.uuid().safeParse(id).success)),
  ];

  if (uniqueIds.length === 0) {
    redirect(`${ADMIN_NEWS_PATH}?error=bulk-archive`);
  }

  const ids = uniqueIds.slice(0, BULK_ARCHIVE_LIMIT);
  let archived = 0;
  let failed = uniqueIds.length - ids.length;
  for (const postId of ids) {
    try {
      const { slug } = await archiveOne(postId);
      revalidateNewsPaths(slug);
      archived += 1;
    } catch (error) {
      console.error("failed to bulk-archive news post from list", {
        adminUserId: admin.user.id,
        postId,
        error,
      });
      failed += 1;
    }
  }

  if (archived === 0) {
    redirect(`${ADMIN_NEWS_PATH}?error=bulk-archive`);
  }
  redirect(bulkArchiveResultPath(returnTo, archived, failed));
}

// returnTo is allowlisted by adminNewsListReturnPath, so appending only needs
// to pick the separator.
function bulkArchiveResultPath(
  returnTo: string,
  archived: number,
  failed: number,
) {
  const separator = returnTo.includes("?") ? "&" : "?";
  const failedParam = failed > 0 ? `&failed=${failed}` : "";
  return `${returnTo}${separator}archived=${archived}${failedParam}`;
}
