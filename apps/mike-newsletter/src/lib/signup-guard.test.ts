import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter, sanitizeSource } from "./signup-guard";

describe("sanitizeSource", () => {
  it("keeps the slugs the page actually sends", () => {
    expect(sanitizeSource("hero")).toBe("hero");
    expect(sanitizeSource("closing")).toBe("closing");
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(sanitizeSource("  Hero ")).toBe("hero");
  });

  it("falls back to the default for anything that is not a short slug", () => {
    expect(sanitizeSource(null)).toBe("site");
    expect(sanitizeSource("")).toBe("site");
    expect(sanitizeSource("<script>alert(1)</script>")).toBe("site");
    expect(sanitizeSource("has space")).toBe("site");
    expect(sanitizeSource("a".repeat(65))).toBe("site");
    expect(sanitizeSource(new File([""], "x.txt"))).toBe("site");
  });

  it("accepts the 64 character boundary", () => {
    expect(sanitizeSource("a".repeat(64))).toBe("a".repeat(64));
  });
});

describe("clientIp", () => {
  const headers = (entries: Record<string, string>) =>
    new Headers(entries) as Pick<Headers, "get">;

  it("takes the first x-forwarded-for entry", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("returns null when no address is present", () => {
    expect(clientIp(headers({}))).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit then refuses inside the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 10)).toBe(true);
    expect(limiter.take("a", 20)).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("b", 0)).toBe(true);
    expect(limiter.take("a", 1)).toBe(false);
  });

  it("recovers once the window has passed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("a", 999)).toBe(false);
    expect(limiter.take("a", 1_000)).toBe(true);
  });

  it("does not let a refused attempt extend the lockout", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.take("a", 0);
    limiter.take("a", 900);
    expect(limiter.take("a", 1_000)).toBe(true);
  });

  it("stays bounded by maxKeys", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 3,
    });
    for (let i = 0; i < 50; i += 1) limiter.take(`k${i}`, i);
    // Oldest keys were evicted, so the earliest key is admitted again.
    expect(limiter.take("k0", 100)).toBe(true);
  });
});
