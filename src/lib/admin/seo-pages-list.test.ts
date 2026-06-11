import { describe, expect, it } from "vitest";
import {
  buildSeoPageListState,
  parseSeoPageListParams,
} from "@/lib/admin/seo-pages-list";
import type { Tables } from "@/types/database";

function seoPage(
  overrides: Partial<Tables<"seo_pages">> = {},
): Tables<"seo_pages"> {
  const slug = overrides.slug ?? "vending-page";
  return {
    id: overrides.id ?? `page_${slug}`,
    slug,
    title: overrides.title ?? "Vending page",
    route_prefix: "/resources",
    route_path: `/resources/${slug}`,
    status: "published",
    target_keyword: "vending",
    draft_content: { version: 1, sections: [] },
    draft_settings: null,
    published_content: null,
    published_revision_id: null,
    seo_title: "Vending machines for workplaces",
    meta_description: "Vending machines for workplaces and staff rooms.",
    canonical_url: null,
    noindex: false,
    sitemap_enabled: true,
    structured_data_settings: { breadcrumb: true, faq: true },
    internal_tags: ["vending"],
    topic_cluster: null,
    campaign_label: null,
    funnel_stage: null,
    review_period_months: 6,
    next_review_at: null,
    lifecycle_status: "approved",
    scheduled_publish_at: null,
    scheduled_publish_status: null,
    scheduled_publish_error: null,
    scheduled_publish_attempts: 0,
    scheduled_publish_last_attempt_at: null,
    scheduled_publish_locked_at: null,
    footer_variant: "default",
    page_type: "resource",
    template_key: "blank",
    og_asset_id: null,
    og_title: null,
    og_description: null,
    archive_behavior: "not_found",
    archive_redirect_url: null,
    published_at: "2026-06-01T00:00:00.000Z",
    archived_at: null,
    created_by: "admin_1",
    updated_by: "admin_1",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z",
    ...overrides,
  } as Tables<"seo_pages">;
}

describe("seo pages list metadata-issues view", () => {
  const params = parseSeoPageListParams({ view: "metadata-issues" });

  it("flags pages whose meta description exceeds the 155-character target", () => {
    const state = buildSeoPageListState(
      [
        seoPage({ id: "page_over", meta_description: "m".repeat(156) }),
        seoPage({ id: "page_at", meta_description: "m".repeat(155) }),
      ],
      params,
    );

    expect(state.filteredPages.map((page) => page.id)).toEqual(["page_over"]);
  });

  it("does not flag a page at exactly 155 characters", () => {
    const state = buildSeoPageListState(
      [seoPage({ id: "page_at", meta_description: "m".repeat(155) })],
      params,
    );

    expect(state.filteredPages).toEqual([]);
  });
});
