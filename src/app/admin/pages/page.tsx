import type { Metadata } from "next";
import Link from "next/link";
import {
  archiveSeoPageFromList,
  moveSeoPageToDraftFromList,
  publishSeoPageFromList,
} from "@/app/admin/pages/actions";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminListSeoPages } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Tables } from "@/types/database";

type SearchParams = {
  status?: string | string[];
  q?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  perPage?: string | string[];
};
type StatusFilter = "all" | "draft" | "published" | "archived";
type SortKey = "updated-desc" | "updated-asc" | "title-asc";

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

const sortLabels: Record<SortKey, string> = {
  "updated-desc": "Updated newest",
  "updated-asc": "Updated oldest",
  "title-asc": "Title A-Z",
};

const pageSizeOptions = [10, 25, 50, 100] as const;
type PageSize = (typeof pageSizeOptions)[number];
const defaultPageSize: PageSize = 10;

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
  const active = normalizeStatus(firstParam(params.status));
  const searchQuery = normalizeSearch(firstParam(params.q));
  const sort = normalizeSort(firstParam(params.sort));
  const requestedPage = normalizePage(firstParam(params.page));
  const pageSize = normalizePageSize(firstParam(params.perPage));

  const allPages = await adminListSeoPages();
  const pageCounts = countPagesByStatus(allPages);
  const filteredPages = sortPages(
    filterPages(allPages, active, searchQuery),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visiblePages = filteredPages.slice(pageStart, pageStart + pageSize);
  const displayStart = filteredPages.length === 0 ? 0 : pageStart + 1;
  const displayEnd = Math.min(pageStart + pageSize, filteredPages.length);
  const returnTo = adminPagesHref({
    status: active,
    q: searchQuery,
    sort,
    page: currentPage,
    perPage: pageSize,
  });

  return (
    <AdminShell
      activeSection="pages"
      title="Resource pages"
      description="Manage structured SEO/resource pages with the same CMS shell ready for blogs, landing pages, campaigns, and other content types."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link
          href="/admin/pages/new"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0b63f6] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <span aria-hidden="true">
            <PageIcon icon="plus" />
          </span>
          New resource page
        </Link>
      }
    >
      <section
        className="mb-7 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        aria-label="Resource page summary"
      >
        <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          <MetricPanel
            icon="file"
            tone="blue"
            label="Total"
            value={allPages.length}
            caption="all pages"
          />
          <MetricPanel
            icon="pencil"
            tone="amber"
            label="Drafts"
            value={pageCounts.draft}
            caption="needs work"
          />
          <MetricPanel
            icon="check"
            tone="green"
            label="Published"
            value={pageCounts.published}
            caption="live"
          />
          <MetricPanel
            icon="archive"
            tone="slate"
            label="Archived"
            value={pageCounts.archived}
            caption="retired"
          />
        </div>
      </section>

      <div className="mb-7 grid gap-3">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <form
              action="/admin/pages"
              className="flex h-12 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm lg:w-80 lg:shrink-0"
            >
              <span className="text-slate-500" aria-hidden="true">
                <PageIcon icon="search" />
              </span>
              <label className="sr-only" htmlFor="admin-pages-search">
                Search resource pages
              </label>
              <input
                id="admin-pages-search"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search title, keyword, or URL"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
              />
              {active !== "all" ? (
                <input type="hidden" name="status" value={active} />
              ) : null}
              {sort !== "updated-desc" ? (
                <input type="hidden" name="sort" value={sort} />
              ) : null}
              {pageSize !== defaultPageSize ? (
                <input type="hidden" name="perPage" value={pageSize} />
              ) : null}
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500 sm:inline">
                K
              </kbd>
              <button type="submit" className="sr-only">
                Search
              </button>
            </form>

            <nav
              className="inline-flex min-h-12 max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm"
              aria-label="Page status filters"
            >
              {filters.map((filter) => (
                <Link
                  key={filter.value}
                  href={adminPagesHref({
                    status: filter.value,
                    q: searchQuery,
                    sort,
                    perPage: pageSize,
                  })}
                  aria-current={active === filter.value ? "page" : undefined}
                  className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    active === filter.value
                      ? "bg-[#f4f8ff] text-[#0b63f6] shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <details className="group relative">
              <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
                {sortLabels[sort]}
                <span
                  className="text-slate-500 transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  <PageChevron />
                </span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {Object.entries(sortLabels).map(([value, label]) => (
                  <Link
                    key={value}
                    href={adminPagesHref({
                      status: active,
                      q: searchQuery,
                      sort: value as SortKey,
                      perPage: pageSize,
                    })}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                    aria-current={sort === value ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </details>

            <details className="group relative">
              <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
                <span aria-hidden="true">
                  <PageIcon icon="filter" />
                </span>
                Filters
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg">
                <p className="font-semibold text-slate-950">Status</p>
                <div className="mt-2 grid gap-1">
                  {filters.map((filter) => (
                    <Link
                      key={filter.value}
                      href={adminPagesHref({
                        status: filter.value,
                        q: searchQuery,
                        sort,
                        perPage: pageSize,
                      })}
                      className="rounded-md px-2 py-1.5 font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                      aria-current={
                        active === filter.value ? "page" : undefined
                      }
                    >
                      {filter.label}
                    </Link>
                  ))}
                </div>
              </div>
            </details>

            <details className="group relative">
              <summary
                className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                aria-label="Table view options"
              >
                <span aria-hidden="true">
                  <PageIcon icon="list" />
                </span>
                <span
                  className="text-slate-500 transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  <PageChevron />
                </span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <span className="block rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-950">
                  Table view
                </span>
              </div>
            </details>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Showing {filteredPages.length} resource{" "}
          {filteredPages.length === 1 ? "page" : "pages"}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {visiblePages.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No resource pages found
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the search or status filters, or create a new resource page
              draft.
            </p>
            <Link
              href="/admin/pages/new"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-[#0b63f6] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span aria-hidden="true">
                <PageIcon icon="plus" />
              </span>
              New resource page
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-7 py-4">Title</th>
                  <th className="px-5 py-4">Keyword</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Updated</th>
                  <th className="px-5 py-4">Published</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visiblePages.map((page, index) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    isFirst={index === 0}
                    returnTo={returnTo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <p>
            {displayStart}-{displayEnd} of {filteredPages.length}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500">Rows per page</span>
            <nav
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((option) => (
                <Link
                  key={option}
                  href={adminPagesHref({
                    status: active,
                    q: searchQuery,
                    sort,
                    perPage: option,
                  })}
                  aria-current={pageSize === option ? "page" : undefined}
                  className={`flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    pageSize === option
                      ? "bg-[#f4f8ff] text-[#0b63f6] shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {option}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="flex items-center justify-between gap-5 sm:justify-end">
          <div className="hidden items-center gap-5 sm:flex">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {pageCounts.published} live pages
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              {pageCounts.archived} archived
            </span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <PaginationLink
              label="Previous page"
              disabled={currentPage <= 1}
              href={adminPagesHref({
                status: active,
                q: searchQuery,
                sort,
                page: currentPage - 1,
                perPage: pageSize,
              })}
            />
            <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-[#0b63f6] bg-white px-3 font-semibold text-[#0b63f6]">
              {currentPage}
            </span>
            <PaginationLink
              label="Next page"
              disabled={currentPage >= totalPages}
              href={adminPagesHref({
                status: active,
                q: searchQuery,
                sort,
                page: currentPage + 1,
                perPage: pageSize,
              })}
              next
            />
          </nav>
        </div>
      </div>
    </AdminShell>
  );
}

function MetricPanel({
  icon,
  tone,
  label,
  value,
  caption,
}: {
  icon: PageIconName;
  tone: "amber" | "blue" | "green" | "slate";
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-5 px-6 py-5">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${metricToneClass(
          tone,
        )}`}
        aria-hidden="true"
      >
        <PageIcon icon={icon} />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
          {value}
        </p>
        <p className="text-sm text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

function PageRow({
  page,
  isFirst,
  returnTo,
}: {
  page: Tables<"seo_pages">;
  isFirst: boolean;
  returnTo: string;
}) {
  return (
    <tr className="align-middle transition hover:bg-slate-50">
      <td
        className={`px-7 py-4 ${
          isFirst ? "border-l-4 border-[#0b63f6]" : "border-l-4 border-white"
        }`}
      >
        <Link
          href={`/admin/pages/${page.id}`}
          className="font-semibold text-slate-950 hover:text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          {page.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-slate-500">
          /resources/{page.slug}
        </p>
      </td>
      <td className="px-5 py-4 text-slate-700">{page.target_keyword || "-"}</td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
            page.status,
          )}`}
        >
          {formatStatus(page.status)}
        </span>
      </td>
      <td className="px-5 py-4 text-slate-700">
        {formatDate(page.updated_at)}
      </td>
      <td className="px-5 py-4 text-slate-700">
        {page.published_at ? formatDate(page.published_at) : "-"}
      </td>
      <td className="px-5 py-4 text-right">
        <PageActionsMenu page={page} returnTo={returnTo} />
      </td>
    </tr>
  );
}

function PageActionsMenu({
  page,
  returnTo,
}: {
  page: Tables<"seo_pages">;
  returnTo: string;
}) {
  const isPublished = page.status === "published";
  const isDraft = page.status === "draft";
  const isArchived = page.status === "archived";

  return (
    <details className="group relative inline-block text-left">
      <summary
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        aria-label={`Open actions for ${page.title}`}
      >
        <PageIcon icon="more" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg">
        <Link
          href={`/admin/pages/${page.id}`}
          className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          Edit page
        </Link>
        {isPublished ? (
          <Link
            href={`/resources/${page.slug}`}
            className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
          >
            View live page
          </Link>
        ) : null}
        <div className="my-1 border-t border-slate-100" />
        {!isPublished ? (
          <PageActionForm
            action={publishSeoPageFromList}
            pageId={page.id}
            returnTo={returnTo}
            label="Publish page"
          />
        ) : null}
        {!isDraft ? (
          <PageActionForm
            action={moveSeoPageToDraftFromList}
            pageId={page.id}
            returnTo={returnTo}
            label="Move to draft"
          />
        ) : null}
        {!isArchived ? (
          <PageActionForm
            action={archiveSeoPageFromList}
            pageId={page.id}
            returnTo={returnTo}
            label="Archive page"
            tone="danger"
          />
        ) : null}
      </div>
    </details>
  );
}

function PageActionForm({
  action,
  pageId,
  returnTo,
  label,
  tone = "default",
}: {
  action: (formData: FormData) => Promise<void>;
  pageId: string;
  returnTo: string;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={pageId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
          tone === "danger"
            ? "text-red-700 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function PaginationLink({
  href,
  label,
  disabled,
  next = false,
}: {
  href: string;
  label: string;
  disabled: boolean;
  next?: boolean;
}) {
  const icon = (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={next ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"}
      />
    </svg>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300"
      >
        {icon}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
    >
      {icon}
    </Link>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): StatusFilter {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return "all";
}

function normalizeSearch(value: string | undefined) {
  return value?.trim().slice(0, 120) ?? "";
}

function normalizeSort(value: string | undefined): SortKey {
  if (value === "updated-asc" || value === "title-asc") return value;
  return "updated-desc";
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizePageSize(value: string | undefined): PageSize {
  const pageSize = Number.parseInt(value ?? String(defaultPageSize), 10);
  return pageSizeOptions.includes(pageSize as PageSize)
    ? (pageSize as PageSize)
    : defaultPageSize;
}

function filterPages(
  pages: Tables<"seo_pages">[],
  status: StatusFilter,
  searchQuery: string,
) {
  const query = searchQuery.toLowerCase();
  return pages.filter((page) => {
    const matchesStatus = status === "all" || page.status === status;
    if (!matchesStatus) return false;
    if (!query) return true;

    return [
      page.title,
      page.slug,
      `/resources/${page.slug}`,
      page.target_keyword ?? "",
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function sortPages(pages: Tables<"seo_pages">[], sort: SortKey) {
  const next = [...pages];
  if (sort === "title-asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  return next.sort((a, b) => {
    const left = new Date(a.updated_at).getTime();
    const right = new Date(b.updated_at).getTime();
    return sort === "updated-asc" ? left - right : right - left;
  });
}

function adminPagesHref({
  status,
  q,
  sort,
  page,
  perPage,
}: {
  status: StatusFilter;
  q?: string;
  sort?: SortKey;
  page?: number;
  perPage?: PageSize;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  if (sort && sort !== "updated-desc") params.set("sort", sort);
  if (perPage && perPage !== defaultPageSize) {
    params.set("perPage", String(perPage));
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/pages?${query}` : "/admin/pages";
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

function metricToneClass(tone: "amber" | "blue" | "green" | "slate") {
  if (tone === "amber") return "bg-amber-100 text-amber-600";
  if (tone === "green") return "bg-emerald-100 text-emerald-600";
  if (tone === "slate") return "bg-slate-100 text-slate-600";
  return "bg-[#e9f1ff] text-[#0b63f6]";
}

function statusClass(status: string) {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PageChevron() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

type PageIconName =
  | "archive"
  | "check"
  | "file"
  | "filter"
  | "layers"
  | "list"
  | "more"
  | "pencil"
  | "plus"
  | "search";

function PageIcon({ icon }: { icon: PageIconName }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.9,
    className: "h-5 w-5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M6 7v11h12V7" />
          <path d="M9 11h6" />
          <path d="M7 4h10l1 3H6l1-3Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          <path d="m8.8 12.2 2 2 4.4-4.6" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 12h5" />
          <path d="M10 16h4" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          <path d="m14 7 3 3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path d="m21 21-4.3-4.3" />
          <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
        </svg>
      );
  }
}
