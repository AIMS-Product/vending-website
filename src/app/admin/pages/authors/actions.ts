"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminCreateAuthorProfile } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

export async function createAuthorProfile(formData: FormData) {
  await requireAdmin();
  let redirectPath = "/admin/pages/authors?created=1";
  try {
    await adminCreateAuthorProfile({
      displayName: String(formData.get("displayName") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      roleTitle: String(formData.get("roleTitle") ?? ""),
      avatarAssetId: String(formData.get("avatarAssetId") ?? "") || null,
    });
    revalidatePath("/admin/pages/authors");
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Could not create author";
    redirectPath = `/admin/pages/authors?error=${encodeURIComponent(message)}`;
  }
  redirect(redirectPath);
}
