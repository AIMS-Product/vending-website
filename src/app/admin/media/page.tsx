import type { Metadata } from "next";
import Link from "next/link";
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
  assetMatchesCollection,
  countByCollection,
  isPurposeCollection,
  mediaPurposeFilters,
  mediaStatusFilters,
  normalizeMediaCollection,
  type MediaCollection,
} from "@/lib/media/collections";
import {
  adminBuildMediaUsageIndex,
  adminListMediaAssets,
  publicMediaAssetUrl,
  type MediaAssetType,
} from "@/lib/services/media-assets";
import { requireAdmin } from "@/lib/supabase/auth";

type SearchParams = {
  q?: string | string[];
  type?: string | string[];
  source?: string | string[];
  tag?: string | string[];
  collection?: string | string[];
  view?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  perPage?: string | string[];
};

type TypeFilter = "all" | MediaAssetType;
type SourceFilter = "all" | "stored" | "external" | "tagged" | "untagged";
type ViewMode = "grid" | "list";
type SortKey = "created-desc" | "created-asc" | "title-asc" | "title-desc";

const typeFilters: Array<{ label: string; value: TypeFilter }> = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Video", value: "video" },
  { label: "Embeds", value: "embed" },
];

const sourceFilters: Array<{ label: string; value: SourceFilter }> = [
  { label: "Stored", value: "stored" },
  { label: "External", value: "external" },
  { label: "Tagged", value: "tagged" },
  { label: "Untagged", value: "untagged" },
];

const sortLabels: Record<SortKey, string> = {
  "created-desc": "Newest first",
  "created-asc": "Oldest first",
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
};

