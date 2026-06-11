import type { Metadata } from "next";
import { AdminRoutePrefixesManager } from "@/components/admin/AdminRoutePrefixesManager";
import { AdminShell } from "@/components/admin/AdminShell";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Route settings admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsRoutesPage() {
  const { user, role } = await requireAdmin();
  const prefixes = await listRoutePrefixes();

  return (
    <AdminShell
      activeSection="routes"
      eyebrow="Studio Settings"
      title="Route prefixes"
      description="Manage the allowed URL prefixes for builder pages. Default prefixes are built in and cannot be deleted."
      userEmail={user.email}
      userRole={role}
    >
      <AdminRoutePrefixesManager prefixes={prefixes} currentUserRole={role} />
    </AdminShell>
  );
}
