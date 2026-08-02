import { describe, expect, it } from "vitest";
import {
  LEAD_MAGNET_FORM_ID,
  leadMagnetPages,
  roadmapLandingPage,
  roadmapThankYouPage,
  financeTemplatesThankYouPage,
} from "@/lib/content/lead-magnets";
import { flattenBlocks, pageContentSchema } from "@/lib/page-builder/blocks";
import { CODED_ROUTE_PATHS } from "@/lib/page-builder/coded-route-paths";
import { resolveResourceQualificationAttachment } from "@/lib/page-builder/resource-lead-attribution";

describe("lead magnet pages", () => {
  it.each(leadMagnetPages.map((page) => [page.slug, page] as const))(
    "%s is valid page-builder content",
    (_slug, page) => {
      const result = pageContentSchema.safeParse(page.published_content);
      if (!result.success) {
        console.error(JSON.stringify(result.error.issues, null, 1));
      }
      expect(result.success).toBe(true);
    },
  );

  it("sends the roadmap form to the right form and thank-you page", () => {
    const block = flattenBlocks(roadmapLandingPage.published_content).find(
      (candidate) => candidate.type === "lead_form",
    );
    expect(block).toBeDefined();

    const resolved = resolveResourceQualificationAttachment({
      page: roadmapLandingPage.published_content,
      block: block as never,
    });
    expect(resolved.formId).toBe(LEAD_MAGNET_FORM_ID);
    expect(resolved.completionRedirectPath).toBe(
      roadmapThankYouPage.route_path,
    );
  });

  // A thank-you page is reachable by anyone with the URL, so it must never be
  // indexed — that is what keeps the gated asset links out of search results.
  it.each([
    ["roadmap", roadmapThankYouPage],
    ["finance", financeTemplatesThankYouPage],
  ])("%s thank-you page stays out of search", (_name, page) => {
    expect(page.noindex).toBe(true);
    expect(page.sitemap_enabled).toBe(false);
  });

  // Without this registration the proxy 404s the path before the route runs,
  // because there is no published seo_pages row behind it.
  it.each(leadMagnetPages.map((page) => [page.route_path] as const))(
    "%s is registered as a coded route with the proxy",
    (routePath) => {
      expect(CODED_ROUTE_PATHS.has(routePath)).toBe(true);
    },
  );

  it("puts a reachable asset link on every thank-you page", () => {
    for (const page of [roadmapThankYouPage, financeTemplatesThankYouPage]) {
      const hero = flattenBlocks(page.published_content).find(
        (block) => block.type === "hero",
      );
      expect(hero?.type === "hero" && hero.props.ctaHref).toMatch(
        /^https:\/\/(drive|docs)\.google\.com\//,
      );
    }
  });
});
