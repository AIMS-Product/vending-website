import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { LibrariesWorkspace } from "./LibrariesWorkspace";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import { adminListMediaAssets } from "@/lib/services/media-assets";
import { adminListPageBuilderLibraries } from "@/lib/services/page-builder-libraries";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Reusable content libraries",
  robots: { index: false, follow: false },
};

export default async function AdminLibrariesPage() {
  const { user, role } = await requireAdmin();
  const [libraries, mediaAssets] = await Promise.all([
    adminListPageBuilderLibraries(),
    adminListMediaAssets({ assetTypes: ["image"] }),
  ]);
  const editorMediaAssets = mediaAssets.map(toEditorMediaAsset);

  return (
    <AdminShell
      activeSection="libraries"
      eyebrow="CMS Governance"
      title="Reusable content libraries"
      description="Manage approved claims, source excerpts, proof points, and CTAs before they are reused across page types."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/media" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="image" />
            </span>
            Media library
          </Link>
          <Link href="/admin/pages/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New resource page
          </Link>
        </>
      }
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="layers"
          tone="blue"
          label="CTA presets"
          value={libraries.ctaPresets.length}
          caption="reusable actions"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Proof"
          value={libraries.proofItems.filter((item) => item.approved).length}
          caption="approved items"
        />
        <AdminMetricPanel
          icon="file"
          tone="slate"
          label="Sources"
          value={libraries.sourceDocuments.length}
          caption="documents"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Claims"
          value={libraries.approvedClaims.length}
          caption="governed copy"
        />
      </AdminMetricStrip>

      <LibrariesWorkspace
        libraries={libraries}
        editorMediaAssets={editorMediaAssets}
      />
    </AdminShell>
  );
}
