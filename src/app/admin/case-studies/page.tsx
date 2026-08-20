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
  adminCaseStudiesHref,
  buildCaseStudiesListState,
  caseStudyFilters,
  caseStudySortLabels,
  parseCaseStudiesListParams,
  type CaseStudyListItem,
  type CaseStudiesSearchParams,
  type CaseStudySortKey,
} from "@/lib/admin/case-studies-list";
import { requireAdmin } from "@/lib/supabase/auth";
import { adminListCaseStudies } from "@/lib/services/case-studies";
import { CaseStudyBulkArchiveControls } from "@/app/admin/case-studies/CaseStudyBulkArchiveControls";
import { archiveCaseStudyFromList } from "@/app/admin/case-studies/list-actions";
import { AdminPageActionButton } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Case studies admin",
  robots: { index: false, follow: false },
};

// The list page also reads the redirect params the archive actions append
// (archived=N, failed=M, error=...) so it can surface a result banner.
type AdminCaseStudiesSearchParams = CaseStudiesSearchParams & {
  archived?: string | string[];
  failed?: string | string[];
  error?: string | string[];
};

export default async function AdminCaseStudiesPage({
  searchParams,
}: {
  searchParams: Promise<AdminCaseStudiesSearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const listParams = parseCaseStudiesListParams(params);
  const bulkArchiveResult = parseBulkArchiveResult(params);

  const allCaseStudies = await adminListCaseStudies();
  const {
    status: active,
    q: searchQuery,
    updatedFrom,
    sort,
    caseStudyCounts,
    filteredCaseStudies,
    visibleCaseStudies,
    totalPages,
    currentPage,
    displayStart,
    displayEnd,
  } = buildCaseStudiesListState(allCaseStudies, listParams);

  // returnTo keeps the admin on the same filtered view after an archive. It
  // is allowlisted server-side, so this just rebuilds the current list URL.
  const returnTo = adminCaseStudiesHref({
    status: active,
    q: searchQuery,
    updatedFrom,
    sort,
    page: currentPage,
  });

  return (
    <AdminShell
      activeSection="caseStudies"
      eyebrow="Case studies CMS"
      title="Case studies"
      description="Publish member video stories with pull quotes and result figures — the same admin shell used for blog posts and resource pages."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/news" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="book" />
            </span>
            Blog and news
          </Link>
          <Link href="/admin/case-studies/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New case study
          </Link>
        </>
      }
    >
      <BulkArchiveResultBanner result={bulkArchiveResult} />

      <AdminMetricStrip>
        <AdminMetricPanel
          icon="crown"
          tone="blue"
          label="Total"
          value={allCaseStudies.length}
          caption="all case studies"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Drafts"
          value={caseStudyCounts.draft}
          caption="needs work"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Published"
          value={caseStudyCounts.published}
          caption="live"
        />
        <AdminMetricPanel
          icon="archive"
          tone="slate"
          label="Archived"
          value={caseStudyCounts.archived}
          caption="retired"
        />
      </AdminMetricStrip>

      <div className="mb-7 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form
            action="/admin/case-studies"
            className="border-ui-line flex h-12 w-full items-center gap-3 rounded-md border bg-white px-4 shadow-sm lg:w-80"
          >
            <span className="text-ui-text-subtle" aria-hidden="true">
              <AdminIcon icon="search" />
            </span>
            <label className="sr-only" htmlFor="admin-case-studies-search">
              Search case studies
            </label>
            <input
              id="admin-case-studies-search"
              name="q"
              aria-label="Search case studies"
              defaultValue={searchQuery}
              placeholder="Search title, slug, or member"
              className="text-ui-text placeholder:text-ui-text-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
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
            className="border-ui-line inline-flex min-h-12 flex-wrap items-center gap-1 rounded-md border bg-white p-1 shadow-sm"
            aria-label="Case study status filters"
          >
            {caseStudyFilters.map((filter) => (
              <Link
                key={filter.value}
                href={adminCaseStudiesHref({
                  status: filter.value,
                  q: searchQuery,
                  updatedFrom,
                  sort,
                })}
                aria-current={active === filter.value ? "page" : undefined}
                className={`focus-visible:ring-ui-accent/35 rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none ${
                  active === filter.value
                    ? "bg-ui-accent-soft text-ui-accent shadow-sm"
                    : "text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form
            action="/admin/case-studies"
            className="border-ui-line flex h-12 w-full items-center gap-2 rounded-md border bg-white px-3 text-sm shadow-sm sm:w-auto"
          >
            <label
              className="text-ui-text-subtle shrink-0 text-xs font-semibold"
              htmlFor="admin-case-studies-updated-from"
            >
              Updated since
            </label>
            <input
              id="admin-case-studies-updated-from"
              name="updatedFrom"
              type="date"
              defaultValue={updatedFrom}
              className="border-ui-line text-ui-text focus:border-ui-accent focus:ring-ui-accent/15 h-8 min-w-36 rounded-md border bg-white px-2 text-sm outline-none focus:ring-2"
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
              className="focus-visible:ring-ui-accent/35 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:outline-none"
            >
              Apply
            </button>
            {updatedFrom ? (
              <Link
                href={adminCaseStudiesHref({
                  status: active,
                  q: searchQuery,
                  sort,
                })}
                className="text-ui-text-subtle hover:bg-ui-line hover:text-ui-text focus-visible:ring-ui-accent/35 rounded px-2 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
              >
                Clear
              </Link>
            ) : null}
          </form>

          <details className="group relative">
            <summary className="border-ui-line text-ui-text hover:bg-ui-canvas focus-visible:ring-ui-accent/35 flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border bg-white px-4 text-sm font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:outline-none">
              {caseStudySortLabels[sort]}
              <span
                className="text-ui-text-subtle transition group-open:rotate-180"
                aria-hidden="true"
              >
                <CaseStudyChevron />
              </span>
            </summary>
            <div className="border-ui-line absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border bg-white p-1 shadow-lg">
              {Object.entries(caseStudySortLabels).map(([value, label]) => (
                <Link
                  key={value}
                  href={adminCaseStudiesHref({
                    status: active,
                    q: searchQuery,
                    updatedFrom,
                    sort: value as CaseStudySortKey,
                  })}
                  className="text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/35 block rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                  aria-current={sort === value ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
          </details>

          <details className="group relative">
            <summary className="border-ui-line text-ui-text hover:bg-ui-canvas focus-visible:ring-ui-accent/35 flex h-12 cursor-pointer list-none items-center gap-2 rounded-md border bg-white px-4 text-sm font-semibold shadow-sm transition focus-visible:ring-2 focus-visible:outline-none">
              <span aria-hidden="true">
                <AdminIcon icon="filter" />
              </span>
              Filters
            </summary>
            <div className="border-ui-line absolute right-0 z-20 mt-2 w-52 rounded-md border bg-white p-3 text-sm shadow-lg">
              <p className="text-ui-text font-semibold">Status</p>
              <div className="mt-2 grid gap-1">
                {caseStudyFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminCaseStudiesHref({
                      status: filter.value,
                      q: searchQuery,
                      updatedFrom,
                      sort,
                    })}
                    className="text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/35 rounded-md px-2 py-1.5 font-medium focus-visible:ring-2 focus-visible:outline-none"
                    aria-current={active === filter.value ? "page" : undefined}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </div>
          </details>

          <p className="text-ui-text-muted text-sm">
            Showing {filteredCaseStudies.length} case{" "}
            {filteredCaseStudies.length === 1 ? "study" : "studies"}
          </p>
        </div>
      </div>

      <div className={adminPanelClass}>
        {visibleCaseStudies.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-ui-text text-lg font-semibold">
              No case studies found
            </h2>
            <p className="text-ui-text-muted mt-2 text-sm">
              Adjust the search, status, or date filters, or create a new draft.
            </p>
            <Link
              href="/admin/case-studies/new"
              className={`${adminPrimaryButtonClass} mt-5`}
            >
              <span aria-hidden="true">
                <AdminIcon icon="plus" />
              </span>
              New case study
            </Link>
          </div>
        ) : (
          <>
            <CaseStudyBulkArchiveControls returnTo={returnTo} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead className="border-ui-line bg-ui-canvas text-ui-text-subtle border-b text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-7 py-4">Title</th>
                    <th className="px-5 py-4">Member</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4">Published</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-ui-line divide-y">
                  {visibleCaseStudies.map((caseStudy, index) => (
                    <CaseStudyRow
                      key={caseStudy.id}
                      caseStudy={caseStudy}
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

      <div className="text-ui-text-muted mt-6 flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
        <p>
          {displayStart}-{displayEnd} of {filteredCaseStudies.length}
        </p>
        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-5 sm:flex">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              {caseStudyCounts.published} live case studies
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-slate-300" />
              {caseStudyCounts.archived} archived
            </span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <AdminPaginationLink
              label="Previous page"
              disabled={currentPage <= 1}
              href={adminCaseStudiesHref({
                status: active,
                q: searchQuery,
                updatedFrom,
                sort,
                page: currentPage - 1,
              })}
            />
            <span className="border-ui-accent text-ui-accent flex h-9 min-w-9 items-center justify-center rounded-md border bg-white px-3 font-semibold">
              {currentPage}
            </span>
            <AdminPaginationLink
              label="Next page"
              disabled={currentPage >= totalPages}
              href={adminCaseStudiesHref({
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

function CaseStudyRow({
  caseStudy,
  isFirst,
  returnTo,
}: {
  caseStudy: CaseStudyListItem;
  isFirst: boolean;
  returnTo: string;
}) {
  return (
    <tr className="hover:bg-ui-canvas align-middle transition [&:has(details[open])]:relative [&:has(details[open])]:z-20 [&:has(details[open])]:bg-[#f8fbff]">
      <td
        className={`px-7 py-4 ${
          isFirst ? "border-ui-accent border-l-4" : "border-l-4 border-white"
        }`}
      >
        <div className="flex items-start gap-3">
          {caseStudy.status !== "archived" ? (
            <input
              type="checkbox"
              name="ids"
              value={caseStudy.id}
              form="case-study-bulk-archive-form"
              aria-label={`Select ${caseStudy.title} for bulk actions`}
              className="border-ui-line-strong text-ui-accent focus-visible:ring-ui-accent/35 mt-1 size-4 shrink-0 rounded focus-visible:ring-2 focus-visible:outline-none"
            />
          ) : null}
          <div className="min-w-0">
            <Link
              href={`/admin/case-studies/${caseStudy.id}`}
              className="text-ui-text hover:text-ui-accent focus-visible:ring-ui-accent/35 font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {caseStudy.title}
            </Link>
            <p className="text-ui-text-subtle mt-1 font-mono text-xs">
              /{caseStudy.slug}
            </p>
          </div>
        </div>
      </td>
      <td className="text-ui-text-muted px-5 py-4">
        <span className="text-ui-text block truncate font-medium">
          {caseStudy.member_name}
        </span>
        {caseStudy.member_role ? (
          <span className="text-ui-text-subtle block truncate text-xs">
            {caseStudy.member_role}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <AdminStatusBadge status={caseStudy.status} />
      </td>
      <td className="text-ui-text-muted px-5 py-4">
        {formatDate(caseStudy.updated_at)}
      </td>
      <td className="text-ui-text-muted px-5 py-4">
        {caseStudy.published_at ? formatDate(caseStudy.published_at) : "-"}
      </td>
      <td className="px-5 py-4 text-right">
        <CaseStudyActionsMenu caseStudy={caseStudy} returnTo={returnTo} />
      </td>
    </tr>
  );
}

function CaseStudyActionsMenu({
  caseStudy,
  returnTo,
}: {
  caseStudy: CaseStudyListItem;
  returnTo: string;
}) {
  const isArchived = caseStudy.status === "archived";

  return (
    <details className="group relative inline-block shrink-0 text-left">
      <summary
        className="text-ui-text-muted group-open:text-ui-accent hover:bg-ui-line hover:text-ui-text focus-visible:ring-ui-accent/35 inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md transition group-open:bg-[#eef5ff] focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
        aria-label={`Open actions for ${caseStudy.title}`}
      >
        <AdminIcon icon="more" />
      </summary>
      <div className="border-ui-line absolute top-full right-0 z-30 mt-2 w-52 overflow-hidden rounded-md border bg-white p-1 text-left shadow-lg">
        <Link
          href={`/admin/case-studies/${caseStudy.id}`}
          className="text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/35 block rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
        >
          Edit case study
        </Link>
        {!isArchived ? (
          <>
            <div className="my-1 border-t border-slate-100" />
            <form action={archiveCaseStudyFromList}>
              <input type="hidden" name="id" value={caseStudy.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <AdminPageActionButton
                label="Archive case study"
                tone="danger"
                confirmMessage={`Archive "${caseStudy.title}"? This removes it from the active list. You can restore it later from the Archived filter.`}
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
  params: AdminCaseStudiesSearchParams,
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
        Could not archive the selected case studies. Check the logs and try
        again.
      </p>
    );
  }

  if (result.kind === "partial") {
    return (
      <p
        role="alert"
        className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
      >
        Archived {result.archived}{" "}
        {result.archived === 1 ? "case study" : "case studies"} —{" "}
        {result.failed} failed, check logs.
      </p>
    );
  }

  return (
    <p
      role="status"
      className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
    >
      Archived {result.archived}{" "}
      {result.archived === 1 ? "case study" : "case studies"}.
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

function CaseStudyChevron() {
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
