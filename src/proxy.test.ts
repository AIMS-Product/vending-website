import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  isDevAdminAuthBypassEnabled: vi.fn(),
  getBuilderRedirectBySourcePath: vi.fn(),
  hasPublishedSeoPagePath: vi.fn(),
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
