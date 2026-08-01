import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  const byKey = new Map(securityHeaders.map((h) => [h.key, h.value]));

  it("sends a Referrer-Policy that keeps qualification tokens out of Referer", () => {
    // The token is a bearer credential sitting in the URL path, so a policy
    // that forwards full URLs cross-origin hands it to third parties.
    const value = byKey.get("Referrer-Policy");
    expect(value).toBeDefined();
    expect(value).not.toBe("unsafe-url");
    expect(value).not.toBe("no-referrer-when-downgrade");
    expect(value).toBe("strict-origin-when-cross-origin");
  });

  it("refuses cross-origin framing so the admin cannot be UI-redressed", () => {
    expect(byKey.get("X-Frame-Options")).toMatch(/^(SAMEORIGIN|DENY)$/);
  });

  it("sets nosniff and HSTS", () => {
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    const hsts = byKey.get("Strict-Transport-Security") ?? "";
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    // Preloading is irreversible and belongs to the domain owner, not to code.
    expect(hsts).not.toContain("preload");
  });

  it("declares every header with a non-empty key and value", () => {
    for (const header of securityHeaders) {
      expect(header.key.length).toBeGreaterThan(0);
      expect(header.value.length).toBeGreaterThan(0);
    }
    expect(byKey.size).toBe(securityHeaders.length);
  });
});
