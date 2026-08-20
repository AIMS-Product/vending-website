"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminGetCaseStudyById,
  adminUpdateCaseStudy,
} from "@/lib/services/case-studies";
import { requireAdmin as requireAuth } from "@/lib/supabase/auth";

const ADMIN_CASE_STUDIES_PATH = "/admin/case-studies";
const PUBLIC_CASE_STUDIES_PATH = "/case-studies";

// Caps a single bulk archive so one submit cannot fan out into hundreds of
// sequential update calls. Extras beyond the cap are reported as failed in the
// result banner so the admin knows to re-run for the remainder.
const BULK_ARCHIVE_LIMIT = 50;

// Archive reuses the same status change the editor's "archive" intent performs
// (status -> "archived" via adminUpdateCaseStudy). It is reversible: a later
// publish or move-to-draft restores the case study. No hard delete.
async function archiveOne(caseStudyId: string): Promise<{ slug: string }> {
  const existing = await adminGetCaseStudyById(caseStudyId);
  if (!existing) {
    throw new Error("case study not found");
  }
  await adminUpdateCaseStudy(caseStudyId, { status: "archived" });
  return { slug: existing.slug };
}

function revalidateCaseStudyPaths(slug: string) {
  revalidatePath(ADMIN_CASE_STUDIES_PATH);
  revalidatePath(PUBLIC_CASE_STUDIES_PATH);
  revalidatePath(`${PUBLIC_CASE_STUDIES_PATH}/${slug}`);
}

// returnTo is allowlisted to "/admin/case-studies" or "/admin/case-studies?..."
// so we never redirect to an attacker-controlled path supplied through the form.
function adminCaseStudiesListReturnPath(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? ADMIN_CASE_STUDIES_PATH);
  if (returnTo === ADMIN_CASE_STUDIES_PATH) return returnTo;
  if (returnTo.startsWith(`${ADMIN_CASE_STUDIES_PATH}?`)) return returnTo;
  return ADMIN_CASE_STUDIES_PATH;
}

export async function archiveCaseStudyFromList(formData: FormData) {
  const admin = await requireAuth();
  const rawId = String(formData.get("id") ?? "");
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) {
    console.error("invalid case study id from list archive action", { rawId });
    redirect(`${ADMIN_CASE_STUDIES_PATH}?error=invalid-id`);
  }
  const caseStudyId = parsed.data;
  const returnTo = adminCaseStudiesListReturnPath(formData);

  try {
    const { slug } = await archiveOne(caseStudyId);
    revalidateCaseStudyPaths(slug);
  } catch (error) {
    console.error("failed to archive case study from list", {
      adminUserId: admin.user.id,
      caseStudyId,
      error,
    });
    redirect(`${ADMIN_CASE_STUDIES_PATH}/${caseStudyId}?error=archive`);
  }

  redirect(returnTo);
}

export async function bulkArchiveCaseStudiesFromList(formData: FormData) {
  const admin = await requireAuth();
  const returnTo = adminCaseStudiesListReturnPath(formData);
  const rawIds = formData.getAll("ids").map((value) => String(value));
  const uniqueIds = [
    ...new Set(rawIds.filter((id) => z.uuid().safeParse(id).success)),
  ];

  if (uniqueIds.length === 0) {
    redirect(`${ADMIN_CASE_STUDIES_PATH}?error=bulk-archive`);
  }

  const ids = uniqueIds.slice(0, BULK_ARCHIVE_LIMIT);
  let archived = 0;
  let failed = uniqueIds.length - ids.length;
  for (const caseStudyId of ids) {
    try {
      const { slug } = await archiveOne(caseStudyId);
      revalidateCaseStudyPaths(slug);
      archived += 1;
    } catch (error) {
      console.error("failed to bulk-archive case study from list", {
        adminUserId: admin.user.id,
        caseStudyId,
        error,
      });
      failed += 1;
    }
  }

  if (archived === 0) {
    redirect(`${ADMIN_CASE_STUDIES_PATH}?error=bulk-archive`);
  }
  redirect(bulkArchiveResultPath(returnTo, archived, failed));
}

// returnTo is allowlisted by adminCaseStudiesListReturnPath, so appending only
// needs to pick the separator.
function bulkArchiveResultPath(
  returnTo: string,
  archived: number,
  failed: number,
) {
  const separator = returnTo.includes("?") ? "&" : "?";
  const failedParam = failed > 0 ? `&failed=${failed}` : "";
  return `${returnTo}${separator}archived=${archived}${failedParam}`;
}
