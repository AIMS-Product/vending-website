import {
  buildAdminListHref,
  firstParam,
  normalizeNumberOption,
  normalizePositivePage,
  normalizeSearchParam,
  normalizeStringOption,
  paginateItems,
  type SearchParamValue,
} from "@/lib/admin/list-state";
import type { Tables } from "@/types/database";

export type SeoPageSearchParams = {
  status?: SearchParamValue;
  q?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
  perPage?: SearchParamValue;
};

export type SeoPageStatusFilter = "active" | "draft" | "published" | "archived";
export type SeoPageSortKey =
  | "updated-desc"
  | "updated-asc"
  | "published-desc"
  | "title-asc";
export type SeoPageSize = (typeof seoPageSizeOptions)[number];
export type SeoPageListParams = {
  status: SeoPageStatusFilter;
  q: string;
  sort: SeoPageSortKey;
  page: number;
  perPage: SeoPageSize;
};

export type SeoPageListState = SeoPageListParams & {
  pageCounts: ReturnType<typeof countPagesByStatus>;
  filteredPages: Tables<"seo_pages">[];
  visiblePages: Tables<"seo_pages">[];
  totalPages: number;
  currentPage: number;
  displayStart: number;
  displayEnd: number;
  paginationPages: number[];
  showRowsPerPage: boolean;
  resultRangeLabel: string;
  returnTo: string;
};

export const seoPageFilters: Array<{
  label: string;
  value: SeoPageStatusFilter;
}> = [
  { label: "All", value: "active" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export const seoPageSortLabels: Record<SeoPageSortKey, string> = {
  "updated-desc": "Updated newest",
  "updated-asc": "Updated oldest",
  "published-desc": "Published newest",
  "title-asc": "Title A-Z",
};

export const seoPageSizeOptions = [10, 25, 50, 100] as const;
export const defaultSeoPageSize: SeoPageSize = 10;

export function parseSeoPageListParams(
  params: SeoPageSearchParams,
): SeoPageListParams {
  return {
    status: normalizeStringOption(
      firstParam(params.status),
      ["active", "draft", "published", "archived"] as const,
      "active",
    ),
    q: normalizeSearchParam(firstParam(params.q)),
    sort: normalizeStringOption(
      firstParam(params.sort),
      ["updated-desc", "updated-asc", "published-desc", "title-asc"] as const,
      "updated-desc",
    ),
    page: normalizePositivePage(firstParam(params.page)),
    perPage: normalizeNumberOption(
      firstParam(params.perPage),
      seoPageSizeOptions,
      defaultSeoPageSize,
    ),
  };
}

export function buildSeoPageListState(
  pages: Tables<"seo_pages">[],
  params: SeoPageListParams,
): SeoPageListState {
  const pageCounts = countPagesByStatus(pages);
  const filteredPages = sortSeoPages(
    filterSeoPages(pages, params.status, params.q),
    params.sort,
  );
  const pagination = paginateItems(filteredPages, params.page, params.perPage);
  const resultRangeLabel =
    filteredPages.length === 0
      ? "No resource pages"
      : pagination.totalPages > 1
        ? `${pagination.displayStart}-${pagination.displayEnd} of ${filteredPages.length}`
        : `Showing all ${filteredPages.length}`;

  return {
    ...params,
    pageCounts,
    filteredPages,
    visiblePages: pagination.visibleItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    displayStart: pagination.displayStart,
    displayEnd: pagination.displayEnd,
    paginationPages: pagination.paginationPages,
    showRowsPerPage: filteredPages.length > defaultSeoPageSize,
    resultRangeLabel,
    returnTo: adminPagesHref({
      status: params.status,
      q: params.q,
      sort: params.sort,
      page: pagination.currentPage,
      perPage: params.perPage,
    }),
  };
}

export function filterSeoPages(
  pages: Tables<"seo_pages">[],
  status: SeoPageStatusFilter,
  searchQuery: string,
) {
  const query = searchQuery.toLowerCase();
  return pages.filter((page) => {
    const matchesStatus =
      status === "active" ? page.status !== "archived" : page.status === status;
    if (!matchesStatus) return false;
    if (!query) return true;

    const routePath = page.route_path ?? `/resources/${page.slug}`;

    return [page.title, page.slug, routePath, page.target_keyword ?? ""].some(
      (value) => value.toLowerCase().includes(query),
    );
  });
}

export function sortSeoPages(
  pages: Tables<"seo_pages">[],
  sort: SeoPageSortKey,
) {
  const next = [...pages];
  if (sort === "title-asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sort === "published-desc") {
    return next.sort((a, b) => {
      const left = a.published_at ? new Date(a.published_at).getTime() : 0;
      const right = b.published_at ? new Date(b.published_at).getTime() : 0;
      return right - left;
    });
  }
  return next.sort((a, b) => {
    const left = new Date(a.updated_at).getTime();
    const right = new Date(b.updated_at).getTime();
    return sort === "updated-asc" ? left - right : right - left;
  });
}

export function adminPagesHref({
  status,
  q,
  sort,
  page,
  perPage,
}: {
  status: SeoPageStatusFilter;
  q?: string;
  sort?: SeoPageSortKey;
  page?: number;
  perPage?: SeoPageSize;
}) {
  return buildAdminListHref(
    "/admin/pages",
    { status, q, sort, page, perPage },
    {
      status: "active",
      sort: "updated-desc",
      page: 1,
      perPage: defaultSeoPageSize,
    },
  );
}

export function countPagesByStatus(pages: Tables<"seo_pages">[]) {
  return pages.reduce(
    (counts, page) => {
      if (page.status === "draft") counts.draft += 1;
      if (page.status === "published") counts.published += 1;
      if (page.status === "archived") counts.archived += 1;
      if (page.status !== "archived") counts.active += 1;
      return counts;
    },
    { active: 0, draft: 0, published: 0, archived: 0 },
  );
}
