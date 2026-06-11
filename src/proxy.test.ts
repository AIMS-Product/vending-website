import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  isDevAdminAuthBypassEnabled: vi.fn(),
  getBuilderRedirectBySourcePath: vi.fn(),
  hasPublishedSeoPagePath: vi.fn(),
  listRoutePrefixes: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mocks.updateSession,
}));

vi.mock("@/lib/supabase/dev-auth", () => ({
  isDevAdminAuthBypassEnabled: mocks.isDevAdminAuthBypassEnabled,
}));

vi.mock("@/lib/services/news", () => ({
  hasPublishedPostSlug: vi.fn(),
}));

vi.mock("@/lib/services/seo-page-public", () => ({
  getBuilderRedirectBySourcePath: mocks.getBuilderRedirectBySourcePath,
  hasPublishedSeoPagePath: mocks.hasPublishedSeoPagePath,
}));

vi.mock("@/lib/services/seo-pages", () => ({
  hasActiveSeoPagePreviewToken: vi.fn(),
}));

vi.mock("@/lib/services/route-prefixes", () => ({
  listRoutePrefixes: mocks.listRoutePrefixes,
}));

function request(path: string) {
  return new NextRequest(`https://vending-website.vercel.app${path}`);
}

describe("proxy admin auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDevAdminAuthBypassEnabled.mockReturnValue(false);
    mocks.getBuilderRedirectBySourcePath.mockResolvedValue(null);
    mocks.hasPublishedSeoPagePath.mockResolvedValue(false);
    mocks.updateSession.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      supabase: { from: mocks.from },
    });
  });

  it("keeps the forgot-password route reachable before sign in", async () => {
    const response = await proxy(request("/admin/forgot-password"));

    expect(mocks.updateSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("routes expired Supabase auth links from the root to forgot password", async () => {
    const response = await proxy(
      request(
        "/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    );

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/forgot-password?error=exchange_failed",
    );
  });

  it("keeps reset-password protected until the recovery session exists", async () => {
    const response = await proxy(request("/admin/reset-password"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/login",
    );
  });

  it("returns 404 for legacy blog author paths", async () => {
    const response = await proxy(request("/blog/author/Mike%20Hoffman"));

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(mocks.hasPublishedSeoPagePath).not.toHaveBeenCalled();
  });
});

describe("proxy legacy blog redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDevAdminAuthBypassEnabled.mockReturnValue(false);
    mocks.getBuilderRedirectBySourcePath.mockResolvedValue(null);
    mocks.hasPublishedSeoPagePath.mockResolvedValue(false);
  });

  it("permanently redirects legacy /blog/{slug} to the published news article", async () => {
    const { hasPublishedPostSlug } = await import("@/lib/services/news");
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(true);

    const response = await proxy(request("/blog/some-published-article"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/news/some-published-article",
    );
  });

  it("keeps unknown legacy /blog slugs as 404", async () => {
    const { hasPublishedPostSlug } = await import("@/lib/services/news");
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(false);

    const response = await proxy(request("/blog/junk-slug"));

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets a published builder page at /blog/{slug} win over the redirect", async () => {
    const { hasPublishedPostSlug } = await import("@/lib/services/news");
    vi.mocked(hasPublishedPostSlug).mockResolvedValue(true);
    mocks.hasPublishedSeoPagePath.mockResolvedValue(true);

    const response = await proxy(request("/blog/some-published-article"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy custom-prefix redirects (S6b-2)", () => {
  const configuredWithServices = [
    { prefix: "/resources", label: "Resources", isDefault: true },
    { prefix: "/blog", label: "Blog", isDefault: true },
    { prefix: "/landing", label: "Landing", isDefault: true },
    { prefix: "/videos", label: "Videos", isDefault: true },
    { prefix: "/solutions", label: "Solutions", isDefault: true },
    { prefix: "/services", label: "Services", isDefault: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDevAdminAuthBypassEnabled.mockReturnValue(false);
    mocks.getBuilderRedirectBySourcePath.mockResolvedValue(null);
    mocks.hasPublishedSeoPagePath.mockResolvedValue(false);
    mocks.listRoutePrefixes.mockResolvedValue(configuredWithServices);
  });

  it("serves a redirect row under a configured custom prefix as a real HTTP redirect", async () => {
    mocks.getBuilderRedirectBySourcePath.mockResolvedValue({
      source_path: "/services/r3-services-routing-proof",
      destination_path: "/services/r3-services-proof-renamed",
      status_code: 301,
    });

    const response = await proxy(
      request("/services/r3-services-routing-proof"),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/services/r3-services-proof-renamed",
    );
    expect(mocks.getBuilderRedirectBySourcePath).toHaveBeenCalledWith(
      "/services/r3-services-routing-proof",
    );
    // Terminal branch: must never reach the admin auth gate.
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("lets configured custom-prefix pages without a redirect row render normally", async () => {
    const response = await proxy(
      request("/services/r3-services-proof-renamed"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("passes through unconfigured two-segment paths without auth gating or redirect lookups", async () => {
    const response = await proxy(request("/wp-admin/setup-config"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.getBuilderRedirectBySourcePath).not.toHaveBeenCalled();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("passes through reserved-segment paths like /authors without builder lookups", async () => {
    const response = await proxy(request("/authors/mike-hoffman"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.listRoutePrefixes).not.toHaveBeenCalled();
    expect(mocks.getBuilderRedirectBySourcePath).not.toHaveBeenCalled();
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("keeps default-prefix redirect rows served exactly as before", async () => {
    mocks.getBuilderRedirectBySourcePath.mockResolvedValue({
      source_path: "/resources/old-page",
      destination_path: "/resources/new-page",
      status_code: 308,
    });

    const response = await proxy(request("/resources/old-page"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/resources/new-page",
    );
    // Default prefixes never consult the configured-prefix list.
    expect(mocks.listRoutePrefixes).not.toHaveBeenCalled();
  });
});
