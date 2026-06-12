import { beforeEach, describe, expect, it, vi } from "vitest";
import BuilderPrefixPage, { generateMetadata } from "./page";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";
import { hasPublishedPostSlug } from "@/lib/services/news";
import { listRoutePrefixes } from "@/lib/services/route-prefixes";
import { notFound, permanentRedirect, redirect } from "next/navigation";

const renderBuilderPage = vi.fn();
const generateBuilderPageMetadata = vi.fn();
const getBuilderRedirectBySourcePath = vi.fn();

vi.mock("@/lib/page-builder/public-page-route", () => ({
  generateBuilderPageMetadata: (...args: unknown[]) =>
    generateBuilderPageMetadata(...args),
  renderBuilderPage: (...args: unknown[]) => renderBuilderPage(...args),
}));

vi.mock("@/lib/services/seo-page-public", () => ({
  getPublishedSeoPageByPath: vi.fn(),
  getBuilderRedirectBySourcePath: (...args: unknown[]) =>
    getBuilderRedirectBySourcePath(...args),
}));

vi.mock("@/lib/services/news", () => ({
  hasPublishedPostSlug: vi.fn(),
}));

vi.mock("@/lib/services/route-prefixes", () => ({
  listRoutePrefixes: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // Mirror Next's contract: these functions throw to terminate rendering.
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const DEFAULT_PREFIXES = [
  { prefix: "/resources", label: "Resources", isDefault: true },
  { prefix: "/blog", label: "Blog", isDefault: true },
  { prefix: "/landing", label: "Landing", isDefault: true },
  { prefix: "/videos", label: "Videos", isDefault: true },
  { prefix: "/solutions", label: "Solutions", isDefault: true },
];

const WITH_CUSTOM_PREFIX = [
  ...DEFAULT_PREFIXES,
  { prefix: "/services", label: "Services", isDefault: false },
];

function buildProps(builderPath: string[]) {
  return {
    params: Promise.resolve({ builderPath }),
    searchParams: Promise.resolve({}),
  };
}

describe("builder catch-all page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderBuilderPage.mockResolvedValue(null);
    generateBuilderPageMetadata.mockResolvedValue({});
    getBuilderRedirectBySourcePath.mockResolvedValue(null);
    vi.mocked(listRoutePrefixes).mockResolvedValue(DEFAULT_PREFIXES as never);
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(null);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(false);
  });

  it.each([["resources"], ["blog"], ["landing"], ["videos"], ["solutions"]])(
    "renders builder pages for the legacy /%s prefix",
    async (segment) => {
      await BuilderPrefixPage(buildProps([segment, "some-page"]));

      expect(renderBuilderPage).toHaveBeenCalledWith({
        routePrefix: `/${segment}`,
        slug: "some-page",
        searchParams: expect.any(Promise),
      });
      expect(notFound).not.toHaveBeenCalled();
    },
  );

  it("renders builder pages under a configured custom prefix", async () => {
    vi.mocked(listRoutePrefixes).mockResolvedValue(WITH_CUSTOM_PREFIX as never);

    await BuilderPrefixPage(buildProps(["services", "coffee-guide"]));

    expect(renderBuilderPage).toHaveBeenCalledWith({
      routePrefix: "/services",
      slug: "coffee-guide",
      searchParams: expect.any(Promise),
    });
  });

  it("404s for a prefix that is not configured", async () => {
    await expect(
      BuilderPrefixPage(buildProps(["junk", "some-page"])),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(renderBuilderPage).not.toHaveBeenCalled();
  });

  it("404s for paths that are not exactly /{prefix}/{slug}", async () => {
    await expect(BuilderPrefixPage(buildProps(["resources"]))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      BuilderPrefixPage(buildProps(["resources", "a", "b"])),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(renderBuilderPage).not.toHaveBeenCalled();
  });

  it("serves a redirect row for a renamed custom-prefix page", async () => {
    vi.mocked(listRoutePrefixes).mockResolvedValue(WITH_CUSTOM_PREFIX as never);
    getBuilderRedirectBySourcePath.mockResolvedValue({
      source_path: "/services/old-slug",
      destination_path: "/services/new-slug",
      status_code: 301,
    });

    await expect(
      BuilderPrefixPage(buildProps(["services", "old-slug"])),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(getBuilderRedirectBySourcePath).toHaveBeenCalledWith(
      "/services/old-slug",
    );
    expect(permanentRedirect).toHaveBeenCalledWith("/services/new-slug");
    expect(renderBuilderPage).not.toHaveBeenCalled();
  });

  it("leaves default-prefix redirects to the proxy (no redirect lookup)", async () => {
    await BuilderPrefixPage(buildProps(["resources", "some-page"]));

    expect(getBuilderRedirectBySourcePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});

describe("builder catch-all page — legacy /blog news redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderBuilderPage.mockResolvedValue(null);
    getBuilderRedirectBySourcePath.mockResolvedValue(null);
    vi.mocked(listRoutePrefixes).mockResolvedValue(DEFAULT_PREFIXES as never);
  });

  it("permanently redirects to /news/{slug} when no builder page exists but a published news post does", async () => {
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(null);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(true);

    await expect(
      BuilderPrefixPage(
        buildProps([
          "blog",
          "how-to-choose-the-perfect-location-for-vending-machine",
        ]),
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

    await BuilderPrefixPage(buildProps(["blog", "nonexistent-junk-slug"]));

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

    await BuilderPrefixPage(buildProps(["blog", "some-builder-page"]));

    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(hasPublishedPostSlug).not.toHaveBeenCalled();
    expect(renderBuilderPage).toHaveBeenCalledWith({
      routePrefix: "/blog",
      slug: "some-builder-page",
      searchParams: expect.any(Promise),
    });
  });
});

describe("builder catch-all generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateBuilderPageMetadata.mockResolvedValue({ title: "ok" });
    getBuilderRedirectBySourcePath.mockResolvedValue(null);
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(null);
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(false);
    vi.mocked(listRoutePrefixes).mockResolvedValue(WITH_CUSTOM_PREFIX as never);
  });

  it("builds metadata for a configured custom prefix", async () => {
    await expect(
      generateMetadata(buildProps(["services", "coffee-guide"])),
    ).resolves.toEqual({ title: "ok" });

    expect(generateBuilderPageMetadata).toHaveBeenCalledWith(
      "/services",
      "coffee-guide",
    );
  });

  it("404s metadata for an unconfigured prefix", async () => {
    await expect(
      generateMetadata(buildProps(["junk", "coffee-guide"])),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(generateBuilderPageMetadata).not.toHaveBeenCalled();
  });
});
