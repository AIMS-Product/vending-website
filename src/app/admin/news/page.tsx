import type { Metadata } from "next";
import Link from "next/link";
import { AdminPaginationLink } from "@/components/admin/AdminPaginationLink";
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
import {
  adminNewsHref,
  buildNewsListState,
  newsFilters,
  newsSortLabels,
  parseNewsListParams,
  type NewsListPost,
  type NewsSearchParams,
  type NewsSortKey,
} from "@/lib/admin/news-list";
import { requireAdmin } from "@/lib/supabase/auth";
import { adminListPosts } from "@/lib/services/news";
import { NewsBulkArchiveControls } from "@/app/admin/news/NewsBulkArchiveControls";
import { archivePostFromList } from "@/app/admin/news/list-actions";
import { AdminPageActionButton } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "News admin",
  robots: { index: false, follow: false },
};

// The list page also reads the redirect params the archive actions append
// (archived=N, failed=M, error=...) so it can surface a result banner.
type AdminNewsSearchParams = NewsSearchParams & {
  archived?: string | string[];
  failed?: string | string[];
  error?: string | string[];
};

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<AdminNewsSearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const listParams = parseNewsListParams(params);
  const bulkArchiveResult = parseBulkArchiveResult(params);

  const allPosts = await adminListPosts();
  const {
    status: active,
    q: searchQuery,
    updatedFrom,
    sort,
    postCounts,
    filteredPosts,
    visiblePosts,
    totalPages,
    currentPage,
    displayStart,
    displayEnd,
  } = buildNewsListState(allPosts, listParams);

  // returnTo keeps the admin on the same filtered view after an archive. It is
  // allowlisted server-side, so this just rebuilds the current list URL.
  const returnTo = adminNewsHref({
    status: active,
    q: searchQuery,
    updatedFrom,
    sort,
    page: currentPage,
  });

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
      <BulkArchiveResultBanner result={bulkArchiveResult} />

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

      <div className="mb-7 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
              placeholder="Search title or slug"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
            />
            {active !== "all" ? (
              <input type="hidden" name="status" value={active} />
            ) : null}
            {sort !== "updated-desc" ? (
              <input type="hidden" name="sort" value={sort} />
            ) : null}
            {updatedFrom ? (
              <input type="hidden" name="updatedFrom" value={updatedFrom} />
            ) : null}
            <button type="submit" className="sr-only">
              Search
            </button>
          </form>

          <nav
            className="inline-flex min-h-12 flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
            aria-label="Post status filters"
          >
            {newsFilters.map((filter) => (
              <Link
                key={filter.value}
                href={adminNewsHref({
                  status: filter.value,
                  q: searchQuery,
                  updatedFrom,
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
          <form
            action="/admin/news"
            className="flex h-12 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm sm:w-auto"
          >
            <label
              className="shrink-0 text-xs font-semibold text-slate-500"
              htmlFor="admin-news-updated-from"
            >
              Updated since
            </label>
            <input
              id="admin-news-updated-from"
              name="updatedFrom"
              type="date"
              defaultValue={updatedFrom}
              className="h-8 min-w-36 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-950 outline-none focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15"
            />
            {active !== "all" ? (
              <input type="hidden" name="status" value={active} />
            ) : null}
            {searchQuery ? (
              <input type="hidden" name="q" value={searchQuery} />
            ) : null}
            {sort !== "updated-desc" ? (
              <input type="hidden" name="sort" value={sort} />
            ) : null}
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
            >
              Apply
            </button>
            {updatedFrom ? (
              <Link
                href={adminNewsHref({
                  status: active,
                  q: searchQuery,
                  sort,
                })}
                className="rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
              >
                Clear
              </Link>
            ) : null}
          </form>

          <details className="group relative">
            <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
              {newsSortLabels[sort]}
              <span
                className="text-slate-500 transition group-open:rotate-180"
                aria-hidden="true"
              >
                <NewsChevron />
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              {Object.entries(newsSortLabels).map(([value, label]) => (
                <Link
                  key={value}
                  href={adminNewsHref({
                    status: active,
                    q: searchQuery,
                    updatedFrom,
                    sort: value as NewsSortKey,
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
                {newsFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminNewsHref({
                      status: filter.value,
                      q: searchQuery,
                      updatedFrom,
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
              Adjust the search, status, or date filters, or create a new draft.
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
          <>
            <NewsBulkArchiveControls returnTo={returnTo} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-7 py-4">Title</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4">Published</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visiblePosts.map((post, index) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      isFirst={index === 0}
                      returnTo={returnTo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
            <AdminPaginationLink
              label="Previous page"
              disabled={currentPage <= 1}
              href={adminNewsHref({
                status: active,
                q: searchQuery,
                updatedFrom,
                sort,
                page: currentPage - 1,
              })}
            />
            <span className="flex h-9 min-w-9 items-center justify-center rounded-md border border-[#0b63f6] bg-white px-3 font-semibold text-[#0b63f6]">
              {currentPage}
            </span>
            <AdminPaginationLink
              label="Next page"
              disabled={currentPage >= totalPages}
              href={adminNewsHref({
                status: active,
                q: searchQuery,
                updatedFrom,
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

function PostRow({
  post,
  isFirst,
  returnTo,
}: {
  post: NewsListPost;
  isFirst: boolean;
  returnTo: string;
}) {
  return (
    <tr className="align-middle transition hover:bg-slate-50 [&:has(details[open])]:relative [&:has(details[open])]:z-20 [&:has(details[open])]:bg-[#f8fbff]">
      <td
        className={`px-7 py-4 ${
          isFirst ? "border-l-4 border-[#0b63f6]" : "border-l-4 border-white"
        }`}
      >
        <div className="flex items-start gap-3">
          {post.status !== "archived" ? (
            <input
              type="checkbox"
              name="ids"
              value={post.id}
              form="news-bulk-archive-form"
              aria-label={`Select ${post.title} for bulk actions`}
              className="mt-1 size-4 shrink-0 rounded border-slate-300 text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
            />
          ) : null}
          <div className="min-w-0">
            <Link
              href={`/admin/news/${post.id}`}
              className="font-semibold text-slate-950 hover:text-[#0b63f6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
            >
              {post.title}
            </Link>
            <p className="mt-1 font-mono text-xs text-slate-500">
              /{post.slug}
            </p>
          </div>
        </div>
      </td>
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
        <PostActionsMenu post={post} returnTo={returnTo} />
      </td>
    </tr>
  );
}

function PostActionsMenu({
  post,
  returnTo,
}: {
  post: NewsListPost;
  returnTo: string;
}) {
  const isArchived = post.status === "archived";

  return (
    <details className="group relative inline-block shrink-0 text-left">
      <summary
        className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-slate-700 transition group-open:bg-[#eef5ff] group-open:text-[#0b63f6] hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        aria-label={`Open actions for ${post.title}`}
      >
        <AdminIcon icon="more" />
      </summary>
      <div className="absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg">
        <Link
          href={`/admin/news/${post.id}`}
          className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          Edit post
        </Link>
        {!isArchived ? (
          <>
            <div className="my-1 border-t border-slate-100" />
            <form action={archivePostFromList}>
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <AdminPageActionButton
                label="Archive post"
                tone="danger"
                confirmMessage={`Archive "${post.title}"? This removes it from the active post list. You can restore it later from the Archived filter.`}
              />
            </form>
          </>
        ) : null}
      </div>
    </details>
  );
}

type BulkArchiveResult =
  | { kind: "success"; archived: number }
  | { kind: "partial"; archived: number; failed: number }
  | { kind: "error" }
  | null;

// The archive actions redirect back here with `archived=N` (+ `failed=M` on
// partial failure) or `error=bulk-archive` when nothing was archived.
function parseBulkArchiveResult(
  params: AdminNewsSearchParams,
): BulkArchiveResult {
  if (firstParam(params.error) === "bulk-archive") return { kind: "error" };

  const archived = parseCountParam(params.archived);
  if (archived === null) return null;

  const failed = parseCountParam(params.failed);
  if (failed !== null) return { kind: "partial", archived, failed };
  return { kind: "success", archived };
}

function parseCountParam(value: string | string[] | undefined): number | null {
  const parsed = Number(firstParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function BulkArchiveResultBanner({ result }: { result: BulkArchiveResult }) {
  if (!result) return null;

  if (result.kind === "error") {
    return (
      <p
        role="alert"
        className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
      >
        Could not archive the selected posts. Check the logs and try again.
      </p>
    );
  }

  if (result.kind === "partial") {
    return (
      <p
        role="alert"
        className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
      >
        Archived {result.archived} {result.archived === 1 ? "post" : "posts"} —{" "}
        {result.failed} failed, check logs.
      </p>
    );
  }

  return (
    <p
      role="status"
      className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
    >
      Archived {result.archived} {result.archived === 1 ? "post" : "posts"}.
    </p>
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
