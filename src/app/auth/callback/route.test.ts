import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  const verifyOtp = vi.fn();
  return {
    createClient: vi.fn(() => ({
      auth: { exchangeCodeForSession, verifyOtp },
    })),
    exchangeCodeForSession,
    verifyOtp,
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
    mocks.verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies a recovery token_hash and redirects to the reset form", async () => {
    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?token_hash=th1&type=recovery&next=%2Fadmin%2Freset-password",
      ),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "th1",
    });
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/reset-password",
    );
  });

  it("ignores a token_hash whose type is not recovery", async () => {
    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?token_hash=th1&type=signup",
      ),
    );

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/forgot-password?error=missing_code",
    );
  });

  it("sends an expired token_hash back to forgot password", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });

    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?token_hash=th1&type=recovery&next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/forgot-password?error=exchange_failed",
    );
  });

  it("never follows an off-site next after a valid token_hash", async () => {
    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?token_hash=th1&type=recovery&next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/reset-password",
    );
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

  it("preserves the reset email through recovery redirects", async () => {
    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?code=abc&next=%2Fadmin%2Freset-password%3Femail%3Dadmin%2540example.com&email=admin%40example.com",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/reset-password?email=admin%40example.com",
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

  it("preserves email when recovery links fail", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "expired" },
    });

    const response = await GET(
      request(
        "https://vending-website.vercel.app/auth/callback?code=abc&email=admin%40example.com",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://vending-website.vercel.app/admin/forgot-password?error=exchange_failed&email=admin%40example.com",
    );
  });
});
