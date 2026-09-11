"use server";

import { revalidatePath } from "next/cache";
import {
  createMarketingLink,
  MarketingLinkServiceError,
} from "@/lib/services/marketing-links";
import { requireAdmin } from "@/lib/supabase/auth";

export type LinkBuilderActionState =
  | { status: "idle" }
  | { status: "saved"; message: string; url: string; shortUrl: string | null }
  | { status: "error"; message: string };

const ADMIN_LINKS_PATH = "/admin/links";

/** Builds, validates, optionally shortens and stores one marketing link. */
export async function createLink(
  _prev: LinkBuilderActionState,
  formData: FormData,
): Promise<LinkBuilderActionState> {
  try {
    const { user } = await requireAdmin();
    const link = await createMarketingLink(
      {
        baseUrl: String(formData.get("baseUrl") ?? ""),
        source: String(formData.get("source") ?? ""),
        medium: String(formData.get("medium") ?? ""),
        campaign: String(formData.get("campaign") ?? ""),
        content: String(formData.get("content") ?? ""),
        destination: String(formData.get("destination") ?? ""),
        label: String(formData.get("label") ?? ""),
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
