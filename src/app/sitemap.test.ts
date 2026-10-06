import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/news", () => ({ listPublishedSlugs: vi.fn() }));
vi.mock("@/lib/services/case-studies", () => ({
  listPublishedCaseStudySlugs: vi.fn(),
}));
vi.mock("@/lib/services/seo-page-public", () => ({
  listSitemapSeoPages: vi.fn(),
}));

import sitemap from "./sitemap";
import { absoluteUrl } from "@/lib/site";
import { staticRoutes } from "@/lib/content/site-routes";
import { processSectionIsHeldBack, processSteps } from "@/lib/content/process";
import { solutions } from "@/lib/content/solutions";
import { listPublishedSlugs } from "@/lib/services/news";
import { listPublishedCaseStudySlugs } from "@/lib/services/case-studies";
import { listSitemapSeoPages } from "@/lib/services/seo-page-public";

const urlsOf = async () => (await sitemap()).map((entry) => entry.url);

describe("sitemap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(listPublishedSlugs).mockResolvedValue(["post-a"]);
    vi.mocked(listPublishedCaseStudySlugs).mockResolvedValue(["study-a"]);
    vi.mocked(listSitemapSeoPages).mockResolvedValue([
      {
        slug: "guide-a",
        route_path: "/resources/guide-a",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("still emits static routes and other sources when one source rejects", async () => {
    vi.mocked(listSitemapSeoPages).mockRejectedValue(new Error("db down"));

    const urls = await urlsOf();

    for (const route of staticRoutes) {
      expect(urls).toContain(absoluteUrl(route.path));
    }
    expect(urls).toContain(absoluteUrl("/news/post-a"));
    expect(urls).toContain(absoluteUrl("/case-studies/study-a"));
    expect(urls).not.toContain(absoluteUrl("/resources/guide-a"));
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("seo-pages"),
      expect.any(Error),
    );
  });

  it("emits static routes when every source rejects", async () => {
    vi.mocked(listPublishedSlugs).mockRejectedValue(new Error("x"));
    vi.mocked(listPublishedCaseStudySlugs).mockRejectedValue(new Error("x"));
    vi.mocked(listSitemapSeoPages).mockRejectedValue(new Error("x"));

    const urls = await urlsOf();

    expect(urls).toEqual(
      expect.arrayContaining(staticRoutes.map((r) => absoluteUrl(r.path))),
    );
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it("leaves held-back /solutions and /process pages out", async () => {
    const urls = await urlsOf();

    for (const solution of solutions.filter((s) => s.noindex)) {
      expect(urls).not.toContain(absoluteUrl(`/solutions/${solution.slug}`));
    }
    for (const step of processSteps.filter((s) => s.noindex)) {
      expect(urls).not.toContain(absoluteUrl(`/process/${step.slug}`));
    }
    if (processSectionIsHeldBack) {
      expect(urls).not.toContain(absoluteUrl("/process"));
    }
  });

  it("returns only absolute, unique URLs", async () => {
    const urls = await urlsOf();

    for (const url of urls) {
      expect(new URL(url).protocol).toMatch(/^https?:$/);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });
});
