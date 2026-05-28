import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBuilderRedirectBySourcePath,
  getPublishedSeoPageBySlug,
  hasPublishedSeoPageSlug,
  listPublishedSeoPageSlugs,
  listSitemapSeoPages,
} from "./seo-page-public";

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
    client: {
      from: vi.fn().mockReturnValue(query),
    },
    createClient: vi.fn(),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

describe("seo page public service", () => {
  beforeEach(() => {
    mocks.createClient.mockReturnValue(mocks.client);
    mocks.client.from.mockClear();
    mocks.query.select.mockReset();
    mocks.query.eq.mockReset();
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.maybeSingle.mockReset();
  });

  it("lists published resource slugs through the public RLS surface", async () => {
    mocks.query.select.mockResolvedValue({
      data: [{ slug: "start-vending" }],
      error: null,
    });

    await expect(listPublishedSeoPageSlugs()).resolves.toEqual([
      "start-vending",
    ]);
    expect(mocks.client.from).toHaveBeenCalledWith("published_seo_pages");
  });

  it("lists sitemap-eligible resource pages only", async () => {
    mocks.query.eq.mockReturnValueOnce(mocks.query);
    mocks.query.eq.mockResolvedValueOnce({
      data: [{ slug: "start-vending", updated_at: "2026-05-06T00:00:00Z" }],
      error: null,
    });

    await expect(listSitemapSeoPages()).resolves.toEqual([
      { slug: "start-vending", updated_at: "2026-05-06T00:00:00Z" },
    ]);
    expect(mocks.query.eq).toHaveBeenCalledWith("sitemap_enabled", true);
    expect(mocks.query.eq).toHaveBeenCalledWith("noindex", false);
  });

  it("checks whether a published resource slug exists", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: { id: "page_1" },
      error: null,
    });

    await expect(hasPublishedSeoPageSlug("start-vending")).resolves.toBe(true);
    expect(mocks.client.from).toHaveBeenCalledWith("published_seo_pages");
    expect(mocks.query.eq).toHaveBeenCalledWith("slug", "start-vending");
  });

  it("returns a published page only when its snapshot matches the block schema", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: {
        id: "page_1",
        slug: "start-vending",
        title: "Start Vending",
        target_keyword: "start vending business",
        published_content: { version: 1, sections: [] },
        seo_title: "Start a Vending Business",
        meta_description: "A tested resource page.",
        canonical_url: null,
        noindex: false,
        sitemap_enabled: true,
        structured_data_settings: {},
        published_at: "2026-05-06T00:00:00Z",
        updated_at: "2026-05-06T00:00:00Z",
      },
      error: null,
    });

    const page = await getPublishedSeoPageBySlug("start-vending");

    expect(page?.published_content).toEqual({ version: 1, sections: [] });
    expect(mocks.client.from).toHaveBeenCalledWith("published_seo_pages");
    expect(mocks.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("draft_content"),
    );
    expect(mocks.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("draft_settings"),
    );
    expect(mocks.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("created_by"),
    );
    expect(mocks.query.select).toHaveBeenCalledWith(
      expect.not.stringContaining("updated_by"),
    );
    expect(mocks.query.eq).toHaveBeenCalledWith("slug", "start-vending");
  });

  it("returns null for missing or invalid published page snapshots", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    await expect(getPublishedSeoPageBySlug("missing")).resolves.toBeNull();

    mocks.query.maybeSingle.mockResolvedValueOnce({
      data: { slug: "missing-content", published_content: null },
      error: null,
    });
    await expect(
      getPublishedSeoPageBySlug("missing-content"),
    ).resolves.toBeNull();

    mocks.query.maybeSingle.mockResolvedValueOnce({
      data: { slug: "bad-content", published_content: { version: 999 } },
      error: null,
    });
    await expect(getPublishedSeoPageBySlug("bad-content")).resolves.toBeNull();

    expect(errorSpy).toHaveBeenCalledWith(
      "published SEO page content is invalid",
      expect.objectContaining({
        slug: "bad-content",
        issues: expect.any(Array),
      }),
    );
    errorSpy.mockRestore();
  });

  it("returns null or false on public lookup errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "RLS denied" };

    mocks.query.maybeSingle.mockResolvedValueOnce({ data: null, error });
    await expect(
      getPublishedSeoPageBySlug("start-vending"),
    ).resolves.toBeNull();

    mocks.query.maybeSingle.mockResolvedValueOnce({ data: null, error });
    await expect(hasPublishedSeoPageSlug("start-vending")).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalledWith(
      "getPublishedSeoPageBySlug failed",
      error,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "hasPublishedSeoPageSlug failed",
      error,
    );
    errorSpy.mockRestore();
  });

  it("returns a database-backed redirect by source path", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: {
        source_path: "/resources/old",
        destination_path: "/resources/new",
        status_code: 301,
      },
      error: null,
    });

    await expect(
      getBuilderRedirectBySourcePath("/resources/old"),
    ).resolves.toEqual({
      source_path: "/resources/old",
      destination_path: "/resources/new",
      status_code: 301,
    });
  });

  it("returns null when redirect lookup fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "redirect lookup failed" };
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error });

    await expect(
      getBuilderRedirectBySourcePath("/resources/old"),
    ).resolves.toBeNull();

    expect(mocks.client.from).toHaveBeenCalledWith("redirects");
    expect(mocks.query.select).toHaveBeenCalledWith(
      "source_path, destination_path, status_code",
    );
    expect(mocks.query.eq).toHaveBeenCalledWith(
      "source_path",
      "/resources/old",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "getBuilderRedirectBySourcePath failed",
      error,
    );
    errorSpy.mockRestore();
  });
});
