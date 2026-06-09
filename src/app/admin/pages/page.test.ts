import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPagesPage from "./page";
import { adminListSeoPages } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Tables } from "@/types/database";

vi.mock("@/app/admin/pages/actions", () => ({
  archiveSeoPageFromList: vi.fn(),
  duplicateSeoPageFromList: vi.fn(),
  moveSeoPageToDraftFromList: vi.fn(),
  publishSeoPageFromList: vi.fn(),
}));

vi.mock("@/lib/services/seo-pages", () => ({
  adminListSeoPages: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: vi.fn(),
}));

describe("AdminPagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com" },
      role: "super_admin",
    });
  });

  it("preserves governance view across sort, page-size, and pagination links", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue(
      Array.from({ length: 51 }, (_, index) =>
        seoPage({ id: `page_${index}`, slug: `failed-page-${index}` }),
      ),
    );

    const page = await AdminPagesPage({
      searchParams: Promise.resolve({
        view: "schedule-failed",
        page: "2",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain(
      "/admin/pages?view=schedule-failed&amp;sort=title-asc",
    );
    expect(html).toContain("/admin/pages?view=schedule-failed&amp;perPage=10");
    expect(html).toContain("/admin/pages?view=schedule-failed&amp;page=3");
    expect(html).toContain('class="w-[44%] px-7 py-4"');
    expect(html).not.toContain(">Workflow</th>");
    expect(html).toContain('class="w-[12%] px-5 py-4 text-right"');
    expect(html).not.toContain("/admin/pages?sort=title-asc");
    expect(html).not.toContain("/admin/pages?perPage=10");
    expect(html).not.toContain("/admin/pages?page=3");
    expect(html).not.toContain("/admin/pages/authors");
  });
});

function seoPage(
  overrides: Partial<Tables<"seo_pages">> = {},
): Tables<"seo_pages"> {
  const slug = overrides.slug ?? "failed-page";
  return {
    id: overrides.id ?? `page_${slug}`,
    slug,
    title: overrides.title ?? "Failed schedule",
    route_prefix: "/resources",
    route_path: `/resources/${slug}`,
    status: "draft",
    target_keyword: "vending",
    draft_content: { version: 1, sections: [] },
    draft_settings: null,
    published_content: null,
    published_revision_id: null,
    seo_title: "Failed schedule",
    meta_description: "A page with a failed schedule.",
    canonical_url: null,
    noindex: false,
    sitemap_enabled: true,
    structured_data_settings: { breadcrumb: true, faq: true },
    internal_tags: [],
    topic_cluster: null,
    campaign_label: null,
    funnel_stage: null,
    review_period_months: 6,
    next_review_at: null,
    lifecycle_status: "drafting",
    scheduled_publish_at: "2026-06-03T16:30:00.000Z",
    scheduled_publish_status: "failed",
    scheduled_publish_error: "Add SEO title.",
    scheduled_publish_attempts: 1,
    scheduled_publish_last_attempt_at: "2026-06-03T16:30:00.000Z",
    scheduled_publish_locked_at: null,
    footer_variant: "default",
    page_type: "resource",
    template_key: "blank",
    og_asset_id: null,
    og_title: null,
    og_description: null,
    archive_behavior: "not_found",
    archive_redirect_url: null,
    published_at: null,
    archived_at: null,
    created_by: "admin_1",
    updated_by: "admin_1",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-03T00:00:00.000Z",
    ...overrides,
  } as Tables<"seo_pages">;
}
