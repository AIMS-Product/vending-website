import type { Metadata } from "next";
import Link from "next/link";
import { AdminPaginationLink } from "@/components/admin/AdminPaginationLink";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import {
  MediaLibraryManager,
  type MediaAssetListItem,
} from "@/components/admin/MediaLibraryManager";
import { MediaUploadActions } from "@/components/admin/MediaUploadActions";
import {
  countByCollection,
  isPurposeCollection,
  mediaPurposeFilters,
  mediaStatusFilters,
  type MediaCollection,
} from "@/lib/media/collections";
import {
  adminMediaHref,
  buildMediaListState,
  defaultMediaPageSize,
  mediaPageSizeOptions,
  mediaSortLabels,
  mediaSourceFilters,
  mediaTypeFilters,
  parseMediaListParams,
  type MediaPageSize as PageSize,
  type MediaSearchParams as SearchParams,
  type MediaSortKey as SortKey,
  type MediaSourceFilter as SourceFilter,
  type MediaTypeFilter as TypeFilter,
  type MediaViewMode as ViewMode,
} from "@/lib/admin/media-list";
import {
  adminBuildMediaUsageIndex,
  adminListMediaAssets,
  publicMediaAssetUrl,
} from "@/lib/services/media-assets";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Media library admin",
  robots: { index: false, follow: false },
};

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const listParams = parseMediaListParams(params);

  const [allAssets, usageIndex] = await Promise.all([
    adminListMediaAssets(),
    adminBuildMediaUsageIndex(),
  ]);
  const collectionCounts = countByCollection(allAssets, usageIndex);
  const {
    q: searchQuery,
    type: typeFilter,
    source: sourceFilter,
    tag: tagFilter,
    collection,
    view,
    sort,
    perPage: pageSize,
    filterContext,
    assetCounts,
    allTags,
    visibleAssets,
    totalPages,
    currentPage,
    paginationPages,
    showRowsPerPage,
    hasActiveFilters,
    activeFilterChips,
    resultLabel,
  } = buildMediaListState({
    assets: allAssets,
    usageIndex,
    collectionCounts,
    params: listParams,
  });
  const activePurpose = isPurposeCollection(collection)
    ? mediaPurposeFilters.find((item) => item.value === collection)
    : null;

  return (
    <AdminShell
      activeSection="media"
      eyebrow="CMS Assets"
      title="Media library"
      description="Browse, upload, and organize image and media assets for resource pages, news, and reusable content."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/libraries" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="layers" />
          </span>
          Content libraries
        </Link>
      }
    >
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <form
              action="/admin/media"
              method="get"
              className="flex h-10 min-w-0 flex-1 items-center gap-2 border-b border-slate-200 pb-3 lg:border-r lg:border-b-0 lg:pr-4 lg:pb-0"
            >
              <span className="text-slate-400" aria-hidden="true">
                <AdminIcon icon="search" />
              </span>
              <label className="sr-only" htmlFor="admin-media-search">
                Search media assets
              </label>
              <input
                id="admin-media-search"
                name="q"
                aria-label="Search media assets"
                defaultValue={searchQuery}
                placeholder="Search title or tag"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
              <MediaSearchHiddenFields
                typeFilter={typeFilter}
                sourceFilter={sourceFilter}
                tagFilter={tagFilter}
                collection={collection}
                view={view}
                sort={sort}
                pageSize={pageSize}
              />
              <button type="submit" className="sr-only">
                Search
              </button>
            </form>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pl-1">
              <MediaUploadActions />
              <nav
                className="inline-flex h-10 items-center rounded-md bg-slate-100 p-0.5"
                aria-label="View mode"
              >
                <Link
                  href={adminMediaHref({ ...filterContext, view: "grid" })}
                  aria-current={view === "grid" ? "page" : undefined}
                  aria-label="Grid view"
                  className={`inline-flex size-9 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    view === "grid"
                      ? "bg-white text-[#0b63f6] shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  <AdminIcon icon="image" />
                </Link>
                <Link
                  href={adminMediaHref({ ...filterContext, view: "list" })}
                  aria-current={view === "list" ? "page" : undefined}
                  aria-label="List view"
                  className={`inline-flex size-9 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    view === "list"
                      ? "bg-white text-[#0b63f6] shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  <AdminIcon icon="list" />
                </Link>
              </nav>
              <details className="group relative">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
                  {mediaSortLabels[sort]}
                  <SortChevron />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  {Object.entries(mediaSortLabels).map(([value, label]) => (
                    <Link
                      key={value}
                      href={adminMediaHref({
                        ...filterContext,
                        sort: value as SortKey,
                      })}
                      className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                      aria-current={sort === value ? "page" : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <nav
            className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-slate-100 pb-3 text-sm"
            aria-label="Media status filters"
          >
            {mediaStatusFilters.map((item, index) => (
              <span key={item.value} className="inline-flex items-center">
                {index > 0 ? (
                  <span className="mx-2 text-slate-300" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <Link
                  href={adminMediaHref({
                    ...filterContext,
                    collection: item.value,
                    source: "all",
                    tag: "",
                  })}
                  aria-current={
                    collection === item.value && sourceFilter === "all"
                      ? "page"
                      : undefined
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    collection === item.value && sourceFilter === "all"
                      ? "font-semibold text-[#0b63f6]"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                  <span className="text-xs font-medium text-slate-400">
                    {collectionCounts[item.value]}
                  </span>
                </Link>
              </span>
            ))}
            <span className="mx-2 text-slate-300" aria-hidden="true">
              ·
            </span>
            <Link
              href={adminMediaHref({
                ...filterContext,
                source: "stored",
                collection: "all",
                tag: "",
              })}
              aria-current={
                sourceFilter === "stored" && collection === "all"
                  ? "page"
                  : undefined
              }
              className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                sourceFilter === "stored" && collection === "all"
                  ? "font-semibold text-[#0b63f6]"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Stored
              <span className="text-xs font-medium text-slate-400">
                {assetCounts.stored}
              </span>
            </Link>
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Type
              </span>
              {mediaTypeFilters.map((filter) => (
                <Link
                  key={filter.value}
                  href={adminMediaHref({
                    ...filterContext,
                    type: filter.value,
                  })}
                  aria-current={
                    typeFilter === filter.value ? "page" : undefined
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    typeFilter === filter.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
            </div>

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
                Purpose: {activePurpose?.label ?? "All"}
                <SortChevron />
              </summary>
              <div className="absolute left-0 z-20 mt-2 w-48 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <Link
                  href={adminMediaHref({
                    ...filterContext,
                    collection: isPurposeCollection(collection)
                      ? "all"
                      : collection,
                  })}
                  className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  aria-current={!activePurpose ? "page" : undefined}
                >
                  All purposes
                </Link>
                {mediaPurposeFilters.map((item) => (
                  <Link
                    key={item.value}
                    href={adminMediaHref({
                      ...filterContext,
                      collection: item.value,
                      source: "all",
                      tag: "",
                    })}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    aria-current={
                      collection === item.value ? "page" : undefined
                    }
                  >
                    {item.label}
                    <span className="text-xs text-slate-400">
                      {collectionCounts[item.value]}
                    </span>
                  </Link>
                ))}
              </div>
            </details>

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none">
                More filters
                <SortChevron />
              </summary>
              <div className="absolute left-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {mediaSourceFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminMediaHref({
                      ...filterContext,
                      source: filter.value,
                      collection: "all",
                      tag: "",
                    })}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    aria-current={
                      sourceFilter === filter.value ? "page" : undefined
                    }
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {activeFilterChips.length > 0 ? (
                <>
                  {activeFilterChips.map((chip) => (
                    <Link
                      key={chip.key}
                      href={chip.href}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#0b63f6] transition hover:bg-[#dceaff] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                    >
                      {chip.label}
                      <span aria-hidden="true">×</span>
                    </Link>
                  ))}
                  <Link
                    href="/admin/media"
                    className="text-xs font-semibold text-slate-500 transition hover:text-slate-950"
                  >
                    Clear all
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-500">{resultLabel}</p>
              )}
            </div>
            {activeFilterChips.length > 0 ? (
              <p className="text-sm text-slate-500">{resultLabel}</p>
            ) : null}
          </div>

          {allTags.length > 0 ? (
            <nav
              className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
              aria-label="Filter by tag"
            >
              <span className="mr-1 self-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Tags
              </span>
              {allTags.map((tag) => (
                <Link
                  key={tag}
                  href={adminMediaHref({
                    ...filterContext,
                    tag: tagFilter === tag ? "" : tag,
                  })}
                  aria-current={tagFilter === tag ? "page" : undefined}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none ${
                    tagFilter === tag
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {tag}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {visibleAssets.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              {hasActiveFilters
                ? "No matching media assets"
                : "No media assets yet"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {hasActiveFilters
                ? "Clear filters or upload a new asset to broaden the list."
                : "Upload your first image or link an external video to start building the library."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {hasActiveFilters ? (
                <Link href="/admin/media" className={adminSecondaryButtonClass}>
                  Clear filters
                </Link>
              ) : null}
              <MediaUploadActions />
            </div>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Media assets</h2>
            <MediaLibraryManager
              assets={visibleAssets.map((asset) =>
                toListItem(asset, usageIndex[asset.id] ?? 0),
              )}
              usageCounts={usageIndex}
              view={view}
            />
            <div className="border-t border-slate-200 px-5 py-4 sm:flex sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                {showRowsPerPage ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">
                      Rows
                    </span>
                    <nav
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1"
                      aria-label="Rows per page"
                    >
                      {mediaPageSizeOptions.map((option) => (
                        <Link
                          key={option}
                          href={adminMediaHref({
                            ...filterContext,
                            perPage: option,
                          })}
                          aria-current={
                            pageSize === option ? "page" : undefined
                          }
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
              {totalPages > 1 ? (
                <div className="mt-4 flex items-center gap-3 sm:mt-0">
                  <span className="text-sm font-medium text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <nav
                    className="flex items-center gap-2"
                    aria-label="Pagination"
                  >
                    <AdminPaginationLink
                      label="Previous page"
                      disabled={currentPage <= 1}
                      href={adminMediaHref({
                        ...filterContext,
                        page: currentPage - 1,
                      })}
                    />
                    {paginationPages.map((pageNumber) => (
                      <PaginationNumber
                        key={pageNumber}
                        pageNumber={pageNumber}
                        current={pageNumber === currentPage}
                        href={adminMediaHref({
                          ...filterContext,
                          page: pageNumber,
                        })}
                      />
                    ))}
                    <AdminPaginationLink
                      label="Next page"
                      disabled={currentPage >= totalPages}
                      href={adminMediaHref({
                        ...filterContext,
                        page: currentPage + 1,
                      })}
                      next
                    />
                  </nav>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}

function MediaSearchHiddenFields({
  typeFilter,
  sourceFilter,
  tagFilter,
  collection,
  view,
  sort,
  pageSize,
}: {
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  tagFilter: string;
  collection: MediaCollection;
  view: ViewMode;
  sort: SortKey;
  pageSize: PageSize;
}) {
  return (
    <>
      {typeFilter !== "all" ? (
        <input type="hidden" name="type" value={typeFilter} />
      ) : null}
      {sourceFilter !== "all" ? (
        <input type="hidden" name="source" value={sourceFilter} />
      ) : null}
      {tagFilter ? <input type="hidden" name="tag" value={tagFilter} /> : null}
      {collection !== "all" ? (
        <input type="hidden" name="collection" value={collection} />
      ) : null}
      {view !== "grid" ? (
        <input type="hidden" name="view" value={view} />
      ) : null}
      {sort !== "created-desc" ? (
        <input type="hidden" name="sort" value={sort} />
      ) : null}
      {pageSize !== defaultMediaPageSize ? (
        <input type="hidden" name="perPage" value={pageSize} />
      ) : null}
    </>
  );
}

function SortChevron() {
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

function toListItem(
  asset: Awaited<ReturnType<typeof adminListMediaAssets>>[number],
  usageCount: number,
): MediaAssetListItem {
  return {
    id: asset.id,
    assetType: asset.asset_type as MediaAssetListItem["assetType"],
    title: asset.title,
    alt_text: asset.alt_text,
    caption: asset.caption,
    source_rights_notes: asset.source_rights_notes,
    storage_bucket: asset.storage_bucket,
    storage_path: asset.storage_path,
    external_url: asset.external_url,
    duration_seconds: asset.duration_seconds,
    tags: asset.tags,
    created_at: asset.created_at,
    publicUrl: publicMediaAssetUrl(asset),
    usageCount,
  };
}
