import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/admin/news/actions";
import {
  adminListSeoPages,
  type SeoPageListOptions,
} from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Tables } from "@/types/database";

type SearchParams = { status?: string };
type StatusFilter = "all" | "draft" | "published" | "archived";

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export const metadata: Metadata = {
  title: "SEO pages admin",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, role } = await requireAdmin();
  const params = await searchParams;
  const active = normalizeStatus(params.status);
  const options: SeoPageListOptions =
    active === "all" ? {} : { status: active };
  const pages = await adminListSeoPages(options);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Resource pages
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as{" "}
            <span className="font-medium text-slate-900">{user.email}</span> (
            {role}).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/media"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Media
          </Link>
          <Link
            href="/admin/libraries"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Libraries
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/admin/pages/new"
            className="bg-brand-500 hover:bg-brand-600 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition"
          >
            New page
          </Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Page status filters">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/pages"
                : `/admin/pages?status=${filter.value}`
            }
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active === filter.value
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {pages.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No resource pages yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Create the first structured SEO page draft.
            </p>
            <Link
              href="/admin/pages/new"
              className="bg-brand-500 hover:bg-brand-600 mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              New page
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Keyword</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.map((page) => (
                <PageRow key={page.id} page={page} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function PageRow({ page }: { page: Tables<"seo_pages"> }) {
  return (
    <tr className="align-top transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <Link
          href={`/admin/pages/${page.id}`}
          className="hover:text-brand-600 font-semibold text-slate-950"
        >
          {page.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-slate-500">
          /resources/{page.slug}
        </p>
      </td>
      <td className="px-5 py-4 text-slate-600">{page.target_keyword || "-"}</td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
            page.status,
          )}`}
        >
          {page.status}
        </span>
      </td>
      <td className="px-5 py-4 text-slate-600">
        {formatDate(page.updated_at)}
      </td>
      <td className="px-5 py-4 text-slate-600">
        {page.published_at ? formatDate(page.published_at) : "-"}
      </td>
    </tr>
  );
}

function normalizeStatus(value: string | undefined): StatusFilter {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return "all";
}

function statusClass(status: string) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
