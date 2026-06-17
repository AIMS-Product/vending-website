import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderBuilderPage } from "./public-page-route";
import { resolveDefaultQualificationFormVersion } from "@/lib/services/qualification-forms";
import { getPublishedSeoPageByPath } from "@/lib/services/seo-page-public";
import type { LeadAttribution } from "@/lib/lead-attribution";
import type { PageContent } from "@/lib/page-builder/blocks";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/services/seo-page-public", () => ({
  getPublishedSeoPageByPath: vi.fn(),
}));

vi.mock("@/lib/services/qualification-forms", () => ({
  resolveDefaultQualificationFormVersion: vi.fn(),
}));

vi.mock("@/components/sections/ResourcePageRenderer", () => ({
  ResourcePageRenderer: ({
    defaultQualificationFormId,
    leadAttribution,
  }: {
    defaultQualificationFormId?: string | null;
    leadAttribution?: LeadAttribution;
  }) =>
    createElement("div", {
      "data-default-qualification-form-id": defaultQualificationFormId ?? "",
      "data-source-path": leadAttribution?.source_path ?? "",
      "data-utm-source": leadAttribution?.utm_source ?? "",
    }),
}));

const content: PageContent = {
  version: 1,
  sections: [],
};

const page: PublishedSeoPage = {
  id: "page_1",
  slug: "start-vending",
  route_prefix: "/resources",
  route_path: "/resources/start-vending",
  title: "Start Vending",
  target_keyword: "start vending business",
  published_content: content,
  seo_title: "Start Vending SEO",
  meta_description: "A vending guide.",
  canonical_url: null,
  noindex: false,
  sitemap_enabled: true,
  structured_data_settings: {},
  published_at: "2026-06-17T00:00:00.000Z",
  updated_at: "2026-06-17T00:00:00.000Z",
};

describe("renderBuilderPage", () => {
  it("passes request attribution and the global default qualification form to the renderer", async () => {
    vi.mocked(getPublishedSeoPageByPath).mockResolvedValue(
      page as Awaited<ReturnType<typeof getPublishedSeoPageByPath>>,
    );
    vi.mocked(resolveDefaultQualificationFormVersion).mockResolvedValue({
      formId: "form_default",
      versionId: "version_default",
      versionNumber: 1,
      schema: { version: 1, questions: [] },
      questionCount: 0,
      normalizedRoles: [],
      publishedAt: "2026-06-17T00:00:00.000Z",
    });

    const element = await renderBuilderPage({
      routePrefix: "/resources",
      slug: "start-vending",
      searchParams: Promise.resolve({
        source_path: "/resources/start-vending?utm_source=google",
        utm_source: "google",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(getPublishedSeoPageByPath).toHaveBeenCalledWith(
      "/resources/start-vending",
    );
    expect(html).toContain('data-default-qualification-form-id="form_default"');
    expect(html).toContain(
      'data-source-path="/resources/start-vending?utm_source=google"',
    );
    expect(html).toContain('data-utm-source="google"');
  });
});
