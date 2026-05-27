import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { requireAdmin } from "@/lib/supabase/auth";
import { adminListPosts, type NewsPost } from "@/lib/services/news";

export const metadata: Metadata = {
  title: "News admin",
  robots: { index: false, follow: false },
};

type SearchParams = {
  status?: string | string[];
  q?: string | string[];
  sort?: string | string[];
  page?: string | string[];
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

const pageSize = 7;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const active = normalizeStatus(firstParam(params.status));
  const searchQuery = normalizeSearch(firstParam(params.q));
  const sort = normalizeSort(firstParam(params.sort));
  const requestedPage = normalizePage(firstParam(params.page));

  const allPosts = await adminListPosts();
  const postCounts = countPostsByStatus(allPosts);
  const filteredPosts = sortPosts(
    filterPosts(allPosts, active, searchQuery),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visiblePosts = filteredPosts.slice(pageStart, pageStart + pageSize);
  const displayStart = filteredPosts.length === 0 ? 0 : pageStart + 1;
  const displayEnd = Math.min(pageStart + pageSize, filteredPosts.length);

  return (
    <AdminShell
      activeSection="posts"
      eyebrow="Blog CMS"
      title="Blog and news"
      description="Create and manage articles from the same admin shell used for resource pages, landing pages, campaigns, and other content types."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/pages" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="file" />
            </span>
            Resource pages
          </Link>
          <Link href="/admin/news/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New blog post
          </Link>
        </>
      }
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="newspaper"
          tone="blue"
          label="Total"
          value={allPosts.length}
          caption="all posts"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Drafts"
          value={postCounts.draft}
          caption="needs work"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Published"
          value={postCounts.published}
          caption="live"
        />
        <AdminMetricPanel
          icon="archive"
          tone="slate"
          label="Archived"
          value={postCounts.archived}
          caption="retired"
        />
      </AdminMetricStrip>

      <div className="mb-7 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form
            action="/admin/news"
            className="flex h-12 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm lg:w-80"
          >
            <span className="text-slate-500" aria-hidden="true">
              <AdminIcon icon="search" />
            </span>
            <label className="sr-only" htmlFor="admin-news-search">
              Search blog posts
            </label>
            <input
              id="admin-news-search"
              name="q"
              aria-label="Search blog posts"
              defaultValue={searchQuery}
              placeholder="Search title, slug, or author"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
            />
            {active !== "all" ? (
              <input type="hidden" name="status" value={active} />
            ) : null}
            {sort !== "updated-desc" ? (
              <input type="hidden" name="sort" value={sort} />
            ) : null}
            <button type="submit" className="sr-only">
              Search
            </button>
          </form>

          <nav
            className="inline-flex h-12 flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
            aria-label="Post status filters"
          >
            {filters.map((filter) => (
              <Link
                key={filter.value}
                href={adminNewsHref({
                  status: filter.value,
                  q: searchQuery,
                  sort,
                })}
                aria-current={active === filter.value ? "page" : undefined}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
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
                <NewsChevron />
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              {Object.entries(sortLabels).map(([value, label]) => (
                <Link
                  key={value}
                  href={adminNewsHref({
                    status: active,
                    q: searchQuery,
                    sort: value as SortKey,
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
                <AdminIcon icon="filter" />
              </span>
              Filters
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg">
              <p className="font-semibold text-slate-950">Status</p>
              <div className="mt-2 grid gap-1">
                {filters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminNewsHref({
                      status: filter.value,
                      q: searchQuery,
                      sort,
                    })}
                    className="rounded-md px-2 py-1.5 font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                    aria-current={active === filter.value ? "page" : undefined}
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
                <AdminIcon icon="list" />
              </span>
              <span
                className="text-slate-500 transition group-open:rotate-180"
                aria-hidden="true"
              >
                <NewsChevron />
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <span className="block rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-950">
                Table view
              </span>
            </div>
          </details>

          <p className="text-sm text-slate-600">
            Showing {filteredPosts.length} blog{" "}
            {filteredPosts.length === 1 ? "post" : "posts"}
          </p>
        </div>
      </div>

      <div className={adminPanelClass}>
        {visiblePosts.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No blog posts found
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Adjust the search or status filters, or create a new draft.
            </p>
            <Link
              href="/admin/news/new"
              className={`${adminPrimaryButtonClass} mt-5`}
            >
              <span aria-hidden="true">
                <AdminIcon icon="plus" />
              </span>
              New blog post
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-7 py-4">Title</th>
                  <th className="px-5 py-4">Author</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Updated</th>
                  <th className="px-5 py-4">Published</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visiblePosts.map((post, index) => (
                  <PostRow key={post.id} post={post} isFirst={index === 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <p>
          {displayStart}-{displayEnd} of {filteredPosts.length}
        </p>
        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-5 sm:flex">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              {postCounts.published} live posts
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-slate-300" />
              {postCounts.archived} archived
            </span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <PaginationLink
              label="Previous page"
              disabled={currentPage <= 1}
              href={adminNewsHref({
                status: active,
                q: searchQuery,
                sort,
                page: currentPage - 1,
              })}
            />
            <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-[#0b63f6] bg-white px-3 font-semibold text-[#0b63f6]">
              {currentPage}
            </span>
            <PaginationLink
              label="Next page"
              disabled={currentPage >= totalPages}
              href={adminNewsHref({
                status: active,
                q: searchQuery,
                sort,
                page: currentPage + 1,
              })}
              next
            />
          </nav>
        </div>
      </div>
    </AdminShell>
  );
}

function PostRow({ post, isFirst }: { post: NewsPost; isFirst: boolean }) {
  return (
    <tr className="align-middle transition hover:bg-slate-50">
      <td
        className={`px-7 py-4 ${
          isFirst ? "border-l-4 border-[#0b63f6]" : "border-l-4 border-white"
        }`}
      >
        <Link
          href={`/admin/news/${post.id}`}
          className="font-semibold text-slate-950 hover:text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          {post.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-slate-500">/{post.slug}</p>
      </td>
      <td className="px-5 py-4 text-slate-700">{post.author}</td>
      <td className="px-5 py-4">
        <AdminStatusBadge status={post.status} />
      </td>
      <td className="px-5 py-4 text-slate-700">
        {formatDate(post.updated_at)}
      </td>
      <td className="px-5 py-4 text-slate-700">
        {post.published_at ? formatDate(post.published_at) : "-"}
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/admin/news/${post.id}`}
          aria-label={`Edit ${post.title}`}
          className="inline-flex size-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          <AdminIcon icon="more" />
        </Link>
      </td>
    </tr>
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
      className="size-4"
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
        className="flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300"
      >
        {icon}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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

function filterPosts(
  posts: NewsPost[],
  status: StatusFilter,
  searchQuery: string,
) {
  const query = searchQuery.toLowerCase();
  return posts.filter((post) => {
    const matchesStatus = status === "all" || post.status === status;
    if (!matchesStatus) return false;
    if (!query) return true;

    return [post.title, post.slug, post.excerpt, post.author]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query));
  });
}

function sortPosts(posts: NewsPost[], sort: SortKey) {
  const next = [...posts];
  if (sort === "title-asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  return next.sort((a, b) => {
    const left = new Date(a.updated_at).getTime();
    const right = new Date(b.updated_at).getTime();
    return sort === "updated-asc" ? left - right : right - left;
  });
}

function adminNewsHref({
  status,
  q,
  sort,
  page,
}: {
  status: StatusFilter;
  q?: string;
  sort?: SortKey;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  if (sort && sort !== "updated-desc") params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/news?${query}` : "/admin/news";
}

function countPostsByStatus(posts: NewsPost[]) {
  return posts.reduce(
    (counts, post) => {
      if (post.status === "draft") counts.draft += 1;
      if (post.status === "published") counts.published += 1;
      if (post.status === "archived") counts.archived += 1;
      return counts;
    },
    { draft: 0, published: 0, archived: 0 },
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NewsChevron() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}
