import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  isDevAdminAuthBypassEnabled: vi.fn(),
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
  getBuilderRedirectBySourcePath: vi.fn(),
  hasPublishedSeoPageSlug: vi.fn(),
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

  it("keeps reset-password protected until the recovery session exists", async () => {
    const response = await proxy(request("/admin/reset-password"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/login",
    );
  });
});
