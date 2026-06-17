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

  it("renders the Content libraries link in the Content nav", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/libraries"');
    expect(html).toContain("Content libraries");
  });

  it("marks Content libraries as the active page when on /admin/libraries", () => {
    const html = renderShell("libraries");

    const librariesLink = html.match(/<a[^>]*href="\/admin\/libraries"[^>]*>/);
    expect(librariesLink).not.toBeNull();
    expect(librariesLink?.[0]).toContain('aria-current="page"');
  });

  it("renders the Qualification forms link in the Content nav", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/forms"');
    expect(html).toContain("Qualification forms");
  });

  it("marks Qualification forms as the active page when on /admin/forms", () => {
    const html = renderShell("forms");

    const formsLink = html.match(/<a[^>]*href="\/admin\/forms"[^>]*>/);
    expect(formsLink).not.toBeNull();
    expect(formsLink?.[0]).toContain('aria-current="page"');
  });

  it("renders the Leads link in the Content nav", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/leads"');
    expect(html).toContain("Leads");
  });

  it("marks Leads as the active page when on /admin/leads", () => {
    const html = renderShell("leads");

    const leadsLink = html.match(/<a[^>]*href="\/admin\/leads"[^>]*>/);
    expect(leadsLink).not.toBeNull();
    expect(leadsLink?.[0]).toContain('aria-current="page"');
  });

  it("renders the Route prefixes link in the Account nav", () => {
    const html = renderShell("pages");

    expect(html).toContain('href="/admin/settings/routes"');
    expect(html).toContain("Route prefixes");
  });

  it("marks Route prefixes as the active page when on /admin/settings/routes", () => {
    const html = renderShell("routes");

    const routesLink = html.match(
      /<a[^>]*href="\/admin\/settings\/routes"[^>]*>/,
    );
    expect(routesLink).not.toBeNull();
    expect(routesLink?.[0]).toContain('aria-current="page"');
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
