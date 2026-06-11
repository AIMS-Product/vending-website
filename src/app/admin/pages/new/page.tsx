import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { SeoPageEditorForm } from "@/components/admin/SeoPageEditorForm";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import { adminListMediaAssets } from "@/lib/services/media-assets";
import { adminListInternalLinkTargets } from "@/lib/services/seo-internal-link-index";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { routePrefixOptionsFrom } from "@/lib/page-builder/page-paths";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Create page",
  robots: { index: false, follow: false },
};

export default async function NewSeoPagePage() {
  const { user, role } = await requireAdmin();
  const [internalLinkTargets, mediaAssets, routePrefixes] = await Promise.all([
    adminListInternalLinkTargets(),
    adminListMediaAssets(),
    listRoutePrefixes(),
  ]);

  return (
    <AdminShell
      activeSection="pages"
      eyebrow="SEO Page Builder"
      title="Create page"
      description="Create a structured page using the current SEO page contract."
      userEmail={user.email}
      userRole={role}
      immersive
    >
      <SeoPageEditorForm
        internalLinkTargets={internalLinkTargets}
        mediaAssets={mediaAssets.map(toEditorMediaAsset)}
        routePrefixOptions={routePrefixOptionsFrom(routePrefixes)}
      />
    </AdminShell>
  );
}
