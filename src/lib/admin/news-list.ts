import {
  buildAdminListHref,
  firstParam,
  normalizePositivePage,
  normalizeSearchParam,
  normalizeStringOption,
  paginateItems,
  type SearchParamValue,
} from "@/lib/admin/list-state";
import type { NewsPost } from "@/lib/services/news";

export type NewsSearchParams = {
  status?: SearchParamValue;
  q?: SearchParamValue;
  updatedFrom?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
};

export type NewsStatusFilter = "all" | "draft" | "published" | "archived";
export type NewsSortKey = "updated-desc" | "updated-asc" | "title-asc";
export type NewsListParams = {
  status: NewsStatusFilter;
  q: string;
  updatedFrom: string;
  sort: NewsSortKey;
  page: number;
};

export type NewsListPost = NewsPost;

export type NewsListState = NewsListParams & {
  postCounts: ReturnType<typeof countPostsByStatus>;
  filteredPosts: NewsListPost[];
  visiblePosts: NewsListPost[];
  totalPages: number;
  currentPage: number;
  displayStart: number;
  displayEnd: number;
};

export const newsFilters: Array<{ label: string; value: NewsStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export const newsSortLabels: Record<NewsSortKey, string> = {
  "updated-desc": "Updated newest",
  "updated-asc": "Updated oldest",
  "title-asc": "Title A-Z",
};

const newsPageSize = 7;
const dateFilterPattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseNewsListParams(params: NewsSearchParams): NewsListParams {
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

export function buildNewsListState(
  posts: NewsListPost[],
  params: NewsListParams,
): NewsListState {
  const postCounts = countPostsByStatus(posts);
  const filteredPosts = sortNewsPosts(
    filterNewsPosts(posts, params.status, params.q, params.updatedFrom),
    params.sort,
  );
  const pagination = paginateItems(filteredPosts, params.page, newsPageSize);

  return {
    ...params,
    postCounts,
    filteredPosts,
    visiblePosts: pagination.visibleItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    displayStart: pagination.displayStart,
    displayEnd: pagination.displayEnd,
  };
}

function filterNewsPosts(
  posts: NewsListPost[],
  status: NewsStatusFilter,
  searchQuery: string,
  updatedFrom: string,
) {
  const query = searchQuery.toLowerCase();
  const updatedFromTime = updatedFrom
    ? Date.parse(`${updatedFrom}T00:00:00.000Z`)
    : null;
  return posts.filter((post) => {
    const matchesStatus = status === "all" || post.status === status;
    if (!matchesStatus) return false;
    if (
      updatedFromTime !== null &&
      new Date(post.updated_at).getTime() < updatedFromTime
    ) {
      return false;
    }
    if (!query) return true;

    return [post.title, post.slug, post.excerpt]
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

function sortNewsPosts(posts: NewsListPost[], sort: NewsSortKey) {
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

export function adminNewsHref({
  status,
  q,
  updatedFrom,
  sort,
  page,
}: {
  status: NewsStatusFilter;
  q?: string;
  updatedFrom?: string;
  sort?: NewsSortKey;
  page?: number;
}) {
  return buildAdminListHref(
    "/admin/news",
    { status, q, updatedFrom, sort, page },
    {
      status: "all",
      updatedFrom: "",
      sort: "updated-desc",
      page: 1,
    },
  );
}

function countPostsByStatus(posts: NewsListPost[]) {
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
