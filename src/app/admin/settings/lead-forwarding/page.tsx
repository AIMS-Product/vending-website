import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLeadForwardingManager } from "@/components/admin/AdminLeadForwardingManager";
import { config } from "@/lib/config";
import {
  getLeadForwardCaptureCounts,
  getLeadForwardSettings,
} from "@/lib/services/lead-forward-settings";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Lead forwarding admin",
  robots: { index: false, follow: false },
};

export default async function AdminLeadForwardingPage() {
  const { user, role } = await requireAdmin();
  const [settings, counts] = await Promise.all([
    getLeadForwardSettings(),
    getLeadForwardCaptureCounts(),
  ]);

  return (
    <AdminShell
      activeSection="lead-forwarding"
      eyebrow="Studio Settings"
      title="Lead forwarding"
      description="Send website captures to a partner's CRM, and choose exactly which ones go."
      userEmail={user.email}
      userRole={role}
    >
      <AdminLeadForwardingManager
        settings={settings}
        counts={counts}
        currentUserRole={role}
        hasApiCredentials={Boolean(
          config.WESCALE_GHL_TOKEN && config.WESCALE_GHL_LOCATION_ID,
        )}
      />
    </AdminShell>
  );
}
