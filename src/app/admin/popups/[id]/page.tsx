import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { PopupEditor } from "@/components/admin/PopupEditor";
import { adminGetPopup, adminPopupEventTotals } from "@/lib/services/popups";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };

export const metadata: Metadata = {
  title: "Edit popup",
  robots: { index: false, follow: false },
};

export default async function EditPopupPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, { id }] = await Promise.all([requireAdmin(), params]);
  const [entry, totalsMap] = await Promise.all([
    adminGetPopup(id),
    adminPopupEventTotals().catch(() => null),
  ]);
  if (!entry) notFound();

  const totals = totalsMap?.get(entry.id) ?? {
    shown: 0,
    ctaClicked: 0,
    converted: 0,
    dismissed: 0,
  };

  return (
    <AdminShell
      activeSection="popups"
      eyebrow="Site campaigns"
      title="Edit popup"
      description="Changes save as one step; the live preview always matches what visitors will see."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/popups" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="megaphone" />
          </span>
          All popups
        </Link>
      }
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Shown"
          value={totals.shown}
          caption="impressions"
        />
        <AdminMetricPanel
          label="CTA clicks"
          value={totals.ctaClicked}
          caption="primary + secondary"
        />
        <AdminMetricPanel
          label="Converted"
          value={totals.converted}
          caption="completed the offer"
        />
        <AdminMetricPanel
          label="Dismissed"
          value={totals.dismissed}
          caption="closed without clicking"
        />
      </AdminMetricStrip>
      <PopupEditor entry={entry} />
    </AdminShell>
  );
}
