import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminShell } from "./AdminShell";

vi.mock("@/app/admin/actions", () => ({
  signOut: vi.fn(),
}));

function renderShell(
  activeSection: Parameters<typeof AdminShell>[0]["activeSection"],
) {
  return renderToStaticMarkup(
    <AdminShell
      activeSection={activeSection}
      title="Studio"
      userEmail="admin@example.com"
    >
      content
    </AdminShell>,
  );
}

describe("AdminShell navigation", () => {
  it("renders the Blog and news link in the Content nav", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/news"');
    expect(html).toContain("Blog and news");
  });

  it("marks Blog and news as the active page when on /admin/news", () => {
    const html = renderShell("posts");

    // The active nav item carries aria-current="page" on its link to /admin/news.
    const newsLink = html.match(/<a[^>]*href="\/admin\/news"[^>]*>/);
    expect(newsLink).not.toBeNull();
    expect(newsLink?.[0]).toContain('aria-current="page"');
  });

  it("keeps the existing Content and Account nav links rendering", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/pages"');
    expect(html).toContain("SEO pages");
    expect(html).toContain('href="/admin/media"');
    expect(html).toContain("Media library");
    expect(html).toContain('href="/admin/settings/users"');
    expect(html).toContain("Settings");
  });
});
