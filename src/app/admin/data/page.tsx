import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTrustBar } from "@/components/admin/DataTrustBar";
import { GlossaryPanel, TrustChecks } from "@/components/admin/DataTrustPanels";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { getDataTrust } from "@/lib/services/data-trust";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Data trust",
  robots: { index: false, follow: false },
};

// The whole point of the page is what is true right now; a cached verdict
// is the failure mode it exists to prevent.
export const dynamic = "force-dynamic";

export default async function AdminDataPage() {
  const [{ user, role }, trust, bar] = await Promise.all([
    requireReadAccess(),
    getDataTrust(),
    getTrustBar("data"),
  ]);

  return (
    <AdminShell
      activeSection="data"
      eyebrow="Reporting"
      title="Data trust"
      description="Where every number comes from, and whether it currently agrees with the system that owns it."
      userEmail={user.email}
      userRole={role}
    >
      <DataTrustBar model={bar} />
      <TrustChecks run={trust.run} checksError={trust.checksError} />
      <GlossaryPanel
        glossaryHtml={trust.glossaryHtml}
        glossaryError={trust.glossaryError}
      />
    </AdminShell>
  );
}
