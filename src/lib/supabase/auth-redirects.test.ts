import { describe, expect, it } from "vitest";
import {
  ADMIN_AFTER_LOGIN_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_RESET_PASSWORD_PATH,
  AUTH_CALLBACK_PATH,
  resolveAuthEmailOrigin,
  adminPathWithEmail,
  authErrorMessage,
  buildPasswordResetRedirectUrl,
  normalizeAdminEmailParam,
  normalizeRecoveryNextPath,
  normalizeAdminNextPath,
  supabaseAuthErrorRedirectPath,
  supabaseAuthErrorRedirectPathFromUrlParts,
} from "./auth-redirects";

describe("admin auth redirects", () => {
  it("builds password reset links through the server callback route", () => {
    expect(
      buildPasswordResetRedirectUrl("https://vending-website.vercel.app"),
    ).toBe(
      `https://vending-website.vercel.app${AUTH_CALLBACK_PATH}?next=%2Fadmin%2Freset-password`,
    );
    expect(
      buildPasswordResetRedirectUrl("https://vending-website.vercel.app/"),
    ).toBe(
      `https://vending-website.vercel.app${AUTH_CALLBACK_PATH}?next=%2Fadmin%2Freset-password`,
    );
    expect(
      buildPasswordResetRedirectUrl(
        "https://vending-website.vercel.app",
        "Admin@Example.com",
      ),
    ).toBe(
      `https://vending-website.vercel.app${AUTH_CALLBACK_PATH}?next=%2Fadmin%2Freset-password%3Femail%3Dadmin%2540example.com&email=admin%40example.com`,
    );
  });

  it("normalizes email query params used across auth forms", () => {
    expect(normalizeAdminEmailParam(" Admin@Example.com ")).toBe(
      "admin@example.com",
    );
    expect(normalizeAdminEmailParam("bad")).toBe("");
    expect(adminPathWithEmail("/admin/login", "Admin@Example.com")).toBe(
      "/admin/login?email=admin%40example.com",
    );
    expect(adminPathWithEmail("/admin/login?error=missing_code", "bad")).toBe(
      "/admin/login?error=missing_code",
    );
  });

  it("keeps recovery callback redirects on the reset form", () => {
    expect(
      normalizeRecoveryNextPath(
        "/admin/reset-password?email=Admin%40Example.com",
      ),
    ).toBe("/admin/reset-password?email=admin%40example.com");
    expect(normalizeRecoveryNextPath("/admin/pages", "Admin@Example.com")).toBe(
      "/admin/reset-password?email=admin%40example.com",
    );
  });

  it("keeps post-login redirects inside admin routes", () => {
    expect(normalizeAdminNextPath("/admin/pages")).toBe("/admin/pages");
    expect(normalizeAdminNextPath("/admin/news/123")).toBe("/admin/news/123");
    expect(normalizeAdminNextPath("/admin/login")).toBe(ADMIN_AFTER_LOGIN_PATH);
    expect(normalizeAdminNextPath(ADMIN_RESET_PASSWORD_PATH)).toBe(
      ADMIN_AFTER_LOGIN_PATH,
    );
    expect(normalizeAdminNextPath("https://evil.example/admin")).toBe(
      ADMIN_AFTER_LOGIN_PATH,
    );
    expect(normalizeAdminNextPath("//evil.example/admin")).toBe(
      ADMIN_AFTER_LOGIN_PATH,
    );
    expect(normalizeAdminNextPath("/resources/foo")).toBe(
      ADMIN_AFTER_LOGIN_PATH,
    );
  });

  it("maps auth errors to user-safe messages", () => {
    expect(authErrorMessage("missing_code")).toContain("could not be used");
    expect(authErrorMessage("exchange_failed")).toContain("expired");
    expect(authErrorMessage(null)).toBeNull();
  });

  it("maps Supabase expired link errors to the reset request screen", () => {
    expect(
      supabaseAuthErrorRedirectPath(
        new URLSearchParams(
          "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        ),
      ),
    ).toBe("/admin/forgot-password?error=exchange_failed");

    expect(
      supabaseAuthErrorRedirectPath(
        new URLSearchParams(
          "error=access_denied&error_description=Email+link+has+expired",
        ),
      ),
    ).toBe("/admin/forgot-password?error=exchange_failed");

    expect(
      supabaseAuthErrorRedirectPath(
        new URLSearchParams("error=server_error&error_code=unexpected"),
      ),
    ).toBeNull();
  });

  it("checks Supabase auth errors in both query strings and URL fragments", () => {
    expect(
      supabaseAuthErrorRedirectPathFromUrlParts(
        "",
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=ignored",
      ),
    ).toBe("/admin/forgot-password?error=exchange_failed");

    expect(
      supabaseAuthErrorRedirectPathFromUrlParts(
        "?error=access_denied&error_code=otp_expired",
        "",
      ),
    ).toBe("/admin/forgot-password?error=exchange_failed");
  });

  it("keeps exported auth route constants stable", () => {
    expect(ADMIN_LOGIN_PATH).toBe("/admin/login");
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
    expect(ADMIN_RESET_PASSWORD_PATH).toBe("/admin/reset-password");
  });
});

describe("resolveAuthEmailOrigin", () => {
  const siteUrl = "https://www.vendingpreneurs.com";

  it("ignores a forged x-forwarded-host and falls back to the site URL", () => {
    // The whole point: a recovery email must never be addressed to a host the
    // caller picked, or clicking it hands the one-time code to an attacker.
    expect(
      resolveAuthEmailOrigin({
        host: "evil.tld",
        proto: "https",
        siteUrl,
        isProduction: true,
      }),
    ).toBe(siteUrl);
  });

  it("ignores a lookalike host and a foreign vercel.app deployment", () => {
    for (const host of [
      "www.vendingpreneurs.com.evil.tld",
      "attacker-project.vercel.app",
      "wwwXvendingpreneurs.com",
    ]) {
      expect(
        resolveAuthEmailOrigin({
          host,
          proto: "https",
          siteUrl,
          isProduction: true,
        }),
      ).toBe(siteUrl);
    }
  });

  it("honors the configured site host", () => {
    expect(
      resolveAuthEmailOrigin({
        host: "www.vendingpreneurs.com",
        proto: "https",
        siteUrl,
        isProduction: true,
      }),
    ).toBe(siteUrl);
  });

  it("honors the platform-injected deployment host so previews still work", () => {
    // VERCEL_URL is set by the platform, not by the request, so it is trusted.
    expect(
      resolveAuthEmailOrigin({
        host: "vending-website-abc123.vercel.app",
        proto: "https",
        siteUrl,
        deploymentHost: "vending-website-abc123.vercel.app",
        isProduction: true,
      }),
    ).toBe("https://vending-website-abc123.vercel.app");
  });

  it("allows localhost only outside production", () => {
    expect(
      resolveAuthEmailOrigin({
        host: "localhost:3000",
        proto: "http",
        siteUrl,
        isProduction: false,
      }),
    ).toBe("http://localhost:3000");
    expect(
      resolveAuthEmailOrigin({
        host: "localhost:3000",
        proto: "http",
        siteUrl,
        isProduction: true,
      }),
    ).toBe(siteUrl);
  });

  it("falls back when the host is missing or unparseable", () => {
    expect(
      resolveAuthEmailOrigin({ host: null, siteUrl, isProduction: true }),
    ).toBe(siteUrl);
    expect(
      resolveAuthEmailOrigin({
        host: "not a host::::",
        siteUrl,
        isProduction: true,
      }),
    ).toBe(siteUrl);
  });
});
