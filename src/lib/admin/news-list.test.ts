import { describe, expect, it } from "vitest";
import {
  buildNewsListState,
  parseNewsListParams,
  type NewsListPost,
} from "@/lib/admin/news-list";

const baseNewsPost: NewsListPost = {
  id: "post_1",
  slug: "vending-news",
  title: "Vending news",
  excerpt: "News about vending.",
  body: "Body",
  cover_url: null,
  cover_alt: null,
  status: "published",
  published_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

function newsPost(overrides: Partial<NewsListPost> = {}): NewsListPost {
  return { ...baseNewsPost, ...overrides };
}

describe("news list date filter", () => {
  it("filters posts updated on or after the selected date", () => {
    const state = buildNewsListState(
      [
        newsPost({
          id: "old",
          updated_at: "2026-06-09T23:59:59.000Z",
        }),
        newsPost({
          id: "same_day",
          updated_at: "2026-06-10T00:00:00.000Z",
        }),
        newsPost({
          id: "newer",
          updated_at: "2026-06-12T12:00:00.000Z",
        }),
      ],
      parseNewsListParams({ updatedFrom: "2026-06-10" }),
    );

    expect(state.filteredPosts.map((post) => post.id)).toEqual([
      "newer",
      "same_day",
    ]);
  });
});
