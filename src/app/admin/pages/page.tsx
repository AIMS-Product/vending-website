import type { Metadata } from "next";
import Link from "next/link";
import {
  archiveSeoPageFromList,
  duplicateSeoPageFromList,
  moveSeoPageToDraftFromList,
  publishSeoPageFromList,
} from "@/app/admin/pages/actions";
import { AdminPaginationLink } from "@/components/admin/AdminPaginationLink";
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
import { adminListSeoPages } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import {
  dotToneClass,
  pageStatusDotTone,
  pageStatusLabel,
  pageStatusLegend,
  readinessDotTone,
  readinessLegend,
  type StatusDotTone,
  type StatusLegendEntry,
} from "@/app/admin/pages/seo-pages-status-labels";
import type { Tables } from "@/types/database";

export const metadata: Metadata = {
  title: "SEO pages admin",
  robots: { index: false, follow: false },
};

type SeoPagesListState = ReturnType<typeof buildSeoPageListState>;
type SeoPageWorkflowView = SeoPagesListState["view"];

const workflowFilters: Array<{
  value: SeoPageWorkflowView;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "All metadata",
    description: "Every page in this list",
  },
  {
    value: "needs-review",
    label: "Needs review",
    description: "Pages whose review date has passed",
  },
  {
    value: "updating",
    label: "Updating",
    description: "Pages with unpublished draft changes",
  },
  {
    value: "orphaned",
    label: "Needs links",
    description: "Pages with no internal links pointing to them",
  },
  {
    value: "metadata-issues",
    label: "Metadata issues",
    description: "Pages missing SEO title, description, or other metadata",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Pages queued to publish automatically at a set time",
  },
  {
    value: "schedule-failed",
    label: "Schedule failed",
    description:
      "Pages whose scheduled publish did not go through and need attention",
  },
];

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
  const listState = buildSeoPageListState(allPages, listParams);

  return (
    <AdminShell
      activeSection="pages"
      title="SEO pages"
      description="Manage structured SEO pages with the same CMS shell ready for resource content."
      userEmail={user.email}
      userRole={role}
      actions={<AdminPagesActions />}
    >
      <SeoPagesAdminSurface state={listState} />
    </AdminShell>
  );
}

function AdminPagesActions() {
  return (
    <div className="flex w-full flex-wrap gap-2">
      <Link href="/admin/pages/redirects" className={adminSecondaryButtonClass}>
        Redirects
      </Link>
      <Link
        href="/admin/pages/new"
        className={`${adminPrimaryButtonClass} flex-1`}
      >
        <span aria-hidden="true">
          <PageIcon icon="plus" />
        </span>
        Create page
      </Link>
    </div>
  );
}

function SeoPagesAdminSurface({ state }: { state: SeoPagesListState }) {
  return (
    <>
      <SeoPagesSummary state={state} />
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <SeoPagesToolbar state={state} />
        <SeoPagesResults state={state} />
        <SeoPagesFooter state={state} />
      </section>
    </>
  );
}

function SeoPagesSummary({ state }: { state: SeoPagesListState }) {
  const { pageCounts, perPage, q: searchQuery, sort, status, view } = state;

  return (
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
            view,
            q: searchQuery,
            sort,
            perPage,
          })}
          active={status === "active"}
        />
        <MetricPanel
          icon="pencil"
          tone="amber"
          label="Drafts"
          value={pageCounts.draft}
          caption="needs work"
          href={adminPagesHref({
            status: "draft",
            view,
            q: searchQuery,
            sort,
            perPage,
          })}
          active={status === "draft"}
        />
        <MetricPanel
          icon="check"
          tone="green"
          label="Published"
          value={pageCounts.published}
          caption="publicly visible"
          href={adminPagesHref({
            status: "published",
            view,
            q: searchQuery,
            sort,
            perPage,
          })}
          active={status === "published"}
        />
        <MetricPanel
          icon="archive"
          tone="slate"
          label="Archived"
          value={pageCounts.archived}
          caption="retired"
          href={adminPagesHref({
            status: "archived",
            view,
            q: searchQuery,
            sort,
            perPage,
          })}
          active={status === "archived"}
        />
      </div>
    </section>
  );
}

function SeoPagesToolbar({ state }: { state: SeoPagesListState }) {
  return (
    <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <SeoPagesSearchForm state={state} />
          <SeoPagesStatusFilters state={state} />
        </div>
        <SeoPagesSortMenu state={state} />
      </div>
      <SeoPagesWorkflowFilters state={state} />
      <SeoPagesResultCount state={state} />
    </div>
  );
}

