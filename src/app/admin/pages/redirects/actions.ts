"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminCreateBuilderRedirect,
  SeoPageValidationError,
} from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

export async function createBuilderRedirect(formData: FormData) {
  const admin = await requireAdmin();
  let redirectPath = "/admin/pages/redirects?created=1";

  try {
    await adminCreateBuilderRedirect({
      sourcePath: String(formData.get("sourcePath") ?? ""),
      destinationPath: String(formData.get("destinationPath") ?? ""),
      statusCode: Number(formData.get("statusCode") ?? 301),
      pageId: String(formData.get("pageId") ?? "") || null,
      createdBy: admin.user.id,
      createdReason: "manual",
    });
    revalidatePath("/admin/pages/redirects");
  } catch (error) {
    if (error instanceof SeoPageValidationError) {
      redirectPath = `/admin/pages/redirects?error=${encodeURIComponent(
        error.issues[0]?.message ?? "Redirect is invalid.",
      )}`;
    } else {
      redirectPath =
        "/admin/pages/redirects?error=Could%20not%20create%20redirect";
    }
  }

  redirect(redirectPath);
}
