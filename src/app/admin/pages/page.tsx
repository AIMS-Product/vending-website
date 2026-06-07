import type { Metadata } from "next";
import Link from "next/link";
import {
  archiveSeoPageFromList,
  duplicateSeoPageFromList,
  moveSeoPageToDraftFromList,
  publishSeoPageFromList,
} from "@/app/admin/pages/actions";
import {
  AdminPageActionButton,
  AdminShell,
} from "@/components/admin/AdminShell";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import {
  adminPagesHref,
  buildSeoPageListState,
  defaultSeoPageSize,
  parseSeoPageListParams,
  seoPageFilters,
  seoPageSizeOptions,
  seoPageSortLabels,
  type SeoPageSearchParams,
} from "@/lib/admin/seo-pages-list";
import { assessSeoReadiness } from "@/lib/page-builder/seo-readiness";
import { formatScheduledPublishDisplay } from "@/lib/page-builder/scheduled-publishing";
import { adminListSeoPages } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Tables } from "@/types/database";

export const metadata: Metadata = {
  title: "SEO pages admin",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<SeoPageSearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const listParams = parseSeoPageListParams(params);

  const allPages = await adminListSeoPages();
  const {
    status: active,
    view: activeView,
    q: searchQuery,
    sort,
    perPage: pageSize,
    pageCounts,
    filteredPages,
    visiblePages,
    totalPages,
    currentPage,
    paginationPages,
    showRowsPerPage,
    resultRangeLabel,
    returnTo,
  } = buildSeoPageListState(allPages, listParams);

  return (
    <AdminShell
      activeSection="pages"
      title="SEO pages"
      description="Manage structured SEO pages with the same CMS shell ready for resource content."
      userEmail={user.email}
      userRole={role}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/pages/authors"
            className={adminSecondaryButtonClass}
          >
            Authors
          </Link>
          <Link
            href="/admin/pages/redirects"
            className={adminSecondaryButtonClass}
          >
            Redirects
          </Link>
          <Link href="/admin/pages/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <PageIcon icon="plus" />
            </span>
            New SEO page
          </Link>
        </div>
      }
    >
      <section
        className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
        aria-label="SEO page summary"
      >
        <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          <MetricPanel
            icon="file"
            tone="blue"
            label="All"
            value={pageCounts.active}
            caption="drafts + published"
            href={adminPagesHref({
              status: "active",
              view: activeView,
              q: searchQuery,
              sort,
              perPage: pageSize,
            })}
            active={active === "active"}
          />
          <MetricPanel
            icon="pencil"
            tone="amber"
            label="Drafts"
            value={pageCounts.draft}
            caption="needs work"
            href={adminPagesHref({
              status: "draft",
              view: activeView,
              q: searchQuery,
              sort,
              perPage: pageSize,
            })}
            active={active === "draft"}
          />
          <MetricPanel
            icon="check"
            tone="green"
            label="Published"
            value={pageCounts.published}
            caption="publicly visible"
            href={adminPagesHref({
              status: "published",
              view: activeView,
              q: searchQuery,
              sort,
              perPage: pageSize,
            })}
            active={active === "published"}
          />
          <MetricPanel
            icon="archive"
            tone="slate"
            label="Archived"
            value={pageCounts.archived}
            caption="retired"
            href={adminPagesHref({
              status: "archived",
              view: activeView,
              q: searchQuery,
              sort,
              perPage: pageSize,
            })}
            active={active === "archived"}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <form
                action="/admin/pages"
                method="get"
                className="flex h-12 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm lg:w-[26rem] lg:shrink-0"
              >
                <span className="text-slate-500" aria-hidden="true">
                  <PageIcon icon="search" />
                </span>
                <label className="sr-only" htmlFor="admin-pages-search">
                  Search SEO pages
                </label>
                <input
                  id="admin-pages-search"
                  name="q"
                  aria-label="Search SEO pages"
                  defaultValue={searchQuery}
                  placeholder="Search title, keyword, or URL"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
                />
                {active !== "active" ? (
                  <input type="hidden" name="status" value={active} />
                ) : null}
                {activeView !== "all" ? (
                  <input type="hidden" name="view" value={activeView} />
                ) : null}
                {sort !== "updated-desc" ? (
                  <input type="hidden" name="sort" value={sort} />
                ) : null}
                {pageSize !== defaultSeoPageSize ? (
                  <input type="hidden" name="perPage" value={pageSize} />
                ) : null}
                {searchQuery ? (
                  <Link
                    href={adminPagesHref({
                      status: active,
                      view: activeView,
                      sort,
                      perPage: pageSize,
                    })}
                    className="rounded px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                  >
                    Clear
                  </Link>
                ) : null}
                <button
                  type="submit"
                  className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                >
                  Search
                </button>
              </form>

              <nav
                className="inline-flex min-h-12 max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm"
                aria-label="Page status filters"
              >
                {seoPageFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminPagesHref({
                      status: filter.value,
                      view: activeView,
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

            <details className="group relative w-full sm:w-auto">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none sm:justify-start">
                {seoPageSortLabels[sort]}
                <span
                  className="text-slate-500 transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  <PageChevron />
                </span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {Object.entries(seoPageSortLabels).map(([value, label]) => (
                  <Link
                    key={value}
                    href={adminPagesHref({
                      status: active,
                      view: activeView,
                      q: searchQuery,
                      sort: value as keyof typeof seoPageSortLabels,
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
          </div>
          <nav
            className="mt-4 flex max-w-full flex-wrap gap-2"
            aria-label="Workflow filters"
          >
            {[
              ["all", "All metadata"],
              ["needs-review", "Needs review"],
              ["updating", "Updating"],
              ["orphaned", "Needs links"],
              ["metadata-issues", "Metadata issues"],
              ["scheduled", "Scheduled"],
              ["schedule-failed", "Schedule failed"],
            ].map(([view, label]) => (
              <Link
                key={view}
                href={adminPagesHref({
                  status: active,
                  view: view as typeof activeView,
                  q: searchQuery,
                  sort,
                  perPage: pageSize,
                })}
                aria-current={activeView === view ? "page" : undefined}
                className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                  activeView === view
                    ? "border-[#0b63f6] bg-[#f4f8ff] text-[#0b63f6]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-3 text-sm text-slate-600">
            Showing {filteredPages.length} SEO{" "}
            {filteredPages.length === 1 ? "page" : "pages"}
            {active === "active" ? " in active pages" : ""}
          </p>
        </div>
        {visiblePages.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              {searchQuery ? "No matching SEO pages" : "No SEO pages found"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {searchQuery
                ? "Clear the search or change the status tab to broaden the list."
                : "Create a new SEO page draft to start building content."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {searchQuery ? (
                <Link
                  href={adminPagesHref({
                    status: active,
                    view: activeView,
                    sort,
                    perPage: pageSize,
                  })}
                  className={adminSecondaryButtonClass}
                >
                  Clear search
                </Link>
              ) : null}
              <Link href="/admin/pages/new" className={adminPrimaryButtonClass}>
                <span aria-hidden="true">
                  <PageIcon icon="plus" />
                </span>
                New SEO page
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {visiblePages.map((page) => (
                <PageMobileCard key={page.id} page={page} returnTo={returnTo} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="w-[40%] px-7 py-3">Title</th>
                    <th className="w-[18%] px-5 py-3">Keyword</th>
                    <th className="w-[18%] px-5 py-3">Workflow</th>
                    <th className="w-[10%] px-5 py-3 text-center">Readiness</th>
                    <th className="w-[6%] px-5 py-3 text-center">Status</th>
                    <th className="w-[8%] px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visiblePages.map((page) => (
                    <PageRow key={page.id} page={page} returnTo={returnTo} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            {totalPages > 1 ? <p>{resultRangeLabel}</p> : null}
            {showRowsPerPage ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-500">
                  Rows per page
                </span>
                <nav
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
                  aria-label="Rows per page"
                >
                  {seoPageSizeOptions.map((option) => (
                    <Link
                      key={option}
                      href={adminPagesHref({
                        status: active,
                        view: activeView,
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
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-5 sm:justify-end">
            <div className="hidden items-center gap-5 sm:flex">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                {pageCounts.published} published
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-400" />
                {pageCounts.draft} drafts
              </span>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <nav
                  className="flex items-center gap-2"
                  aria-label="Pagination"
                >
                  <PaginationLink
                    label="Previous page"
                    disabled={currentPage <= 1}
                    href={adminPagesHref({
                      status: active,
                      view: activeView,
                      q: searchQuery,
                      sort,
                      page: currentPage - 1,
                      perPage: pageSize,
                    })}
                  />
                  {paginationPages.map((pageNumber) => (
                    <PaginationNumber
                      key={pageNumber}
                      pageNumber={pageNumber}
                      current={pageNumber === currentPage}
                      href={adminPagesHref({
                        status: active,
                        view: activeView,
                        q: searchQuery,
                        sort,
                        page: pageNumber,
                        perPage: pageSize,
                      })}
                    />
                  ))}
                  <PaginationLink
                    label="Next page"
                    disabled={currentPage >= totalPages}
                    href={adminPagesHref({
                      status: active,
                      view: activeView,
                      q: searchQuery,
                      sort,
                      page: currentPage + 1,
                      perPage: pageSize,
                    })}
                    next
                  />
                </nav>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function MetricPanel({
  icon,
  tone,
  label,
  value,
  caption,
  href,
  active,
}: {
  icon: PageIconName;
  tone: "amber" | "blue" | "green" | "slate";
  label: string;
  value: number;
  caption: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-5 px-6 py-4 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
        active ? "bg-[#fbfdff] shadow-[inset_0_-3px_0_#0b63f6]" : ""
      }`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-md ${metricToneClass(
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
    </Link>
  );
}

function PageRow({
  page,
  returnTo,
}: {
  page: Tables<"seo_pages">;
  returnTo: string;
}) {
  const readiness = assessSeoReadiness(page.draft_content, {
    slug: page.slug,
    title: page.title,
    seoTitle: page.seo_title,
    metaDescription: page.meta_description,
    canonicalUrl: page.canonical_url,
    noindex: page.noindex,
    sitemapEnabled: page.sitemap_enabled,
    targetKeyword: page.target_keyword,
    structuredDataSettings: page.structured_data_settings,
  });

  return (
    <tr className="align-middle transition focus-within:bg-slate-50 hover:bg-slate-50 [&:has(details[open])]:bg-[#f8fbff]">
      <td className="border-l-4 border-transparent px-7 py-3">
        <Link
          href={`/admin/pages/${page.id}`}
          className="block truncate font-semibold text-[#0b63f6] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
          title={page.title}
        >
          {page.title}
        </Link>
        <p
          className="mt-1 max-w-[36rem] truncate font-mono text-xs text-slate-500"
          title={page.route_path}
        >
          {page.route_path}
        </p>
      </td>
      <td className="px-5 py-3 break-words text-slate-700">
        {page.target_keyword || "-"}
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            {formatLifecycle(page.lifecycle_status)}
          </p>
          <p>
            Review:{" "}
            {page.next_review_at
              ? formatShortDate(page.next_review_at)
              : `${page.review_period_months} mo`}
          </p>
          {page.scheduled_publish_status === "scheduled" &&
          page.scheduled_publish_at ? (
            <p>
              Scheduled:{" "}
              {formatScheduledPublishDisplay(page.scheduled_publish_at)}
            </p>
          ) : null}
          {page.scheduled_publish_status === "failed" ? (
            <p className="font-semibold text-rose-700">
              Failed: {page.scheduled_publish_error ?? "Needs reschedule"}
            </p>
          ) : null}
          {page.internal_tags?.length ? (
            <p className="truncate" title={page.internal_tags.join(", ")}>
              {page.internal_tags.slice(0, 2).join(", ")}
            </p>
          ) : (
            <p>Needs links</p>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-center">
        <StatusBadge
          label={`SEO readiness: ${readiness.label}`}
          tone={readinessDotTone(readiness.status)}
          text={readiness.label}
        />
      </td>
      <td className="px-5 py-3 text-center">
        <StatusBadge
          label={`Page status: ${formatStatus(page.status)}`}
          tone={statusDotTone(page.status)}
          text={formatStatus(page.status)}
        />
      </td>
      <td className="px-5 py-3 text-right">
        <PageActionsMenu page={page} returnTo={returnTo} />
      </td>
    </tr>
  );
}

function PageMobileCard({
  page,
  returnTo,
}: {
  page: Tables<"seo_pages">;
  returnTo: string;
}) {
  const readiness = assessSeoReadiness(page.draft_content, {
    slug: page.slug,
    title: page.title,
    seoTitle: page.seo_title,
    metaDescription: page.meta_description,
    canonicalUrl: page.canonical_url,
    noindex: page.noindex,
    sitemapEnabled: page.sitemap_enabled,
    targetKeyword: page.target_keyword,
    structuredDataSettings: page.structured_data_settings,
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/pages/${page.id}`}
            className="text-base font-semibold text-[#0b63f6] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
          >
            {page.title}
          </Link>
          <p
            className="mt-1 truncate font-mono text-xs text-slate-500"
            title={page.route_path}
          >
            {page.route_path}
          </p>
        </div>
        <PageActionsMenu page={page} returnTo={returnTo} variant="card" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          label={`SEO readiness: ${readiness.label}`}
          tone={readinessDotTone(readiness.status)}
          text={readiness.label}
        />
        <StatusBadge
          label={`Page status: ${formatStatus(page.status)}`}
          tone={statusDotTone(page.status)}
          text={formatStatus(page.status)}
        />
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <div>
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Keyword
          </dt>
          <dd className="mt-1 text-slate-800">{page.target_keyword || "-"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Workflow
          </dt>
          <dd className="mt-1">
            <span className="font-semibold text-slate-800">
              {formatLifecycle(page.lifecycle_status)}
            </span>
            <span className="block">
              Review:{" "}
              {page.next_review_at
                ? formatShortDate(page.next_review_at)
                : `${page.review_period_months} mo`}
            </span>
            {page.scheduled_publish_status === "scheduled" &&
            page.scheduled_publish_at ? (
              <span className="block">
                Scheduled:{" "}
                {formatScheduledPublishDisplay(page.scheduled_publish_at)}
              </span>
            ) : null}
            {page.scheduled_publish_status === "failed" ? (
              <span className="block font-semibold text-rose-700">
                Failed: {page.scheduled_publish_error ?? "Needs reschedule"}
              </span>
            ) : null}
            <span className="block">
              {page.internal_tags?.length
                ? page.internal_tags.slice(0, 2).join(", ")
                : "Needs links"}
            </span>
          </dd>
        </div>
      </dl>

      <Link
        href={`/admin/pages/${page.id}`}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
      >
        Edit page
      </Link>
    </article>
  );
}

function formatLifecycle(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function PageActionsMenu({
  page,
  returnTo,
  variant = "icon",
}: {
  page: Tables<"seo_pages">;
  returnTo: string;
  variant?: "icon" | "card";
}) {
  const isPublished = page.status === "published";
  const isDraft = page.status === "draft";
  const isArchived = page.status === "archived";
  const summaryClass =
    variant === "card"
      ? "inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition group-open:bg-[#eef5ff] group-open:text-[#0b63f6] hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      : "inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-slate-700 transition group-open:bg-[#eef5ff] group-open:text-[#0b63f6] hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none [&::-webkit-details-marker]:hidden";
  const menuClass =
    variant === "card"
      ? "absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg"
      : "absolute top-1/2 right-full z-30 mr-2 w-52 -translate-y-1/2 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg";

  return (
    <details className="group relative inline-block shrink-0 text-left">
      <summary
        className={summaryClass}
        aria-label={`Open actions for ${page.title}`}
      >
        <PageIcon icon="more" />
      </summary>
      <div className={menuClass}>
        <Link
          href={`/admin/pages/${page.id}`}
          className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
        >
          Edit page
        </Link>
        {isPublished ? (
          <Link
            href={page.route_path}
            target="_blank"
            rel="noreferrer"
            className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
          >
            View live page
          </Link>
        ) : null}
        <div className="my-1 border-t border-slate-100" />
        <PageActionForm
          action={duplicateSeoPageFromList}
          pageId={page.id}
          returnTo={returnTo}
          label="Duplicate page"
          confirmMessage={`Duplicate "${page.title}" as a draft? The copy will use a temporary draft slug until you edit it.`}
        />
        {!isPublished ? (
          <PageActionForm
            action={publishSeoPageFromList}
            pageId={page.id}
            returnTo={returnTo}
            label="Publish page"
            confirmMessage={`Publish "${page.title}" to the live site? It will be publicly visible at ${page.route_path}.`}
          />
        ) : null}
        {!isDraft ? (
          <PageActionForm
            action={moveSeoPageToDraftFromList}
            pageId={page.id}
            returnTo={returnTo}
            label="Move to draft"
            confirmMessage={
              isPublished
                ? `Unpublish "${page.title}"? It will be removed from the live site and returned to draft.`
                : `Move "${page.title}" back to draft?`
            }
          />
        ) : null}
        {!isArchived ? (
          <>
            <div className="my-1 border-t border-slate-100" />
            <PageActionForm
              action={archiveSeoPageFromList}
              pageId={page.id}
              returnTo={returnTo}
              label="Archive page"
              tone="danger"
              confirmMessage={`Archive "${page.title}"? This removes it from the active page list.`}
            />
          </>
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
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  pageId: string;
  returnTo: string;
  label: string;
  tone?: "default" | "danger";
  confirmMessage?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={pageId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <AdminPageActionButton
        label={label}
        tone={tone}
        confirmMessage={confirmMessage}
      />
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

function PaginationNumber({
  pageNumber,
  current,
  href,
}: {
  pageNumber: number;
  current: boolean;
  href: string;
}) {
  if (current) {
    return (
      <span
        aria-current="page"
        className="flex h-9 min-w-9 items-center justify-center rounded-md border border-[#0b63f6] bg-white px-3 font-semibold text-[#0b63f6]"
      >
        {pageNumber}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
    >
      {pageNumber}
    </Link>
  );
}

function metricToneClass(tone: "amber" | "blue" | "green" | "slate") {
  if (tone === "amber") return "bg-amber-100 text-amber-600";
  if (tone === "green") return "bg-emerald-100 text-emerald-600";
  if (tone === "slate") return "bg-slate-100 text-slate-600";
  return "bg-[#e9f1ff] text-[#0b63f6]";
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type DotTone = "amber" | "blue" | "green" | "red" | "slate";

function StatusBadge({
  label,
  tone,
  text,
}: {
  label: string;
  tone: DotTone;
  text: string;
}) {
  return (
    <span
      aria-label={label}
      className="inline-flex min-h-7 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm"
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${dotToneClass(tone)}`}
      />
      {text}
    </span>
  );
}

function statusDotTone(status: string): DotTone {
  if (status === "published") return "green";
  if (status === "archived") return "slate";
  return "amber";
}

function readinessDotTone(status: string): DotTone {
  if (status === "strong") return "green";
  if (status === "blocked") return "red";
  if (status === "needs_work") return "amber";
  return "blue";
}

function dotToneClass(tone: DotTone) {
  if (tone === "green") {
    return "bg-emerald-500";
  }
  if (tone === "amber") {
    return "bg-amber-400";
  }
  if (tone === "red") {
    return "bg-rose-500";
  }
  if (tone === "slate") {
    return "bg-slate-400";
  }
  return "bg-sky-500";
}

function PageChevron() {
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

const pageIconCommonProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.9,
  className: "size-5",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PageIcon({ icon }: { icon: PageIconName }) {
  switch (icon) {
    case "archive":
      return (
        <svg {...pageIconCommonProps}>
          <path d="M4 7h16" />
          <path d="M6 7v11h12V7" />
          <path d="M9 11h6" />
          <path d="M7 4h10l1 3H6l1-3Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...pageIconCommonProps}>
          <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          <path d="m8.8 12.2 2 2 4.4-4.6" />
        </svg>
      );
    case "file":
      return (
        <svg {...pageIconCommonProps}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 12h5" />
          <path d="M10 16h4" />
        </svg>
      );
    case "filter":
      return (
        <svg {...pageIconCommonProps}>
          <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" />
        </svg>
      );
    case "layers":
      return (
        <svg {...pageIconCommonProps}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );
    case "list":
      return (
        <svg {...pageIconCommonProps}>
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
        <svg {...pageIconCommonProps}>
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...pageIconCommonProps}>
          <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          <path d="m14 7 3 3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...pageIconCommonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...pageIconCommonProps}>
          <path d="m21 21-4.3-4.3" />
          <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
        </svg>
      );
  }
}
