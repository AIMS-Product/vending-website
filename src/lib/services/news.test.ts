import { describe, expect, it, vi } from "vitest";
import {
  getPublishedPostBySlug,
  hasPublishedPostSlug,
  listPublishedPosts,
} from "./news";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);

  return {
    query,
    anonClient: {
      from: vi.fn().mockReturnValue(query),
    },
    createAnonClient: vi.fn(),
    createServerClient: vi.fn(),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAnonClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

describe("getPublishedPostBySlug", () => {
  it("uses the anon public client so missing SSG news slugs can 404", async () => {
    mocks.createAnonClient.mockReturnValue(mocks.anonClient);
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const post = await getPublishedPostBySlug("missing-post");

    expect(post).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.anonClient.from).toHaveBeenCalledWith("news_posts");
    expect(mocks.query.eq).toHaveBeenCalledWith("status", "published");
    expect(mocks.query.eq).toHaveBeenCalledWith("slug", "missing-post");
  });
});

describe("hasPublishedPostSlug", () => {
  it("checks published news existence through the anon public client", async () => {
    mocks.createAnonClient.mockReturnValue(mocks.anonClient);
    mocks.query.maybeSingle.mockResolvedValue({
      data: { id: "post_1" },
      error: null,
    });

    await expect(hasPublishedPostSlug("published-post")).resolves.toBe(true);

    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.anonClient.from).toHaveBeenCalledWith("news_posts");
    expect(mocks.query.select).toHaveBeenCalledWith("id");
    expect(mocks.query.eq).toHaveBeenCalledWith("status", "published");
    expect(mocks.query.eq).toHaveBeenCalledWith("slug", "published-post");
  });
});

describe("listPublishedPosts", () => {
  it("reads through the cookie-free anon client so /news can be cached", async () => {
    mocks.createAnonClient.mockReturnValue(mocks.anonClient);
    mocks.query.range.mockResolvedValue({
      data: [{ slug: "a" }],
      error: null,
    });

    const posts = await listPublishedPosts({ limit: 30 });

    expect(posts).toEqual([{ slug: "a" }]);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.query.eq).toHaveBeenCalledWith("status", "published");
    expect(mocks.query.range).toHaveBeenCalledWith(0, 29);
  });

  it("throws on a database error instead of returning an empty list", async () => {
    mocks.createAnonClient.mockReturnValue(mocks.anonClient);
    mocks.query.range.mockResolvedValue({
      data: null,
      error: { message: "connection reset" },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(listPublishedPosts()).rejects.toThrow(
      "Could not load published news posts.",
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
