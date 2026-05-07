import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  SeoPageEditorForm,
  type SeoPageEditorMediaAsset,
} from "@/components/admin/SeoPageEditorForm";
import {
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "New resource page",
  robots: { index: false, follow: false },
};

export default async function NewSeoPagePage() {
  const { user, role } = await requireAdmin();
  const [internalLinkTargets, mediaAssets] = await Promise.all([
    adminListInternalLinkTargets(),
    adminListMediaAssets(),
  ]);

  return (
    <AdminShell
      activeSection="pages"
      eyebrow="SEO Page Builder"
      title="New resource page"
      description="Create a structured page using the current resource-page contract."
      userEmail={user.email}
      userRole={role}
    >
      <SeoPageEditorForm
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
      />
    </AdminShell>
  );
}

function toEditorMediaAsset(
  asset: Awaited<ReturnType<typeof adminListMediaAssets>>[number],
): SeoPageEditorMediaAsset {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.alt_text ?? "",
    caption: asset.caption ?? "",
    sourceRightsNotes: asset.source_rights_notes ?? "",
    publicUrl: publicMediaAssetUrl(asset),
  };
}
