import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { adminListBuilderRedirects } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import { createBuilderRedirect } from "./actions";

export default async function RedirectManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const [{ user, role }, params, redirects] = await Promise.all([
    requireAdmin(),
    searchParams,
    adminListBuilderRedirects(),
  ]);

  return (
    <AdminShell
      activeSection="pages"
      title="Redirect Manager"
      description="Create and inspect builder redirects across page prefixes."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/pages" className={adminSecondaryButtonClass}>
          Back to pages
        </Link>
      }
    >
      <section className={`${adminPanelClass} mb-5 p-5`}>
        {params.error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {params.error}
          </p>
        ) : null}
        {params.created ? (
          <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Redirect created.
          </p>
        ) : null}
        <form
          action={createBuilderRedirect}
          className="grid gap-4 lg:grid-cols-5"
        >
          <label className={adminLabelClass}>
            Old path
            <input
              name="sourcePath"
              required
              placeholder="/resources/old-page"
              className={adminInputClass}
            />
          </label>
          <label className={adminLabelClass}>
            Destination
            <input
              name="destinationPath"
              required
              placeholder="/blog/new-page"
              className={adminInputClass}
            />
          </label>
          <label className={adminLabelClass}>
            Status
            <select
              name="statusCode"
              defaultValue="301"
              className={adminInputClass}
            >
              <option value="301">301 permanent</option>
              <option value="302">302 temporary</option>
              <option value="307">307 temporary</option>
              <option value="308">308 permanent</option>
            </select>
          </label>
          <label className={adminLabelClass}>
            Page ID
            <input
              name="pageId"
              placeholder="Optional"
              className={adminInputClass}
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className={adminPrimaryButtonClass}>
              Create redirect
            </button>
          </div>
        </form>
      </section>

      <section className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Old path</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {redirects.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">
                    {item.source_path}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">
                    {item.destination_path}
                  </td>
                  <td className="px-5 py-3">{item.status_code}</td>
                  <td className="px-5 py-3">{item.created_reason}</td>
                  <td className="px-5 py-3">
                    {new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
