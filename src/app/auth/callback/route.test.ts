import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  return {
    createClient: vi.fn(() => ({ auth: { exchangeCodeForSession } })),
    exchangeCodeForSession,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

function request(url: string) {
  return new NextRequest(url);
}

describe("auth callback recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the recovery code and redirects to the reset form", async () => {
    const response = await GET(
      request("https://vending-website.vercel.app/auth/callback?code=abc"),
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/reset-password",
    );
  });

  it("redirects failed recovery links back to forgot password", async () => {
    const response = await GET(
      request("https://vending-website.vercel.app/auth/callback"),
    );

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/forgot-password?error=missing_code",
    );
  });
});