function SeoPagesSearchForm({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view } = state;

  return (
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
      {status !== "active" ? (
        <input type="hidden" name="status" value={status} />
      ) : null}
      {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
      {sort !== "updated-desc" ? (
        <input type="hidden" name="sort" value={sort} />
      ) : null}
      {perPage !== defaultSeoPageSize ? (
        <input type="hidden" name="perPage" value={perPage} />
      ) : null}
      {searchQuery ? (
        <Link
          href={adminPagesHref({
            status,
            view,
            sort,
            perPage,
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
  );
}

function SeoPagesStatusFilters({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view } = state;

  return (
    <nav
      className="inline-flex min-h-12 max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm"
      aria-label="Page status filters"
    >
      {seoPageFilters.map((filter) => (
        <Link
          key={filter.value}
          href={adminPagesHref({
            status: filter.value,
            view,
            q: searchQuery,
            sort,
            perPage,
          })}
          aria-current={status === filter.value ? "page" : undefined}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
            status === filter.value
              ? "bg-[#f4f8ff] text-[#0b63f6] shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

function SeoPagesSortMenu({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view } = state;

  return (
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
              status,
              view,
              q: searchQuery,
              sort: value as keyof typeof seoPageSortLabels,
              perPage,
            })}
            className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
            aria-current={sort === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </div>
    </details>
  );
}

function SeoPagesWorkflowFilters({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view: activeView } = state;
  const activeFilter = workflowFilters.find(
    (filter) => filter.value === activeView,
  );

  return (
    <>
      <nav
        className="mt-4 flex max-w-full flex-wrap gap-2"
        aria-label="Workflow filters"
      >
        {workflowFilters.map((filter) => (
          <Link
            key={filter.value}
            href={adminPagesHref({
              status,
              view: filter.value,
              q: searchQuery,
              sort,
              perPage,
            })}
            aria-current={activeView === filter.value ? "page" : undefined}
            title={filter.description}
            className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
              activeView === filter.value
                ? "border-[#0b63f6] bg-[#f4f8ff] text-[#0b63f6]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      {activeFilter && activeFilter.value !== "all" ? (
        <p className="mt-2 text-xs text-slate-500">
          {activeFilter.description}
        </p>
      ) : null}
    </>
  );
}

function SeoPagesResultCount({ state }: { state: SeoPagesListState }) {
  const { filteredPages, status } = state;

  return (
    <p className="mt-3 text-sm text-slate-600">
      Showing {filteredPages.length} SEO{" "}
      {filteredPages.length === 1 ? "page" : "pages"}
      {status === "active" ? " in active pages" : ""}
    </p>
  );
}

function SeoPagesResults({ state }: { state: SeoPagesListState }) {
  if (state.visiblePages.length === 0) {
    return <SeoPagesEmptyState state={state} />;
  }

  return (
    <>
      <StatusLegend />
      <div className="grid gap-3 p-4 md:hidden">
        {state.visiblePages.map((page) => (
          <PageMobileCard key={page.id} page={page} returnTo={state.returnTo} />
        ))}
      </div>
      <SeoPagesDesktopTable
        pages={state.visiblePages}
        returnTo={state.returnTo}
      />
    </>
  );
}

function SeoPagesEmptyState({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view } = state;

  return (
    <div className="p-10 text-center">
      <h2 className="text-lg font-semibold text-slate-950">
        {searchQuery ? "No matching SEO pages" : "No SEO pages found"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {searchQuery
          ? "Clear the search or change the status tab to broaden the list."
          : "Create a new SEO page draft to start building content."}
      </p>
      <div className="mt-5 flex w-full justify-center gap-3">
        {searchQuery ? (
          <Link
            href={adminPagesHref({
              status,
              view,
              sort,
              perPage,
            })}
            className={adminSecondaryButtonClass}
          >
            Clear search
          </Link>
        ) : null}
        <Link
          href="/admin/pages/new"
          className={`${adminPrimaryButtonClass} w-full`}
        >
          <span aria-hidden="true">
            <PageIcon icon="plus" />
          </span>
          Create page
        </Link>
      </div>
    </div>
  );
}

function SeoPagesDesktopTable({
  pages,
  returnTo,
}: {
  pages: Tables<"seo_pages">[];
  returnTo: string;
}) {
  return (
    <div className="hidden min-h-[28rem] overflow-x-auto md:block">
      <table className="w-full min-w-[880px] table-fixed border-collapse text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
          <tr>
            <th className="w-[44%] px-7 py-4">Title</th>
            <th className="w-[22%] px-5 py-4">Keyword</th>
            <th className="w-[12%] px-5 py-4 text-center">Readiness</th>
            <th className="w-[10%] px-5 py-4 text-center">Status</th>
            <th className="w-[12%] px-5 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {pages.map((page) => (
            <PageRow key={page.id} page={page} returnTo={returnTo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeoPagesFooter({ state }: { state: SeoPagesListState }) {
  return (
    <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        {state.totalPages > 1 ? <p>{state.resultRangeLabel}</p> : null}
        {state.showRowsPerPage ? <RowsPerPageControl state={state} /> : null}
      </div>
      <div className="flex items-center justify-between gap-5 sm:justify-end">
        <SeoPagesFooterCounts state={state} />
        {state.totalPages > 1 ? <SeoPagesPagination state={state} /> : null}
      </div>
    </div>
  );
}

function RowsPerPageControl({ state }: { state: SeoPagesListState }) {
  const { perPage, q: searchQuery, sort, status, view } = state;

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-slate-500">Rows per page</span>
      <nav
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm"
        aria-label="Rows per page"
      >
        {seoPageSizeOptions.map((option) => (
          <Link
            key={option}
            href={adminPagesHref({
              status,
              view,
              q: searchQuery,
              sort,
              perPage: option,
            })}
            aria-current={perPage === option ? "page" : undefined}
            className={`flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
              perPage === option
                ? "bg-[#f4f8ff] text-[#0b63f6] shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            {option}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function SeoPagesFooterCounts({ state }: { state: SeoPagesListState }) {
  return (
    <div className="hidden items-center gap-5 sm:flex">
      <span className="inline-flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500" />
        {state.pageCounts.published} published
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="size-2 rounded-full bg-amber-400" />
        {state.pageCounts.draft} drafts
      </span>
    </div>
  );
}

function SeoPagesPagination({ state }: { state: SeoPagesListState }) {
  const {
    currentPage,
    paginationPages,
    perPage,
    q: searchQuery,
    sort,
    status,
    totalPages,
    view,
  } = state;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-500">
        Page {currentPage} of {totalPages}
      </span>
      <nav className="flex items-center gap-2" aria-label="Pagination">
        <AdminPaginationLink
          label="Previous page"
          disabled={currentPage <= 1}
          href={adminPagesHref({
            status,
            view,
            q: searchQuery,
            sort,
            page: currentPage - 1,
            perPage,
          })}
        />
        {paginationPages.map((pageNumber) => (
          <PaginationNumber
            key={pageNumber}
            pageNumber={pageNumber}
            current={pageNumber === currentPage}
            href={adminPagesHref({
              status,
              view,
              q: searchQuery,
              sort,
              page: pageNumber,
              perPage,
            })}
          />
        ))}
        <AdminPaginationLink
          label="Next page"
          disabled={currentPage >= totalPages}
          href={adminPagesHref({
            status,
            view,
            q: searchQuery,
            sort,
            page: currentPage + 1,
            perPage,
          })}
          next
        />
      </nav>
    </div>
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
    <tr className="align-middle transition focus-within:bg-slate-50 hover:bg-slate-50 [&:has(details[open])]:relative [&:has(details[open])]:z-20 [&:has(details[open])]:bg-[#f8fbff]">
      <td className="border-l-4 border-transparent px-7 py-4">
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
      <td className="px-5 py-4 break-words text-slate-700">
        {page.target_keyword || "-"}
      </td>
      <td className="px-5 py-4 text-center">
        <StatusBadge
          accessibleLabel={`SEO readiness: ${readiness.label}`}
          label={readiness.label}
          tone={readinessDotTone(readiness.status)}
          align="center"
        />
      </td>
      <td className="px-5 py-4 text-center">
        <StatusBadge
          accessibleLabel={`Page status: ${pageStatusLabel(page.status)}`}
          label={pageStatusLabel(page.status)}
          tone={pageStatusDotTone(page.status)}
          align="center"
        />
      </td>
      <td className="px-5 py-4 text-right">
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

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusBadge
          accessibleLabel={`SEO readiness: ${readiness.label}`}
          label={readiness.label}
          tone={readinessDotTone(readiness.status)}
        />
        <StatusBadge
          accessibleLabel={`Page status: ${pageStatusLabel(page.status)}`}
          label={pageStatusLabel(page.status)}
          tone={pageStatusDotTone(page.status)}
        />
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <div>
          <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Keyword
          </dt>
          <dd className="mt-1 text-slate-800">{page.target_keyword || "-"}</dd>
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
    "absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg";

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

// N7 / issue I7: a status dot paired with a visible text label so the state is
// readable at a glance without decoding colour. `accessibleLabel` keeps the
// fuller "Page status: Published" name for assistive tech; `label` is the
// short word shown next to the dot.
function StatusBadge({
  accessibleLabel,
  label,
  tone,
  align = "start",
}: {
  accessibleLabel: string;
  label: string;
  tone: StatusDotTone;
  align?: "start" | "center";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-semibold text-slate-700 ${
        align === "center" ? "justify-center" : ""
      }`}
      aria-label={accessibleLabel}
    >
      <span
        className={`size-2.5 shrink-0 rounded-full ${dotToneClass(tone)}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function StatusLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 sm:px-5"
      aria-label="Status and readiness legend"
    >
      <LegendGroup title="Status" entries={pageStatusLegend} />
      <span
        aria-hidden="true"
        className="hidden h-4 w-px bg-slate-200 sm:block"
      />
      <LegendGroup title="Readiness" entries={readinessLegend} />
    </div>
  );
}

function LegendGroup({
  title,
  entries,
}: {
  title: string;
  entries: readonly StatusLegendEntry[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="font-semibold tracking-wider text-slate-500 uppercase">
        {title}
      </span>
      {entries.map((entry) => (
        <span key={entry.label} className="inline-flex items-center gap-1.5">
          <span
            className={`size-2.5 shrink-0 rounded-full ${dotToneClass(
              entry.tone,
            )}`}
            aria-hidden="true"
          />
          <span className="font-medium text-slate-700">{entry.label}</span>
        </span>
      ))}
    </div>
  );
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
