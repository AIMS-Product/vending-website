import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { adminListBuilderRedirects } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import { RedirectCreateForm } from "./RedirectCreateForm";
import { RedirectRow } from "./RedirectRow";

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Redirect created.",
  updated: "Redirect updated.",
  deleted: "Redirect deleted.",
};

export default async function RedirectManagerPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
  }>;
}) {
  const [{ user, role }, params, redirects] = await Promise.all([
    requireAdmin(),
    searchParams,
    adminListBuilderRedirects(),
  ]);

  const successMessage = params.created
    ? SUCCESS_MESSAGES.created
    : params.updated
      ? SUCCESS_MESSAGES.updated
      : params.deleted
        ? SUCCESS_MESSAGES.deleted
        : null;

  return (
    <AdminShell
      activeSection="pages"
      title="Redirects"
      description="Redirects forward visitors from an old address to a new one so links keep working."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/pages" className={adminSecondaryButtonClass}>
          Back to pages
        </Link>
      }
    >
      {successMessage ? (
        <p
          role="status"
          className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
        >
          {successMessage}
        </p>
      ) : null}

      <RedirectCreateForm />

      <section className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Old address (path)</th>
                <th className="px-5 py-3">New address (destination)</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {redirects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-6 text-center text-sm text-slate-500"
                  >
                    No redirects yet. Create one above to send an old address to
                    a new destination.
                  </td>
                </tr>
              ) : (
                redirects.map((item) => (
                  <RedirectRow key={item.id} redirect={item} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
