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

describe("Close custom-field env wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Regression: CLOSE_CONTACT_PREFERENCE_FIELD_ID was read by the Close client
  // but never declared in `config`, so it was permanently undefined no matter
  // what production held — and `assignCustom` skips undefined field IDs
  // silently, so the SMS consent answer vanished with a "Synced" status and no
  // error anywhere. Every CLOSE_* id the client reads must be declared here.
  it("declares every CLOSE_* field id the Close client reads from env", async () => {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url"),
    ]);
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const [clientSource, configSource] = await Promise.all([
      readFile(`${dir}close/client.ts`, "utf8"),
      readFile(`${dir}config.ts`, "utf8"),
    ]);

    const readFromEnv = [
      ...new Set(
        [...clientSource.matchAll(/env\.(CLOSE_[A-Z0-9_]+)/g)].map((m) => m[1]),
      ),
    ];
    expect(readFromEnv.length).toBeGreaterThan(0);

    const missing = readFromEnv.filter(
      (name) => !configSource.includes(`process.env.${name}`),
    );
    expect(missing).toEqual([]);
  });

  it("passes the contact preference field id through to the Close config", async () => {
    stubConfigEnv();
    vi.stubEnv("CLOSE_CONTACT_PREFERENCE_FIELD_ID", "cf_sms_consent");

    const { config } = await import("./config");

    expect(config.CLOSE_CONTACT_PREFERENCE_FIELD_ID).toBe("cf_sms_consent");
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
