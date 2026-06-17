import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { AdminLeadsManager } from "@/components/admin/AdminLeadsManager";
import { adminListLeads } from "@/lib/services/lead-admin";
import { requireAdmin } from "@/lib/supabase/auth";

type SearchParams = {
  lifecycle?: string | string[];
  sync?: string | string[];
};

export const metadata: Metadata = {
  title: "Leads admin",
  robots: { index: false, follow: false },
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const lifecycleStatus = singleParam(params.lifecycle) ?? "all";
  const closeSyncStatus = singleParam(params.sync) ?? "all";
  const leads = await adminListLeads({
    lifecycleStatus,
    closeSyncStatus,
  });

  return (
    <AdminShell
      activeSection="leads"
      eyebrow="Lead operations"
      title="Leads"
      description="Review captured leads, qualification progress, source attribution, and Close sync recovery state."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/forms" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="list" />
          </span>
          Qualification forms
        </Link>
      }
    >
      <AdminLeadsManager
        leads={leads}
        activeLifecycleStatus={lifecycleStatus}
        activeCloseSyncStatus={closeSyncStatus}
      />
    </AdminShell>
  );
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
