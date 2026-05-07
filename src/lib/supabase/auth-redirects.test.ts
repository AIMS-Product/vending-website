import { describe, expect, it } from "vitest";
import {
  ADMIN_AFTER_LOGIN_PATH,
  ADMIN_LOGIN_PATH,
  AUTH_CALLBACK_PATH,
  authErrorMessage,
  buildCodeExchangeUrl,
  buildMagicLinkRedirectUrl,
  extractMagicLinkHashTokens,
  normalizeAdminNextPath,
} from "./auth-redirects";

describe("admin auth redirects", () => {
  it("sends magic links to the login page so hash-token callbacks are recoverable", () => {
    expect(
      buildMagicLinkRedirectUrl("https://vending-website.vercel.app"),
    ).toBe(`https://vending-website.vercel.app${ADMIN_LOGIN_PATH}`);
    expect(
      buildMagicLinkRedirectUrl("https://vending-website.vercel.app/"),
    ).toBe(`https://vending-website.vercel.app${ADMIN_LOGIN_PATH}`);
  });

  it("extracts implicit-flow hash session tokens", () => {
    expect(
      extractMagicLinkHashTokens(
        "#access_token=access&expires_in=3600&refresh_token=refresh",
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });

    expect(extractMagicLinkHashTokens("#access_token=access")).toBeNull();
  });

  it("bridges code callbacks from the login page to the server exchange route", () => {
    expect(
      buildCodeExchangeUrl(
        "https://vending-website.vercel.app/admin/login?code=abc&next=%2Fadmin%2Fpages%2Fnew",
      ),
    ).toBe(
      `https://vending-website.vercel.app${AUTH_CALLBACK_PATH}?code=abc&next=%2Fadmin%2Fpages%2Fnew`,
    );

    expect(
      buildCodeExchangeUrl("https://vending-website.vercel.app/admin/login"),
    ).toBeNull();
  });

  it("keeps post-login redirects inside admin routes", () => {
    expect(normalizeAdminNextPath("/admin/pages")).toBe("/admin/pages");
    expect(normalizeAdminNextPath("/admin/news/123")).toBe("/admin/news/123");
    expect(normalizeAdminNextPath("/admin/login")).toBe(ADMIN_AFTER_LOGIN_PATH);
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

  it("maps callback errors to user-safe messages", () => {
    expect(authErrorMessage("missing_code")).toContain("new link");
    expect(authErrorMessage("exchange_failed")).toContain("expired");
    expect(authErrorMessage(null)).toBeNull();
  });
});
