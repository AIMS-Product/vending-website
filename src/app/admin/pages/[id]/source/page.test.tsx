import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeoPageSourcePage from "./page";
import { adminGetSeoPageById } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

vi.mock("@/lib/services/seo-pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/seo-pages")
  >("@/lib/services/seo-pages");
  return {
    ...actual,
    adminGetSeoPageById: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({ requireAdmin: vi.fn() }));

vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

const publishedContent = {
  version: 1,
  sections: [
    {
      id: "section_1",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "column_1",
          width: "1/1",
          blocks: [
            {
              id: "hero_1",
              type: "hero",
              variant: "standard",
              props: {
                eyebrow: "Guide",
                heading: "Coffee vending guide",
                body: "A short guide for office managers.",
                ctaLabel: "Apply now",
                ctaHref: "/apply",
                ctaTrackingName: "coffee_apply",
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("SeoPageSourcePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com" },
      role: "super_admin",
    });
  });

  it("renders readable published source blocks for manual review", async () => {
    vi.mocked(adminGetSeoPageById).mockResolvedValue({
      id: "page_1",
      slug: "coffee-vending-guide",
      route_prefix: "/blog",
      route_path: "/blog/coffee-vending-guide",
      status: "published",
      title: "Coffee Vending Guide",
      target_keyword: "coffee vending",
      page_type: "blog",
      template_key: null,
      draft_content: publishedContent,
      draft_settings: null,
      published_content: publishedContent,
      published_revision_id: "rev_1",
      seo_title: "Coffee Vending Guide",
      meta_description: "A coffee vending guide.",
      canonical_url: null,
      noindex: false,
      sitemap_enabled: true,
      og_asset_id: null,
      og_title: null,
      og_description: null,
      structured_data_settings: {},
      internal_tags: [],
      topic_cluster: null,
      campaign_label: null,
      funnel_stage: null,
      review_period_months: null,
      next_review_at: null,
      lifecycle_status: "active",
      scheduled_publish_at: null,
      scheduled_publish_status: null,
      scheduled_publish_error: null,
      scheduled_publish_attempts: 0,
      scheduled_publish_last_attempt_at: null,
      scheduled_publish_locked_at: null,
      footer_variant: "default",
      published_at: "2026-06-16T00:00:00.000Z",
      archived_at: null,
      archive_behavior: "not_found",
      archive_redirect_url: null,
      created_by: "admin_1",
      updated_by: "admin_1",
      created_at: "2026-06-15T00:00:00.000Z",
      updated_at: "2026-06-16T00:00:00.000Z",
    } as never);

    const page = await SeoPageSourcePage({
      params: Promise.resolve({ id: "page_1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Readable page source");
    expect(html).toContain("Page summary JSON");
    expect(html).toContain("Structured data JSON-LD");
    expect(html).toContain("Published content JSON");
    expect(html).toContain("Rendered HTML fragment");
    expect(html).toContain("/blog/coffee-vending-guide");
    expect(html).toContain("Coffee vending guide");
    expect(html).toContain("\n  &quot;status&quot;");
    expect(html).toContain("&lt;div");
  });
});
