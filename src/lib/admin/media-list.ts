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
import {
  assetMatchesCollection,
  mediaPurposeFilters,
  mediaStatusFilters,
  normalizeMediaCollection,
  type MediaCollection,
} from "@/lib/media/collections";
import {
  adminListMediaAssets,
  type MediaAssetType,
} from "@/lib/services/media-assets";

export type MediaSearchParams = {
  q?: SearchParamValue;
  type?: SearchParamValue;
  source?: SearchParamValue;
  tag?: SearchParamValue;
  collection?: SearchParamValue;
  view?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
  perPage?: SearchParamValue;
};

export type MediaTypeFilter = "all" | MediaAssetType;
export type MediaSourceFilter =
  | "all"
  | "stored"
  | "external"
  | "tagged"
  | "untagged";
export type MediaViewMode = "grid" | "list";
export type MediaSortKey =
  | "created-desc"
  | "created-asc"
  | "title-asc"
  | "title-desc";
export type MediaPageSize = (typeof mediaPageSizeOptions)[number];
export type MediaListAsset = Awaited<
  ReturnType<typeof adminListMediaAssets>
>[number];

export type MediaFilterContext = {
  q: string;
  type: MediaTypeFilter;
  source: MediaSourceFilter;
  tag: string;
  collection: MediaCollection;
  view: MediaViewMode;
  sort: MediaSortKey;
  perPage: MediaPageSize;
};

export type MediaListParams = MediaFilterContext & {
  page: number;
};

export type MediaListState = MediaListParams & {
  filterContext: MediaFilterContext;
  assetCounts: ReturnType<typeof countAssets>;
  collectionCounts: Record<MediaCollection, number>;
  allTags: string[];
  filteredAssets: MediaListAsset[];
  visibleAssets: MediaListAsset[];
  totalPages: number;
  currentPage: number;
  paginationPages: number[];
  showRowsPerPage: boolean;
  hasActiveFilters: boolean;
  activeFilterChips: Array<{ key: string; label: string; href: string }>;
  resultLabel: string;
};

export const mediaTypeFilters: Array<{
  label: string;
  value: MediaTypeFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Video", value: "video" },
  { label: "Embeds", value: "embed" },
];

export const mediaSourceFilters: Array<{
  label: string;
  value: MediaSourceFilter;
}> = [
  { label: "Stored", value: "stored" },
  { label: "External", value: "external" },
  { label: "Tagged", value: "tagged" },
  { label: "Untagged", value: "untagged" },
];

export const mediaSortLabels: Record<MediaSortKey, string> = {
  "created-desc": "Newest first",
  "created-asc": "Oldest first",
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
};

export const mediaPageSizeOptions = [12, 24, 48] as const;
export const defaultMediaPageSize: MediaPageSize = 12;

export function parseMediaListParams(
  params: MediaSearchParams,
): MediaListParams {
  const collection = normalizeMediaCollection(firstParam(params.collection));

  return {
    q: normalizeSearchParam(firstParam(params.q)),
    type: normalizeStringOption(
      firstParam(params.type),
      ["all", "image", "video", "embed"] as const,
      "all",
    ),
    source: normalizeStringOption(
      firstParam(params.source),
      ["all", "stored", "external", "tagged", "untagged"] as const,
      "all",
    ),
    tag: normalizeSearchParam(firstParam(params.tag), 80).toLowerCase(),
    collection,
    view: normalizeStringOption(
      firstParam(params.view),
      ["grid", "list"] as const,
      "grid",
    ),
    sort: normalizeStringOption(
      firstParam(params.sort),
      ["created-desc", "created-asc", "title-asc", "title-desc"] as const,
      "created-desc",
    ),
    page: normalizePositivePage(firstParam(params.page)),
    perPage: normalizeNumberOption(
      firstParam(params.perPage),
      mediaPageSizeOptions,
      defaultMediaPageSize,
    ),
  };
}

