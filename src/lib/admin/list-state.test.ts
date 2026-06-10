import { describe, expect, it } from "vitest";
import {
  buildAdminListHref,
  firstParam,
  normalizeNumberOption,
  normalizePositivePage,
  normalizeSearchParam,
  normalizeStringOption,
  paginateItems,
} from "@/lib/admin/list-state";
import {
  adminMediaHref,
  buildMediaListState,
  parseMediaListParams,
  type MediaListAsset,
} from "@/lib/admin/media-list";
import {
  adminNewsHref,
  buildNewsListState,
  parseNewsListParams,
} from "@/lib/admin/news-list";
import {
  adminPagesHref,
  buildSeoPageListState,
  parseSeoPageListParams,
} from "@/lib/admin/seo-pages-list";
import type { MediaCollection } from "@/lib/media/collections";
import type { NewsPost } from "@/lib/services/news";
import type { Tables } from "@/types/database";

describe("admin list-state helpers", () => {
  it("normalizes common list params and paginates bounded windows", () => {
    expect(firstParam(["draft", "published"])).toBe("draft");
    expect(normalizeSearchParam("  route plan  ")).toBe("route plan");
    expect(normalizePositivePage("-2")).toBe(1);
    expect(
      normalizeStringOption(
        "title-asc",
        ["updated-desc", "title-asc"],
        "updated-desc",
      ),
    ).toBe("title-asc");
    expect(normalizeNumberOption("24", [12, 24, 48] as const, 12)).toBe(24);

    expect(paginateItems(["a", "b", "c", "d", "e"], 3, 2)).toMatchObject({
      totalPages: 3,
      currentPage: 3,
      visibleItems: ["e"],
      displayStart: 5,
      displayEnd: 5,
      paginationPages: [1, 2, 3],
    });
    expect(
      buildAdminListHref(
        "/admin/pages",
        { status: "active", q: "route", page: 1 },
        { status: "active", page: 1 },
      ),
    ).toBe("/admin/pages?q=route");
  });

  it("builds SEO page list state without route-local filtering branches", () => {
    const pages = [
      seoPage({
        title: "Archived page",
        slug: "archived-page",
        status: "archived",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
      seoPage({
        title: "Route plan",
        slug: "route-plan",
        status: "draft",
        target_keyword: "vending route",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
      seoPage({
        title: "Published guide",
        slug: "published-guide",
        status: "published",
        published_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      }),
    ];
    const params = parseSeoPageListParams({
      q: " route ",
      sort: "title-asc",
      perPage: "25",
    });
    const state = buildSeoPageListState(pages, params);

    expect(state.visiblePages.map((page) => page.title)).toEqual([
      "Route plan",
    ]);
    expect(state.pageCounts).toMatchObject({
      active: 2,
      draft: 1,
      published: 1,
      archived: 1,
    });
    expect(adminPagesHref({ status: "draft", q: "route", perPage: 50 })).toBe(
      "/admin/pages?status=draft&q=route&perPage=50",
    );
  });

  it("exposes failed scheduled publishes as a governance filter", () => {
    const pages = [
      seoPage({
        title: "Scheduled guide",
        slug: "scheduled-guide",
        scheduled_publish_status: "scheduled",
      }),
      seoPage({
        title: "Failed schedule",
        slug: "failed-schedule",
        scheduled_publish_status: "failed",
        scheduled_publish_error: "Add SEO title.",
      }),
      seoPage({
        title: "Ordinary draft",
        slug: "ordinary-draft",
      }),
    ];

    const scheduled = buildSeoPageListState(
      pages,
      parseSeoPageListParams({ view: "scheduled" }),
    );
    const failed = buildSeoPageListState(
      pages,
      parseSeoPageListParams({ view: "schedule-failed" }),
    );

    expect(scheduled.visiblePages.map((page) => page.slug)).toEqual([
      "scheduled-guide",
    ]);
    expect(failed.visiblePages.map((page) => page.slug)).toEqual([
      "failed-schedule",
    ]);
    expect(adminPagesHref({ status: "active", view: "schedule-failed" })).toBe(
      "/admin/pages?view=schedule-failed",
    );
  });

  it("builds media list state with filters, chips, and href defaults", () => {
    const assets = [
      mediaAsset({
        id: "asset_1",
        title: "Hero image",
        asset_type: "image",
        storage_path: "hero.png",
        tags: ["hero", "resource"],
        created_at: "2026-02-01T00:00:00.000Z",
      }),
      mediaAsset({
        id: "asset_2",
        title: "Launch video",
        asset_type: "video",
        external_url: "https://example.com/video",
        tags: [],
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const usageIndex = { asset_1: 2, asset_2: 0 };
    const collectionCounts = mediaCollectionCounts({ all: 2, "in-use": 1 });
    const params = parseMediaListParams({
      type: "image",
      tag: " HERO ",
      view: "list",
      perPage: "24",
    });
    const state = buildMediaListState({
      assets,
      usageIndex,
      collectionCounts,
      params,
    });

    expect(state.visibleAssets.map((asset) => asset.title)).toEqual([
      "Hero image",
    ]);
    expect(state.activeFilterChips.map((chip) => chip.key)).toEqual([
      "type",
      "tag",
    ]);
    expect(adminMediaHref({ q: "hero", type: "image", view: "list" })).toBe(
      "/admin/media?q=hero&type=image&view=list",
    );
  });

  it("builds news list state and hrefs outside the route component", () => {
    const posts = [
      newsPost({
        title: "Route update",
        slug: "route-update",
        status: "draft",
        updated_at: "2026-04-02T00:00:00.000Z",
      }),
      newsPost({
        title: "Published story",
        slug: "published-story",
        status: "published",
        updated_at: "2026-04-01T00:00:00.000Z",
      }),
    ];
    const params = parseNewsListParams({
      status: "draft",
      q: "route",
      sort: "updated-asc",
    });
    const state = buildNewsListState(posts, params);

    expect(state.visiblePosts.map((post) => post.slug)).toEqual([
      "route-update",
    ]);
    expect(state.postCounts).toMatchObject({ draft: 1, published: 1 });
    expect(adminNewsHref({ status: "draft", q: "route", page: 2 })).toBe(
      "/admin/news?status=draft&q=route&page=2",
    );
  });
});

function seoPage(
  overrides: Partial<Tables<"seo_pages">> = {},
): Tables<"seo_pages"> {
  return {
    id: overrides.id ?? `page_${overrides.slug ?? "one"}`,
    title: overrides.title ?? "Page",
    slug: overrides.slug ?? "page",
    status: overrides.status ?? "draft",
    target_keyword: overrides.target_keyword ?? "",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
    published_at: overrides.published_at ?? null,
    scheduled_publish_status: overrides.scheduled_publish_status ?? "none",
    scheduled_publish_error: overrides.scheduled_publish_error ?? null,
    scheduled_publish_at: overrides.scheduled_publish_at ?? null,
  } as Tables<"seo_pages">;
}

function mediaAsset(overrides: Partial<MediaListAsset> = {}): MediaListAsset {
  return {
    id: overrides.id ?? "asset",
    title: overrides.title ?? "Asset",
    asset_type: overrides.asset_type ?? "image",
    storage_path: overrides.storage_path ?? null,
    external_url: overrides.external_url ?? null,
    tags: overrides.tags ?? [],
    alt_text: overrides.alt_text ?? "Alt text",
    source_rights_notes: overrides.source_rights_notes ?? "Owned",
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  } as MediaListAsset;
}

function newsPost(overrides: Partial<NewsPost> = {}): NewsPost {
  return {
    id: overrides.id ?? `post_${overrides.slug ?? "one"}`,
    title: overrides.title ?? "Post",
    slug: overrides.slug ?? "post",
    status: overrides.status ?? "draft",
    excerpt: overrides.excerpt ?? "",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
    published_at: overrides.published_at ?? null,
  } as NewsPost;
}

function mediaCollectionCounts(
  overrides: Partial<Record<MediaCollection, number>>,
): Record<MediaCollection, number> {
  return {
    all: 0,
    "in-use": 0,
    unused: 0,
    "needs-metadata": 0,
    "resource-pages": 0,
    news: 0,
    proof: 0,
    brand: 0,
    ...overrides,
  };
}
