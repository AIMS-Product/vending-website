import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPagesPage from "./page";
import { adminListSeoPages } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";
import type { Tables } from "@/types/database";

vi.mock("@/app/admin/pages/actions", () => ({
  archiveSeoPageFromList: vi.fn(),
  bulkArchiveSeoPagesFromList: vi.fn(),
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

  it("explains what the Schedule failed workflow filter means", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([seoPage()]);

    const page = await AdminPagesPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain(
      'title="Pages whose scheduled publish did not go through and need attention"',
    );
  });

  it("exposes a Redirects link in the list header actions", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([seoPage()]);

    const page = await AdminPagesPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('href="/admin/pages/redirects"');
    expect(html).toContain(">Redirects</a>");
  });

  it("renders a bulk-select checkbox on non-archived rows, wired to the bulk-archive form", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([
      seoPage({ id: "page_draft", slug: "draft-page", status: "draft" }),
    ]);

    const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('name="ids"');
    expect(html).toContain('form="bulk-archive-form"');
    expect(html).toContain('value="page_draft"');
  });

  it("does not render a bulk-select checkbox on archived rows", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([
      seoPage({ id: "page_arch", slug: "arch-page", status: "archived" }),
    ]);

    const page = await AdminPagesPage({
      searchParams: Promise.resolve({ status: "archived" }),
    });
    const html = renderToStaticMarkup(page);

    // No bulk-select checkbox (name="ids") for archived rows — they can't be
    // archived again. (The per-row actions hidden id input is unrelated.)
    expect(html).not.toContain('name="ids"');
  });

  it("shows a visible page-status text label beside the status dot (not colour-only)", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([
      seoPage({ status: "published" }),
    ]);

    const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    // The visible status label renders as its own text node, not only as an
    // aria-label attribute or a hidden tooltip.
    expect(html).toContain(">Published</span>");
  });

  it("shows a visible readiness text label beside the readiness dot", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([seoPage()]);

    const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    // Readiness label words appear as visible text. A blank-content draft is
    // "Blocked"; assert at least one readiness vocabulary word renders.
    expect(html).toMatch(/>(Strong|Opportunities|Needs work|Blocked)<\/span>/);
  });

  it("renders a status/readiness legend explaining the dot vocabulary", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([seoPage()]);

    const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('aria-label="Status and readiness legend"');
    // Legend covers every page-status and readiness state by name.
    for (const word of [
      "Published",
      "Draft",
      "Archived",
      "Strong",
      "Needs work",
      "Blocked",
    ]) {
      expect(html).toContain(word);
    }
  });

  it("keeps an accessible name on each status dot", async () => {
    vi.mocked(adminListSeoPages).mockResolvedValue([
      seoPage({ status: "published" }),
    ]);

    const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('aria-label="Page status: Published"');
  });

  // S9 / C140: deterministic create-success feedback.
  describe("created-page success feedback", () => {
    const createdId = "11111111-1111-4111-8111-111111111111";

    it("renders a success banner with an Open page link when ?created matches a page", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({ id: createdId, slug: "brand-new", title: "Brand new page" }),
      ]);

      const page = await AdminPagesPage({
        searchParams: Promise.resolve({ created: createdId }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).toContain("Brand new page");
      expect(html).toContain('role="status"');
      expect(html).toContain(`href="/admin/pages/${createdId}"`);
      expect(html).toContain("Open page");
    });

    it("highlights the newly created row", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({ id: createdId, slug: "brand-new", title: "Brand new page" }),
      ]);

      const page = await AdminPagesPage({
        searchParams: Promise.resolve({ created: createdId }),
      });
      const html = renderToStaticMarkup(page);

      // The matching row carries the highlight marker so it stands out without
      // the admin manually searching for it.
      expect(html).toContain('data-created-row="true"');
    });

    it("does not render the banner without the created param", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({ id: createdId, slug: "brand-new", title: "Brand new page" }),
      ]);

      const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);

      expect(html).not.toContain("Open page");
      expect(html).not.toContain('data-created-row="true"');
    });

    it("does not render the banner when ?created does not match any page", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({ id: createdId, slug: "brand-new" }),
      ]);

      const page = await AdminPagesPage({
        searchParams: Promise.resolve({
          created: "99999999-9999-4999-8999-999999999999",
        }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).not.toContain("Open page");
      expect(html).not.toContain('data-created-row="true"');
    });

    it("places the newest page at the top of the default (updated-desc) order", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({
          id: "old",
          slug: "older-page",
          title: "Older page",
          updated_at: "2026-06-01T00:00:00.000Z",
        }),
        seoPage({
          id: createdId,
          slug: "newest-page",
          title: "Newest page",
          updated_at: "2026-06-10T00:00:00.000Z",
        }),
      ]);

      const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);

      // Default sort is updated-desc, so the freshest row renders before the
      // older one — a just-created page lands at the top without a sort change.
      expect(html.indexOf("Newest page")).toBeLessThan(
        html.indexOf("Older page"),
      );
    });
  });

  // S15 / C137: schedule-failed surfaced in the KPI strip.
  describe("schedule-failed KPI surfacing", () => {
    it("surfaces the schedule-failed count with a link to the filter when > 0", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({
          id: "f1",
          slug: "failed-1",
          scheduled_publish_status: "failed",
        }),
        seoPage({
          id: "f2",
          slug: "failed-2",
          scheduled_publish_status: "failed",
        }),
        seoPage({
          id: "ok",
          slug: "ok-page",
          scheduled_publish_status: "none",
        }),
      ]);

      const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);

      // The KPI alert carries a dedicated marker so it is distinct from the
      // always-present "Schedule failed" workflow filter chip.
      expect(html).toContain('data-kpi="schedule-failed"');
      expect(html).toContain("/admin/pages?view=schedule-failed");
      // Red/alert tone for a failure surface.
      expect(html).toMatch(/bg-red-50|text-red-700|border-red-200/);
      expect(html).toContain(">2<");
    });

    it("renders nothing extra when no page is in the schedule-failed state", async () => {
      vi.mocked(adminListSeoPages).mockResolvedValue([
        seoPage({
          id: "ok",
          slug: "ok-page",
          scheduled_publish_status: "none",
        }),
      ]);

      const page = await AdminPagesPage({ searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);

      // No schedule-failed KPI affordance at a zero count. (The workflow filter
      // chip "Schedule failed" still exists; the KPI strip surface does not.)
      expect(html).not.toContain('data-kpi="schedule-failed"');
    });
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
