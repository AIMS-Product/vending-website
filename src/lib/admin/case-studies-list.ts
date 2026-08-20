import {
  buildAdminListHref,
  firstParam,
  normalizePositivePage,
  normalizeSearchParam,
  normalizeStringOption,
  paginateItems,
  type SearchParamValue,
} from "@/lib/admin/list-state";
import type { CaseStudy } from "@/lib/services/case-studies";

export type CaseStudiesSearchParams = {
  status?: SearchParamValue;
  q?: SearchParamValue;
  updatedFrom?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
};

export type CaseStudyStatusFilter = "all" | "draft" | "published" | "archived";
export type CaseStudySortKey = "updated-desc" | "updated-asc" | "title-asc";
export type CaseStudiesListParams = {
  status: CaseStudyStatusFilter;
  q: string;
  updatedFrom: string;
  sort: CaseStudySortKey;
  page: number;
};

export type CaseStudyListItem = CaseStudy;

export type CaseStudiesListState = CaseStudiesListParams & {
  caseStudyCounts: ReturnType<typeof countCaseStudiesByStatus>;
  filteredCaseStudies: CaseStudyListItem[];
  visibleCaseStudies: CaseStudyListItem[];
  totalPages: number;
  currentPage: number;
  displayStart: number;
  displayEnd: number;
};

export const caseStudyFilters: Array<{
  label: string;
  value: CaseStudyStatusFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export const caseStudySortLabels: Record<CaseStudySortKey, string> = {
  "updated-desc": "Updated newest",
  "updated-asc": "Updated oldest",
  "title-asc": "Title A-Z",
};

const caseStudyPageSize = 7;
const dateFilterPattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseCaseStudiesListParams(
  params: CaseStudiesSearchParams,
): CaseStudiesListParams {
  return {
    status: normalizeStringOption(
      firstParam(params.status),
      ["all", "draft", "published", "archived"] as const,
      "all",
    ),
    q: normalizeSearchParam(firstParam(params.q)),
    updatedFrom: normalizeDateFilter(firstParam(params.updatedFrom)),
    sort: normalizeStringOption(
      firstParam(params.sort),
      ["updated-desc", "updated-asc", "title-asc"] as const,
      "updated-desc",
    ),
    page: normalizePositivePage(firstParam(params.page)),
  };
}

export function buildCaseStudiesListState(
  caseStudies: CaseStudyListItem[],
  params: CaseStudiesListParams,
): CaseStudiesListState {
  const caseStudyCounts = countCaseStudiesByStatus(caseStudies);
  const filteredCaseStudies = sortCaseStudies(
    filterCaseStudies(caseStudies, params.status, params.q, params.updatedFrom),
    params.sort,
  );
  const pagination = paginateItems(
    filteredCaseStudies,
    params.page,
    caseStudyPageSize,
  );

  return {
    ...params,
    caseStudyCounts,
    filteredCaseStudies,
    visibleCaseStudies: pagination.visibleItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    displayStart: pagination.displayStart,
    displayEnd: pagination.displayEnd,
  };
}

function filterCaseStudies(
  caseStudies: CaseStudyListItem[],
  status: CaseStudyStatusFilter,
  searchQuery: string,
  updatedFrom: string,
) {
  const query = searchQuery.toLowerCase();
  const updatedFromTime = updatedFrom
    ? Date.parse(`${updatedFrom}T00:00:00.000Z`)
    : null;
  return caseStudies.filter((caseStudy) => {
    const matchesStatus = status === "all" || caseStudy.status === status;
    if (!matchesStatus) return false;
    if (
      updatedFromTime !== null &&
      new Date(caseStudy.updated_at).getTime() < updatedFromTime
    ) {
      return false;
    }
    if (!query) return true;

    return [
      caseStudy.title,
      caseStudy.slug,
      caseStudy.member_name,
      caseStudy.excerpt,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query));
  });
}

function normalizeDateFilter(value: string | undefined) {
  const date = normalizeSearchParam(value, 10);
  if (!dateFilterPattern.test(date)) return "";

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10) === date ? date : "";
}

function sortCaseStudies(
  caseStudies: CaseStudyListItem[],
  sort: CaseStudySortKey,
) {
  const next = [...caseStudies];
  if (sort === "title-asc") {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  return next.sort((a, b) => {
    const left = new Date(a.updated_at).getTime();
    const right = new Date(b.updated_at).getTime();
    return sort === "updated-asc" ? left - right : right - left;
  });
}

export function adminCaseStudiesHref({
  status,
  q,
  updatedFrom,
  sort,
  page,
}: {
  status: CaseStudyStatusFilter;
  q?: string;
  updatedFrom?: string;
  sort?: CaseStudySortKey;
  page?: number;
}) {
  return buildAdminListHref(
    "/admin/case-studies",
    { status, q, updatedFrom, sort, page },
    {
      status: "all",
      updatedFrom: "",
      sort: "updated-desc",
      page: 1,
    },
  );
}

function countCaseStudiesByStatus(caseStudies: CaseStudyListItem[]) {
  return caseStudies.reduce(
    (counts, caseStudy) => {
      if (caseStudy.status === "draft") counts.draft += 1;
      if (caseStudy.status === "published") counts.published += 1;
      if (caseStudy.status === "archived") counts.archived += 1;
      return counts;
    },
    { draft: 0, published: 0, archived: 0 },
  );
}
