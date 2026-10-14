"use server";

import { revalidatePath } from "next/cache";
import {
  createMarketingLink,
  MarketingLinkServiceError,
  updateMarketingLinkMeta,
} from "@/lib/services/marketing-links";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";

export type LinkBuilderActionState =
  | { status: "idle" }
  | { status: "saved"; message: string; url: string; shortUrl: string | null }
  | { status: "error"; message: string };

const ADMIN_LINKS_PATH = "/admin/links";
const VIEWER_MESSAGE =
  "This login can view links but not save them. Ask an admin for an editor login.";

/** Builds, validates, optionally shortens and stores one marketing link. */
export async function createLink(
  _prev: LinkBuilderActionState,
  formData: FormData,
): Promise<LinkBuilderActionState> {
  try {
    // Not requireAdmin(): its redirect() would be caught below and shown as
    // "Could not save the link." A viewer gets told why instead.
    const { user, role } = await requireReadAccess();
    if (!canEditAdmin(role)) {
      return { status: "error", message: VIEWER_MESSAGE };
    }
    const link = await createMarketingLink(
      {
        baseUrl: String(formData.get("baseUrl") ?? ""),
        source: String(formData.get("source") ?? ""),
        medium: String(formData.get("medium") ?? ""),
        campaign: String(formData.get("campaign") ?? ""),
        content: String(formData.get("content") ?? ""),
        destination: String(formData.get("destination") ?? ""),
        label: String(formData.get("label") ?? ""),
        funnelName: String(formData.get("funnelName") ?? ""),
        owner: String(formData.get("owner") ?? ""),
        mintShortLink: formData.get("shortLink") === "on",
      },
      { createdBy: user.email },
    );
    revalidatePath(ADMIN_LINKS_PATH);
    return {
      status: "saved",
      message: link.bitly_url ? "Link saved and shortened." : "Link saved.",
      url: link.url,
      shortUrl: link.bitly_url,
    };
  } catch (error) {
    if (error instanceof MarketingLinkServiceError) {
      return { status: "error", message: error.message };
    }
    console.error("link builder action failed", error);
    return { status: "error", message: "Could not save the link." };
  }
}

export type LinkMetaActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

/** Sets funnel, owner and note on one registry row (tags never change). */
export async function updateLinkMeta(
  _prev: LinkMetaActionState,
  formData: FormData,
): Promise<LinkMetaActionState> {
  try {
    const { user, role } = await requireReadAccess();
    if (!canEditAdmin(role)) {
      return { status: "error", message: VIEWER_MESSAGE };
    }
    await updateMarketingLinkMeta(
      String(formData.get("id") ?? ""),
      {
        funnelName: String(formData.get("funnelName") ?? ""),
        owner: String(formData.get("owner") ?? ""),
        label: String(formData.get("label") ?? ""),
      },
      { editedBy: user.email },
    );
    revalidatePath(ADMIN_LINKS_PATH);
    return { status: "saved" };
  } catch (error) {
    if (error instanceof MarketingLinkServiceError) {
      return { status: "error", message: error.message };
    }
    console.error("link meta action failed", error);
    return { status: "error", message: "Could not save the change." };
  }
}
