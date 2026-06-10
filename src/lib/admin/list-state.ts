export type SearchParamValue = string | string[] | undefined;

export type PaginationState<TItem> = {
  totalPages: number;
  currentPage: number;
  pageStart: number;
  visibleItems: TItem[];
  displayStart: number;
  displayEnd: number;
  paginationPages: number[];
};

export function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeSearchParam(
  value: string | undefined,
  maxLength = 120,
) {
  return value?.trim().slice(0, maxLength) ?? "";
}

export function normalizePositivePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function normalizeStringOption<TOption extends string>(
  value: string | undefined,
  allowed: readonly TOption[],
  fallback: TOption,
): TOption {
  return allowed.includes(value as TOption) ? (value as TOption) : fallback;
}

export function normalizeNumberOption<TOption extends number>(
  value: string | undefined,
  allowed: readonly TOption[],
  fallback: TOption,
): TOption {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  return allowed.includes(parsed as TOption) ? (parsed as TOption) : fallback;
}

function paginationWindow(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  return Array.from(
    { length: Math.max(0, end - start + 1) },
    (_, index) => start + index,
  );
}

export function paginateItems<TItem>(
  items: TItem[],
  requestedPage: number,
  pageSize: number,
): PaginationState<TItem> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  return {
    totalPages,
    currentPage,
    pageStart,
    visibleItems: items.slice(pageStart, pageStart + pageSize),
    displayStart: items.length === 0 ? 0 : pageStart + 1,
    displayEnd: Math.min(pageStart + pageSize, items.length),
    paginationPages: paginationWindow(currentPage, totalPages),
  };
}

export function buildAdminListHref(
  path: string,
  params: Record<string, string | number | undefined>,
  defaults: Record<string, string | number>,
) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (defaults[key] === value) continue;
    queryParams.set(key, String(value));
  }

  const query = queryParams.toString();
  return query ? `${path}?${query}` : path;
}
