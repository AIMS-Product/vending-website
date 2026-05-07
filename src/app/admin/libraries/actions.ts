"use server";

import { revalidatePath } from "next/cache";
import {
  adminCreateApprovedClaim,
  adminCreateCtaPreset,
  adminCreateProofItem,
  adminCreateSourceDocument,
  adminCreateSourceExcerpt,
} from "@/lib/services/page-builder-libraries";
import { requireAdmin } from "@/lib/supabase/auth";

const ADMIN_LIBRARIES_PATH = "/admin/libraries";

export async function createCtaPreset(formData: FormData) {
  await requireAdmin();
  await adminCreateCtaPreset({
    label: field(formData, "label"),
    href: field(formData, "href"),
    stylePreset: field(formData, "stylePreset"),
    trackingName: field(formData, "trackingName"),
  });
  revalidatePath(ADMIN_LIBRARIES_PATH);
}

export async function createProofItem(formData: FormData) {
  await requireAdmin();
  await adminCreateProofItem({
    kind: field(formData, "kind"),
    body: field(formData, "body"),
    name: field(formData, "name"),
    roleOrContext: field(formData, "roleOrContext"),
    sourceRightsNotes: field(formData, "sourceRightsNotes"),
    approved: formData.get("approved") === "on",
  });
  revalidatePath(ADMIN_LIBRARIES_PATH);
}

export async function createSourceDocument(formData: FormData) {
  const admin = await requireAdmin();
  await adminCreateSourceDocument({
    title: field(formData, "title"),
    sourceType: field(formData, "sourceType"),
    body: field(formData, "body"),
    tags: tags(field(formData, "tags")),
    createdBy: admin.user.id,
  });
  revalidatePath(ADMIN_LIBRARIES_PATH);
}

export async function createSourceExcerpt(formData: FormData) {
  const admin = await requireAdmin();
  const approved = formData.get("approved") === "on";
  await adminCreateSourceExcerpt({
    sourceDocumentId: field(formData, "sourceDocumentId"),
    excerpt: field(formData, "excerpt"),
    topicTags: tags(field(formData, "topicTags")),
    approved,
    approvedBy: approved ? admin.user.id : undefined,
  });
  revalidatePath(ADMIN_LIBRARIES_PATH);
}

export async function createApprovedClaim(formData: FormData) {
  const admin = await requireAdmin();
  await adminCreateApprovedClaim({
    claim: field(formData, "claim"),
    claimType: field(formData, "claimType"),
    sourceExcerptId: field(formData, "sourceExcerptId"),
    usageNotes: field(formData, "usageNotes"),
    riskLevel: field(formData, "riskLevel"),
    approvedBy: admin.user.id,
  });
  revalidatePath(ADMIN_LIBRARIES_PATH);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function tags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
