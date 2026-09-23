import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { createSearchConsoleClient } from "./client";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const SERVICE_ACCOUNT = JSON.stringify({
  private_key: privateKey,
  client_email: "reader@test-project.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
});

function buildFetch(api: () => { status: number; body: unknown }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const handled = url.includes("oauth2.googleapis.com")
        ? { status: 200, body: { access_token: "t", expires_in: 3599 } }
        : api();
      return {
        ok: handled.status >= 200 && handled.status < 300,
        status: handled.status,
        text: async () => JSON.stringify(handled.body),
      } as unknown as Response;
    },
  );
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

function tokenScope(init?: RequestInit): string {
  const assertion = new URLSearchParams(String(init?.body)).get("assertion");
  const claims = assertion?.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(claims, "base64url").toString()).scope;
}

describe("createSearchConsoleClient", () => {
  it("asks for final web-search totals by date on the encoded property", async () => {
    const { fetchImpl, calls } = buildFetch(() => ({
      status: 200,
      body: {
        rows: [
          { keys: ["2026-09-12"], clicks: 41, impressions: 2310.0 },
          { keys: ["2026-09-13"], clicks: 38, impressions: 1998 },
          { keys: ["not-a-day"], clicks: 1, impressions: 1 },
        ],
      },
    }));
    const client = createSearchConsoleClient({
      serviceAccountJson: SERVICE_ACCOUNT,
      siteUrl: "sc-domain:vendingpreneurs.com",
      fetchImpl,
    });

    const rows = await client.fetchDailyTotals({
      startDate: "2026-09-12",
      endDate: "2026-09-13",
    });

    expect(rows).toEqual([
      { day: "2026-09-12", clicks: 41, impressions: 2310 },
      { day: "2026-09-13", clicks: 38, impressions: 1998 },
    ]);
    const [token, query] = calls;
    expect(tokenScope(token?.init)).toBe(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
    expect(query?.url).toBe(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Avendingpreneurs.com/searchAnalytics/query",
    );
    expect(query?.init?.method).toBe("POST");
    expect(JSON.parse(String(query?.init?.body))).toEqual({
      startDate: "2026-09-12",
      endDate: "2026-09-13",
      dimensions: ["date"],
      type: "web",
      dataState: "final",
      rowLimit: 25000,
      startRow: 0,
    });
  });

  it("throws the API's own message on a refused request", async () => {
    const { fetchImpl } = buildFetch(() => ({
      status: 403,
      body: {
        error: {
          message:
            "User does not have sufficient permission for site 'sc-domain:vendingpreneurs.com'.",
        },
      },
    }));
    const client = createSearchConsoleClient({
      serviceAccountJson: SERVICE_ACCOUNT,
      siteUrl: "sc-domain:vendingpreneurs.com",
      fetchImpl,
    });

    await expect(
      client.fetchDailyTotals({
        startDate: "2026-09-12",
        endDate: "2026-09-13",
      }),
    ).rejects.toThrow(/HTTP 403: User does not have sufficient permission/);
  });

  it("lists the properties the service account was added to", async () => {
    const { fetchImpl, calls } = buildFetch(() => ({
      status: 200,
      body: {
        siteEntry: [
          {
            siteUrl: "sc-domain:vendingpreneurs.com",
            permissionLevel: "siteRestrictedUser",
          },
        ],
      },
    }));
    const client = createSearchConsoleClient({
      serviceAccountJson: SERVICE_ACCOUNT,
      siteUrl: "sc-domain:vendingpreneurs.com",
      fetchImpl,
    });

    expect(await client.listSites()).toEqual([
      {
        siteUrl: "sc-domain:vendingpreneurs.com",
        permissionLevel: "siteRestrictedUser",
      },
    ]);
    expect(calls[1]?.init?.method).toBe("GET");
  });
});
