import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { PopupsManager } from "@/components/admin/PopupsManager";
import {
  adminListPopups,
  adminPopupEventTotals,
  sumPopupEventTotals,
  type AdminPopup,
  type PopupEventTotals,
} from "@/lib/services/popups";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Popups admin",
  robots: { index: false, follow: false },
};

export default async function AdminPopupsPage() {
  const { user, role } = await requireAdmin();

  // Until the popups migration is applied the table does not exist; the page
  // should explain that instead of hard-erroring.
  let popups: AdminPopup[] = [];
  let totalsByPopup: Record<string, PopupEventTotals> = {};
  let loadError = false;
  try {
    const [list, totals] = await Promise.all([
      adminListPopups(),
      adminPopupEventTotals(),
    ]);
    popups = list;
    totalsByPopup = Object.fromEntries(totals);
  } catch (error) {
    console.warn("popups admin list failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    loadError = true;
  }

  return (
    <AdminShell
      activeSection="popups"
      eyebrow="Site campaigns"
      title="Popups"
      description="Create, preview, and activate the popups shown across the public site."
      userEmail={user.email}
      userRole={role}
    >
      <PopupsManager
        popups={popups}
        totalsByPopup={totalsByPopup}
        grandTotals={sumPopupEventTotals(Object.values(totalsByPopup))}
        loadError={loadError}
      />
    </AdminShell>
  );
}
