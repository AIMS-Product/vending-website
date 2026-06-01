import { describe, expect, it } from "vitest";
import {
  ADMIN_AFTER_LOGIN_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_RESET_PASSWORD_PATH,
  AUTH_CALLBACK_PATH,
  authErrorMessage,
  buildPasswordResetRedirectUrl,
  normalizeAdminNextPath,
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

  it("keeps exported auth route constants stable", () => {
    expect(ADMIN_LOGIN_PATH).toBe("/admin/login");
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
    expect(ADMIN_RESET_PASSWORD_PATH).toBe("/admin/reset-password");
  });
});
