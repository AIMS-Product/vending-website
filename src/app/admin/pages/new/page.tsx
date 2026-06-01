import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { SeoPageEditorForm } from "@/components/admin/SeoPageEditorForm";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import { adminListMediaAssets } from "@/lib/services/media-assets";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "New SEO page",
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
      title="New SEO page"
      description="Create a structured page using the current SEO page contract."
      userEmail={user.email}
      userRole={role}
      immersive
    >
      <SeoPageEditorForm
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
      />
    </AdminShell>
  );
}
