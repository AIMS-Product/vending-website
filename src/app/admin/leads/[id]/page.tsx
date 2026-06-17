import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { AdminLeadDetailView } from "@/components/admin/AdminLeadsManager";
import { adminGetLeadDetail } from "@/lib/services/lead-admin";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = {
  id: string;
};

export const metadata: Metadata = {
  title: "Lead detail",
  robots: { index: false, follow: false },
};

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, resolvedParams] = await Promise.all([
    requireAdmin(),
    params,
  ]);
  const lead = await adminGetLeadDetail({ leadId: resolvedParams.id });

  if (!lead) notFound();

  return (
    <AdminShell
      activeSection="leads"
      eyebrow="Lead operations"
      title={lead.fullName}
      description="Inspect qualification answers, source attribution, and Close sync recovery state."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/leads" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="list" />
          </span>
          Back to leads
        </Link>
      }
    >
      <AdminLeadDetailView lead={lead} />
    </AdminShell>
  );
}
