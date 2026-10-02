import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPublishedKeyCheck } from "./published-slug-cache";

vi.mock("@/lib/services/news", () => ({
  hasPublishedPostSlug: vi.fn(),
  listPublishedSlugs: vi.fn(),
}));
vi.mock("@/lib/services/case-studies", () => ({
  hasPublishedCaseStudySlug: vi.fn(),
  listPublishedCaseStudySlugs: vi.fn(),
}));
vi.mock("@/lib/services/seo-page-public", () => ({
  hasPublishedSeoPagePath: vi.fn(),
  listPublishedSeoPageRoutePaths: vi.fn(),
}));

const loadKeys = vi.fn<() => Promise<string[]>>();
const checkOne = vi.fn<(key: string) => Promise<boolean>>();

describe("createPublishedKeyCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadKeys.mockResolvedValue(["alpha", "beta"]);
    checkOne.mockResolvedValue(false);
  });

  it("answers a published key from memory with no per-key query", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);

    expect(await check.has("alpha", 1_000)).toBe(true);
    expect(await check.has("beta", 2_000)).toBe(true);

    expect(checkOne).not.toHaveBeenCalled();
    expect(loadKeys).toHaveBeenCalledOnce();
  });

  it("falls through to the per-key query for a key not in the set", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);

    expect(await check.has("missing", 1_000)).toBe(false);
    expect(checkOne).toHaveBeenCalledWith("missing");
  });

  it("sees a page published after the set was loaded (never 404s it)", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);
    await check.has("alpha", 1_000);
    checkOne.mockResolvedValue(true);

    expect(await check.has("fresh-post", 5_000)).toBe(true);
    expect(checkOne).toHaveBeenCalledWith("fresh-post");
  });

  it("reloads the set once the 60s TTL has passed", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);
    await check.has("alpha", 1_000);
    await check.has("alpha", 60_999);
    expect(loadKeys).toHaveBeenCalledOnce();

    await check.has("alpha", 61_001);
    expect(loadKeys).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent requests", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);

    await Promise.all([
      check.has("alpha", 1_000),
      check.has("beta", 1_000),
      check.has("alpha", 1_000),
    ]);

    expect(loadKeys).toHaveBeenCalledOnce();
  });

  it("keeps the original per-key behaviour when the list cannot be loaded", async () => {
    loadKeys.mockRejectedValue(new Error("db down"));
    checkOne.mockResolvedValue(true);
    const check = createPublishedKeyCheck(loadKeys, checkOne);

    expect(await check.has("alpha", 1_000)).toBe(true);
    expect(checkOne).toHaveBeenCalledWith("alpha");
  });

  it("propagates the per-key check's own error (builder pages fail closed)", async () => {
    checkOne.mockRejectedValue(new Error("Failed to load published SEO page"));
    const check = createPublishedKeyCheck(loadKeys, checkOne);

    await expect(check.has("missing", 1_000)).rejects.toThrow(
      "Failed to load published SEO page",
    );
  });

  it("reset forces a reload", async () => {
    const check = createPublishedKeyCheck(loadKeys, checkOne);
    await check.has("alpha", 1_000);
    check.reset();
    await check.has("alpha", 2_000);

    expect(loadKeys).toHaveBeenCalledTimes(2);
  });
});