const pageSizeOptions = [12, 24, 48] as const;
type PageSize = (typeof pageSizeOptions)[number];
const defaultPageSize: PageSize = 12;

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
  const searchQuery = normalizeSearch(firstParam(params.q));
  const typeFilter = normalizeTypeFilter(firstParam(params.type));
  const sourceFilter = normalizeSourceFilter(firstParam(params.source));
  const tagFilter = normalizeTag(firstParam(params.tag));
  const collection = normalizeMediaCollection(firstParam(params.collection));
  const view = normalizeView(firstParam(params.view));
  const sort = normalizeSort(firstParam(params.sort));
  const requestedPage = normalizePage(firstParam(params.page));
  const pageSize = normalizePageSize(firstParam(params.perPage));

  const [allAssets, usageIndex] = await Promise.all([
    adminListMediaAssets(),
    adminBuildMediaUsageIndex(),
  ]);
  const assetCounts = countAssets(allAssets, usageIndex);
  const collectionCounts = countByCollection(allAssets, usageIndex);
  const allTags = collectTags(allAssets);
  const filteredAssets = sortMediaAssets(
    filterMediaAssets(allAssets, {
      typeFilter,
      sourceFilter,
      tagFilter,
      collection,
      searchQuery,
      usageIndex,
    }),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleAssets = filteredAssets.slice(pageStart, pageStart + pageSize);
  const displayStart = filteredAssets.length === 0 ? 0 : pageStart + 1;
  const displayEnd = Math.min(pageStart + pageSize, filteredAssets.length);
  const paginationPages = paginationWindow(currentPage, totalPages);
  const showRowsPerPage = filteredAssets.length > defaultPageSize;
  const hasActiveFilters =
    Boolean(searchQuery) ||
    typeFilter !== "all" ||
    sourceFilter !== "all" ||
    collection !== "all" ||
    Boolean(tagFilter);
  const filterContext = {
    q: searchQuery,
    type: typeFilter,
    source: sourceFilter,
    tag: tagFilter,
    collection,
    view,
    sort,
    perPage: pageSize,
  };
  const activeFilterChips = buildActiveFilterChips({
    filterContext,
    searchQuery,
    typeFilter,
    sourceFilter,
    tagFilter,
    collection,
  });
  const resultLabel =
    filteredAssets.length === 0
      ? "No assets match"
      : totalPages > 1
        ? `${displayStart}-${displayEnd} of ${filteredAssets.length}`
        : `${filteredAssets.length} asset${filteredAssets.length === 1 ? "" : "s"}`;
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
                  {sortLabels[sort]}
                  <SortChevron />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  {Object.entries(sortLabels).map(([value, label]) => (
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
              <span className="mr-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Type
              </span>
              {typeFilters.map((filter) => (
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
                {sourceFilters.map((filter) => (
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
              <span className="mr-1 self-center text-xs font-semibold tracking-wide text-slate-400 uppercase">
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
                      {pageSizeOptions.map((option) => (
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
                    <PaginationLink
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
                    <PaginationLink
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
      {pageSize !== defaultPageSize ? (
        <input type="hidden" name="perPage" value={pageSize} />
      ) : null}
    </>
  );
}

function buildActiveFilterChips({
  filterContext,
  searchQuery,
  typeFilter,
  sourceFilter,
  tagFilter,
  collection,
}: {
  filterContext: {
    q: string;
    type: TypeFilter;
    source: SourceFilter;
    tag: string;
    collection: MediaCollection;
    view: ViewMode;
    sort: SortKey;
    perPage: PageSize;
  };
  searchQuery: string;
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  tagFilter: string;
  collection: MediaCollection;
}) {
  const chips: Array<{ key: string; label: string; href: string }> = [];

  if (searchQuery) {
    chips.push({
      key: "search",
      label: `Search: ${searchQuery}`,
      href: adminMediaHref({ ...filterContext, q: "" }),
    });
  }

  if (typeFilter !== "all") {
    chips.push({
      key: "type",
      label:
        typeFilters.find((item) => item.value === typeFilter)?.label ??
        typeFilter,
      href: adminMediaHref({ ...filterContext, type: "all" }),
    });
  }

  if (sourceFilter !== "all") {
    chips.push({
      key: "source",
      label:
        sourceFilters.find((item) => item.value === sourceFilter)?.label ??
        sourceFilter,
      href: adminMediaHref({ ...filterContext, source: "all" }),
    });
  }

  if (collection !== "all") {
    const label =
      mediaStatusFilters.find((item) => item.value === collection)?.label ??
      mediaPurposeFilters.find((item) => item.value === collection)?.label ??
      collection;
    chips.push({
      key: "collection",
      label,
      href: adminMediaHref({ ...filterContext, collection: "all" }),
    });
  }

  if (tagFilter) {
    chips.push({
      key: "tag",
      label: `Tag: ${tagFilter}`,
      href: adminMediaHref({ ...filterContext, tag: "" }),
    });
  }

  return chips;
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearch(value: string | undefined) {
  return value?.trim().slice(0, 120) ?? "";
}

function normalizeTypeFilter(value: string | undefined): TypeFilter {
  if (value === "image" || value === "video" || value === "embed") {
    return value;
  }
  return "all";
}

function normalizeSourceFilter(value: string | undefined): SourceFilter {
  if (
    value === "stored" ||
    value === "external" ||
    value === "tagged" ||
    value === "untagged"
  ) {
    return value;
  }
  return "all";
}

function normalizeTag(value: string | undefined) {
  return value?.trim().toLowerCase().slice(0, 80) ?? "";
}

function normalizeView(value: string | undefined): ViewMode {
  return value === "list" ? "list" : "grid";
}

function normalizeSort(value: string | undefined): SortKey {
  if (
    value === "created-asc" ||
    value === "title-asc" ||
    value === "title-desc"
  ) {
    return value;
  }
  return "created-desc";
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

function paginationWindow(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
}

function filterMediaAssets(
  assets: Awaited<ReturnType<typeof adminListMediaAssets>>,
  {
    typeFilter,
    sourceFilter,
    tagFilter,
    collection,
    searchQuery,
    usageIndex,
  }: {
    typeFilter: TypeFilter;
    sourceFilter: SourceFilter;
    tagFilter: string;
    collection: MediaCollection;
    searchQuery: string;
    usageIndex: Record<string, number>;
  },
) {
  const query = searchQuery.toLowerCase();
  return assets.filter((asset) => {
    if (typeFilter !== "all" && asset.asset_type !== typeFilter) {
      return false;
    }

    if (sourceFilter === "stored" && !asset.storage_path) return false;
    if (sourceFilter === "external" && !asset.external_url) return false;
    if (sourceFilter === "tagged" && asset.tags.length === 0) return false;
    if (sourceFilter === "untagged" && asset.tags.length > 0) return false;

    if (tagFilter && !asset.tags.includes(tagFilter)) return false;

    if (!assetMatchesCollection(asset, collection, usageIndex[asset.id] ?? 0)) {
      return false;
    }

    if (!query) return true;

    return (
      asset.title.toLowerCase().includes(query) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      (asset.alt_text?.toLowerCase().includes(query) ?? false)
    );
  });
}

function sortMediaAssets(
  assets: Awaited<ReturnType<typeof adminListMediaAssets>>,
  sort: SortKey,
) {
  const next = [...assets];
  if (sort === "title-asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "title-desc") {
    return next.sort((a, b) => b.title.localeCompare(a.title));
  }
  return next.sort((a, b) => {
    const left = new Date(a.created_at).getTime();
    const right = new Date(b.created_at).getTime();
    return sort === "created-asc" ? left - right : right - left;
  });
}

function collectTags(assets: Awaited<ReturnType<typeof adminListMediaAssets>>) {
  const tags = new Set<string>();
  for (const asset of assets) {
    for (const tag of asset.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function adminMediaHref({
  q,
  type = "all",
  source = "all",
  tag = "",
  collection = "all",
  view = "grid",
  sort = "created-desc",
  page,
  perPage,
}: {
  q?: string;
  type?: TypeFilter;
  source?: SourceFilter;
  tag?: string;
  collection?: MediaCollection;
  view?: ViewMode;
  sort?: SortKey;
  page?: number;
  perPage?: PageSize;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  if (source !== "all") params.set("source", source);
  if (tag) params.set("tag", tag);
  if (collection !== "all") params.set("collection", collection);
  if (view !== "grid") params.set("view", view);
  if (sort !== "created-desc") params.set("sort", sort);
  if (perPage && perPage !== defaultPageSize) {
    params.set("perPage", String(perPage));
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/media?${query}` : "/admin/media";
}

function countAssets(
  assets: Awaited<ReturnType<typeof adminListMediaAssets>>,
  usageIndex: Record<string, number>,
) {
  return assets.reduce(
    (counts, asset) => {
      if (asset.storage_path) counts.stored += 1;
      if (asset.external_url) counts.external += 1;
      if (asset.tags.length > 0) counts.tagged += 1;
      if ((usageIndex[asset.id] ?? 0) > 0) counts.inUse += 1;
      else counts.unused += 1;
      return counts;
    },
    { stored: 0, external: 0, tagged: 0, inUse: 0, unused: 0 },
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
