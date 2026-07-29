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
      <section className="border-ui-line overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-ui-line border-b px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <form
              action="/admin/media"
              method="get"
              className="border-ui-line flex h-10 min-w-0 flex-1 items-center gap-2 border-b pb-3 lg:border-r lg:border-b-0 lg:pr-4 lg:pb-0"
            >
              <span className="text-ui-text-subtle" aria-hidden="true">
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
                className="text-ui-text placeholder:text-ui-text-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
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
                className="bg-ui-line inline-flex h-10 items-center rounded-md p-0.5"
                aria-label="View mode"
              >
                <Link
                  href={adminMediaHref({ ...filterContext, view: "grid" })}
                  aria-current={view === "grid" ? "page" : undefined}
                  aria-label="Grid view"
                  className={`focus-visible:ring-ui-accent/35 inline-flex size-9 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none ${
                    view === "grid"
                      ? "text-ui-accent bg-white shadow-sm"
                      : "text-ui-text-subtle hover:text-ui-text"
                  }`}
                >
                  <AdminIcon icon="image" />
                </Link>
                <Link
                  href={adminMediaHref({ ...filterContext, view: "list" })}
                  aria-current={view === "list" ? "page" : undefined}
                  aria-label="List view"
                  className={`focus-visible:ring-ui-accent/35 inline-flex size-9 items-center justify-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none ${
                    view === "list"
                      ? "text-ui-accent bg-white shadow-sm"
                      : "text-ui-text-subtle hover:text-ui-text"
                  }`}
                >
                  <AdminIcon icon="list" />
                </Link>
              </nav>
              <details className="group relative">
                <summary className="text-ui-text-muted hover:bg-ui-canvas focus-visible:ring-ui-accent/35 flex h-10 cursor-pointer list-none items-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none">
                  {mediaSortLabels[sort]}
                  <SortChevron />
                </summary>
                <div className="border-ui-line absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border bg-white p-1 shadow-lg">
                  {Object.entries(mediaSortLabels).map(([value, label]) => (
                    <Link
                      key={value}
                      href={adminMediaHref({
                        ...filterContext,
                        sort: value as SortKey,
                      })}
                      className="text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text block rounded-md px-3 py-2 text-sm"
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
                  className={`focus-visible:ring-ui-accent/35 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition focus-visible:ring-2 focus-visible:outline-none ${
                    collection === item.value && sourceFilter === "all"
                      ? "text-ui-accent font-semibold"
                      : "text-ui-text-muted hover:text-ui-text"
                  }`}
                >
                  {item.label}
                  <span className="text-ui-text-subtle text-xs font-medium">
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
              className={`focus-visible:ring-ui-accent/35 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition focus-visible:ring-2 focus-visible:outline-none ${
                sourceFilter === "stored" && collection === "all"
                  ? "text-ui-accent font-semibold"
                  : "text-ui-text-muted hover:text-ui-text"
              }`}
            >
              Stored
              <span className="text-ui-text-subtle text-xs font-medium">
                {assetCounts.stored}
              </span>
            </Link>
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-ui-text-subtle mr-1 text-xs font-semibold tracking-wide uppercase">
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
                  className={`focus-visible:ring-ui-accent/35 rounded-full px-2.5 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none ${
                    typeFilter === filter.value
                      ? "bg-slate-900 text-white"
                      : "bg-ui-line text-ui-text-muted hover:text-ui-text hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
            </div>

            <details className="group relative">
              <summary className="bg-ui-line text-ui-text-muted hover:text-ui-text focus-visible:ring-ui-accent/35 flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:outline-none">
                Purpose: {activePurpose?.label ?? "All"}
                <SortChevron />
              </summary>
              <div className="border-ui-line absolute left-0 z-20 mt-2 w-48 overflow-hidden rounded-md border bg-white p-1 shadow-lg">
                <Link
                  href={adminMediaHref({
                    ...filterContext,
                    collection: isPurposeCollection(collection)
                      ? "all"
                      : collection,
                  })}
                  className="text-ui-text-muted hover:bg-ui-canvas block rounded-md px-3 py-2 text-sm"
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
                    className="text-ui-text-muted hover:bg-ui-canvas flex items-center justify-between rounded-md px-3 py-2 text-sm"
                    aria-current={
                      collection === item.value ? "page" : undefined
                    }
                  >
                    {item.label}
                    <span className="text-ui-text-subtle text-xs">
                      {collectionCounts[item.value]}
                    </span>
                  </Link>
                ))}
              </div>
            </details>

            <details className="group relative">
              <summary className="text-ui-text-subtle hover:text-ui-text focus-visible:ring-ui-accent/35 flex cursor-pointer list-none items-center gap-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none">
                More filters
                <SortChevron />
              </summary>
              <div className="border-ui-line absolute left-0 z-20 mt-2 w-44 overflow-hidden rounded-md border bg-white p-1 shadow-lg">
                {mediaSourceFilters.map((filter) => (
                  <Link
                    key={filter.value}
                    href={adminMediaHref({
                      ...filterContext,
                      source: filter.value,
                      collection: "all",
                      tag: "",
                    })}
                    className="text-ui-text-muted hover:bg-ui-canvas block rounded-md px-3 py-2 text-sm"
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
                      className="text-ui-accent focus-visible:ring-ui-accent/35 inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold transition hover:bg-[#dceaff] focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {chip.label}
                      <span aria-hidden="true">×</span>
                    </Link>
                  ))}
                  <Link
                    href="/admin/media"
                    className="text-ui-text-subtle hover:text-ui-text text-xs font-semibold transition"
                  >
                    Clear all
                  </Link>
                </>
              ) : (
                <p className="text-ui-text-subtle text-sm">{resultLabel}</p>
              )}
            </div>
            {activeFilterChips.length > 0 ? (
              <p className="text-ui-text-subtle text-sm">{resultLabel}</p>
            ) : null}
          </div>

          {allTags.length > 0 ? (
            <nav
              className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3"
              aria-label="Filter by tag"
            >
              <span className="text-ui-text-subtle mr-1 self-center text-xs font-semibold tracking-wide uppercase">
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
                  className={`focus-visible:ring-ui-accent/35 rounded-full px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none ${
                    tagFilter === tag
                      ? "bg-slate-900 text-white"
                      : "text-ui-text-subtle hover:bg-ui-line hover:text-ui-text"
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
            <h2 className="text-ui-text text-lg font-semibold">
              {hasActiveFilters
                ? "No matching media assets"
                : "No media assets yet"}
            </h2>
            <p className="text-ui-text-muted mt-2 text-sm">
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
            <div className="border-ui-line border-t px-5 py-4 sm:flex sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                {showRowsPerPage ? (
                  <div className="flex items-center gap-2">
                    <span className="text-ui-text-subtle text-sm font-medium">
                      Rows
                    </span>
                    <nav
                      className="border-ui-line inline-flex items-center gap-1 rounded-md border bg-white p-1"
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
                          className={`focus-visible:ring-ui-accent/35 flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:outline-none ${
                            pageSize === option
                              ? "bg-ui-accent-soft text-ui-accent shadow-sm"
                              : "text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text"
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
                  <span className="text-ui-text-subtle text-sm font-medium">
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
        className="border-ui-accent text-ui-accent flex h-9 min-w-9 items-center justify-center rounded-md border bg-white px-3 font-semibold"
      >
        {pageNumber}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="border-ui-line text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-accent/35 flex h-9 min-w-9 items-center justify-center rounded-md border bg-white px-3 font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
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
