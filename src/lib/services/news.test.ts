import { describe, expect, it, vi } from "vitest";
import { getPublishedPostBySlug, hasPublishedPostSlug } from "./news";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

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
