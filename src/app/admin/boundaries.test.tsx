import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/admin/analytics" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));
vi.mock("@/app/admin/actions", () => ({ signOut: vi.fn() }));

import AdminError from "./error";
import AdminNotFound from "./not-found";

describe("admin error boundary", () => {
  it("keeps the Studio sidebar and offers a retry plus a way back", () => {
    pathname.value = "/admin/analytics";
    const html = renderToStaticMarkup(
      <AdminError
        error={Object.assign(new Error("db down"), { digest: "abc123" })}
        unstable_retry={() => {}}
      />,
    );
    expect(html).toContain("This page could not load");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("abc123");
    // The sidebar is still there, so the admin can reach another tab.
    expect(html).toContain('href="/admin/leads"');
    // Never the public error page's styling.
    expect(html).not.toContain("bg-sky-700");
  });

  it("drops the sidebar on signed-out screens", () => {
    pathname.value = "/admin/login";
    const html = renderToStaticMarkup(
      <AdminError error={new Error("boom")} unstable_retry={() => {}} />,
    );
    expect(html).toContain("Try again");
    expect(html).not.toContain('href="/admin/leads"');
  });
});

describe("admin not-found", () => {
  it("stays inside the Studio instead of the public 404", () => {
    const html = renderToStaticMarkup(<AdminNotFound />);
    expect(html).toContain("does not exist or was deleted");
    expect(html).toContain('href="/admin/leads"');
    expect(html).not.toContain("Member stories");
  });
});
