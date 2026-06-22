import { afterEach, describe, expect, it, vi } from "vitest";

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(20),
  SUPABASE_SERVICE_ROLE_KEY: "s".repeat(20),
};

describe("publicConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults public URLs to the production canonical host", async () => {
    stubConfigEnv();

    const { publicConfig } = await import("./config");

    expect(publicConfig.siteUrl).toBe("https://www.vendingpreneurs.com");
  });

  it("trims the configured public site URL", async () => {
    stubConfigEnv("https://www.vendingpreneurs.com\n");

    const { publicConfig } = await import("./config");

    expect(publicConfig.siteUrl).toBe("https://www.vendingpreneurs.com");
  });
});

function stubConfigEnv(siteUrl?: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", requiredEnv.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    requiredEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  vi.stubEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    requiredEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
}
