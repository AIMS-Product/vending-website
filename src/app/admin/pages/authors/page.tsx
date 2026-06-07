import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { adminListAuthorProfiles } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAuthorProfile } from "./actions";

export default async function AuthorProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { user, role } = await requireAdmin();
  const [params, authors] = await Promise.all([
    searchParams,
    adminListAuthorProfiles(),
  ]);

  return (
    <AdminShell
      activeSection="pages"
      title="Author Profiles"
      description="Manage public author identities separately from admin users."
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
            Author created.
          </p>
        ) : null}
        <form
          action={createAuthorProfile}
          className="grid gap-4 lg:grid-cols-3"
        >
          <label className={adminLabelClass}>
            Display name
            <input name="displayName" required className={adminInputClass} />
          </label>
          <label className={adminLabelClass}>
            Slug
            <input name="slug" required className={adminInputClass} />
          </label>
          <label className={adminLabelClass}>
            Role/title
            <input name="roleTitle" className={adminInputClass} />
          </label>
          <label className={`${adminLabelClass} lg:col-span-3`}>
            Bio
            <textarea name="bio" rows={3} className={adminTextareaClass} />
          </label>
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              Advanced media settings
            </summary>
            <label className={`${adminLabelClass} mt-4`}>
              Avatar media asset
              <input
                name="avatarAssetId"
                placeholder="Optional media-library asset ID"
                className={adminInputClass}
                aria-describedby="author-avatar-help"
              />
              <span
                id="author-avatar-help"
                className="mt-1 block text-xs leading-5 text-slate-500"
              >
                Use only when the exact media-library asset ID is known.
              </span>
            </label>
          </details>
          <div className="flex items-end">
            <button type="submit" className={adminPrimaryButtonClass}>
              Create author
            </button>
          </div>
        </form>
      </section>

      <section className={adminPanelClass}>
        <div className="divide-y divide-slate-200">
          {authors.map((author) => (
            <article key={author.id} className="p-5">
              <h2 className="text-base font-semibold text-slate-950">
                {author.display_name}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                /blog/author/{author.slug}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {author.role_title ?? "No role set"}
              </p>
              {author.bio ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                  {author.bio}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
