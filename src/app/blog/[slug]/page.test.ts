import { beforeEach, describe, expect, it, vi } from "vitest";
import BlogBuilderPage from "./page";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";
import { hasPublishedPostSlug } from "@/lib/services/news";
import { permanentRedirect } from "next/navigation";

const renderBuilderPage = vi.fn();

vi.mock("@/lib/page-builder/public-page-route", () => ({
  generateBuilderPageMetadata: vi.fn(),
  renderBuilderPage: (...args: unknown[]) => renderBuilderPage(...args),
}));

vi.mock("@/lib/services/seo-page-public", () => ({
  getPublishedSeoPageByPath: vi.fn(),
}));

vi.mock("@/lib/services/news", () => ({
  hasPublishedPostSlug: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // Mirror Next's contract: permanentRedirect throws to terminate rendering.
  permanentRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

function buildProps(slug: string) {
  return {
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  };
}

describe("BlogBuilderPage legacy redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderBuilderPage.mockResolvedValue(null);
  });

  it("permanently redirects to /news/{slug} when no builder page exists but a published news post does", async () => {
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(null);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(true);

    await expect(
      BlogBuilderPage(
        buildProps("how-to-choose-the-perfect-location-for-vending-machine"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(permanentRedirect).toHaveBeenCalledWith(
      "/news/how-to-choose-the-perfect-location-for-vending-machine",
    );
    expect(renderBuilderPage).not.toHaveBeenCalled();
  });

  it("does not redirect for an unknown slug — falls through to the builder page (which 404s)", async () => {
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(null);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(false);

    await BlogBuilderPage(buildProps("nonexistent-junk-slug"));

    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(renderBuilderPage).toHaveBeenCalledWith({
      routePrefix: "/blog",
      slug: "nonexistent-junk-slug",
      searchParams: expect.any(Promise),
    });
  });

  it("renders the builder page (does not redirect) when a builder page is published at /blog/{slug}", async () => {
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue({
      route_path: "/blog/some-builder-page",
    } as Awaited<ReturnType<typeof getPublishedSeoPageByPath>>);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(true);

    await BlogBuilderPage(buildProps("some-builder-page"));

    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(hasPublishedPostSlug).not.toHaveBeenCalled();
    expect(renderBuilderPage).toHaveBeenCalledWith({
      routePrefix: "/blog",
      slug: "some-builder-page",
      searchParams: expect.any(Promise),
    });
  });
});
