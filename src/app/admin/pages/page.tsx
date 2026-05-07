import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
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
  const [allPages, filteredPages] = await Promise.all([
    adminListSeoPages(),
    active === "all" ? Promise.resolve(null) : adminListSeoPages(options),
  ]);
  const pages = filteredPages ?? allPages;
  const pageCounts = countPagesByStatus(allPages);

  return (
    <AdminShell
      activeSection="pages"
      eyebrow="SEO Page Builder"
      title="Resource pages"
      description="Manage structured SEO/resource pages now, with the same CMS shell ready for blogs, landing pages, campaigns, and other content types."
      userEmail={user.email}
      userRole={role}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Showing" value={pages.length} />
        <MetricCard label="Drafts" value={pageCounts.draft} />
        <MetricCard label="Published" value={pageCounts.published} />
        <MetricCard label="Archived" value={pageCounts.archived} />
      </div>

      <nav
        className="mb-5 inline-flex flex-wrap gap-1 rounded-lg bg-[#e8e8ed] p-1"
        aria-label="Page status filters"
      >
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/pages"
                : `/admin/pages?status=${filter.value}`
            }
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              active === filter.value
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        {pages.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">
              No resource pages yet
            </h2>
            <p className="mt-2 text-sm text-[#6e6e73]">
              Create the first structured SEO page draft.
            </p>
            <Link
              href="/admin/pages/new"
              className="mt-5 inline-flex rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0077ed]"
            >
              New page
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-black/10 bg-[#fbfbfd] text-xs font-semibold text-[#86868b] uppercase">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Keyword</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {pages.map((page) => (
                <PageRow key={page.id} page={page} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-medium text-[#86868b]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal text-[#1d1d1f]">
        {value}
      </p>
    </div>
  );
}

function PageRow({ page }: { page: Tables<"seo_pages"> }) {
  return (
    <tr className="align-top transition hover:bg-[#f5f5f7]">
      <td className="px-5 py-4">
        <Link
          href={`/admin/pages/${page.id}`}
          className="font-semibold text-[#1d1d1f] hover:text-[#0071e3]"
        >
          {page.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-[#86868b]">
          /resources/{page.slug}
        </p>
      </td>
      <td className="px-5 py-4 text-[#6e6e73]">{page.target_keyword || "-"}</td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
            page.status,
          )}`}
        >
          {page.status}
        </span>
      </td>
      <td className="px-5 py-4 text-[#6e6e73]">
        {formatDate(page.updated_at)}
      </td>
      <td className="px-5 py-4 text-[#6e6e73]">
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

function countPagesByStatus(pages: Tables<"seo_pages">[]) {
  return pages.reduce(
    (counts, page) => {
      if (page.status === "draft") counts.draft += 1;
      if (page.status === "published") counts.published += 1;
      if (page.status === "archived") counts.archived += 1;
      return counts;
    },
    { draft: 0, published: 0, archived: 0 },
  );
}

function statusClass(status: string) {
  if (status === "published") return "bg-[#e4f7ec] text-[#0b6b35]";
  if (status === "archived") return "bg-[#e8e8ed] text-[#6e6e73]";
  return "bg-[#fff3d6] text-[#8a5a00]";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
