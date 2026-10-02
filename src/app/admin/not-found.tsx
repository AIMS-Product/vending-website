import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";

/**
 * A stale or mistyped Studio record link (lead, article, form, popup...) used
 * to land on the public marketing 404 and drop the admin out of the Studio.
 * notFound() is only called from signed-in pages, so no auth variant is needed.
 */
export default function AdminNotFound() {
  return (
    <AdminShell activeSection="overview" title="Not found" roleUnknown>
      <div className={`${adminPanelClass} px-6 py-10 text-center`}>
        <h2 className="text-ui-text text-base font-semibold">
          That record does not exist or was deleted
        </h2>
        <p className="text-ui-text-muted mx-auto mt-2 max-w-md text-sm">
          The link may be out of date. Head back to the Overview to find what
          you were looking for.
        </p>
        <div className="mt-5 flex justify-center">
          <Link href="/admin" className={adminSecondaryButtonClass}>
            Back to Overview
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