export function buildMediaListState({
  assets,
  usageIndex,
  collectionCounts,
  params,
}: {
  assets: MediaListAsset[];
  usageIndex: Record<string, number>;
  collectionCounts: MediaListState["collectionCounts"];
  params: MediaListParams;
}): MediaListState {
  const filterContext: MediaFilterContext = {
    q: params.q,
    type: params.type,
    source: params.source,
    tag: params.tag,
    collection: params.collection,
    view: params.view,
    sort: params.sort,
    perPage: params.perPage,
  };
  const assetCounts = countAssets(assets, usageIndex);
  const allTags = collectTags(assets);
  const filteredAssets = sortMediaAssets(
    filterMediaAssets(assets, {
      typeFilter: params.type,
      sourceFilter: params.source,
      tagFilter: params.tag,
      collection: params.collection,
      searchQuery: params.q,
      usageIndex,
    }),
    params.sort,
  );
  const pagination = paginateItems(filteredAssets, params.page, params.perPage);
  const hasActiveFilters =
    Boolean(params.q) ||
    params.type !== "all" ||
    params.source !== "all" ||
    params.collection !== "all" ||
    Boolean(params.tag);
  const resultLabel =
    filteredAssets.length === 0
      ? "No assets match"
      : pagination.totalPages > 1
        ? `${pagination.displayStart}-${pagination.displayEnd} of ${filteredAssets.length}`
        : `${filteredAssets.length} asset${filteredAssets.length === 1 ? "" : "s"}`;

  return {
    ...params,
    filterContext,
    assetCounts,
    collectionCounts,
    allTags,
    filteredAssets,
    visibleAssets: pagination.visibleItems,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    paginationPages: pagination.paginationPages,
    showRowsPerPage: filteredAssets.length > defaultMediaPageSize,
    hasActiveFilters,
    activeFilterChips: buildActiveFilterChips({
      filterContext,
      searchQuery: params.q,
      typeFilter: params.type,
      sourceFilter: params.source,
      tagFilter: params.tag,
      collection: params.collection,
    }),
    resultLabel,
  };
}

function buildActiveFilterChips({
  filterContext,
  searchQuery,
  typeFilter,
  sourceFilter,
  tagFilter,
  collection,
}: {
  filterContext: MediaFilterContext;
  searchQuery: string;
  typeFilter: MediaTypeFilter;
  sourceFilter: MediaSourceFilter;
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
        mediaTypeFilters.find((item) => item.value === typeFilter)?.label ??
        typeFilter,
      href: adminMediaHref({ ...filterContext, type: "all" }),
    });
  }

  if (sourceFilter !== "all") {
    chips.push({
      key: "source",
      label:
        mediaSourceFilters.find((item) => item.value === sourceFilter)?.label ??
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

function filterMediaAssets(
  assets: MediaListAsset[],
  {
    typeFilter,
    sourceFilter,
    tagFilter,
    collection,
    searchQuery,
    usageIndex,
  }: {
    typeFilter: MediaTypeFilter;
    sourceFilter: MediaSourceFilter;
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

function sortMediaAssets(assets: MediaListAsset[], sort: MediaSortKey) {
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

function collectTags(assets: MediaListAsset[]) {
  const tags = new Set<string>();
  for (const asset of assets) {
    for (const tag of asset.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function adminMediaHref({
  q,
  type = "all",
  source = "all",
  tag = "",
  collection = "all",
  view = "grid",
  sort = "created-desc",
  page,
  perPage,
}: Partial<MediaFilterContext> & {
  page?: number;
}) {
  return buildAdminListHref(
    "/admin/media",
    { q, type, source, tag, collection, view, sort, page, perPage },
    {
      type: "all",
      source: "all",
      tag: "",
      collection: "all",
      view: "grid",
      sort: "created-desc",
      page: 1,
      perPage: defaultMediaPageSize,
    },
  );
}

function countAssets(
  assets: MediaListAsset[],
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
