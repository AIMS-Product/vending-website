import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SearchConsoleClient } from "@/lib/search-console/client";
import { channelDailyKey } from "./channel-daily";

const mocks = vi.hoisted(() => ({
  config: {
    GA4_SERVICE_ACCOUNT_JSON: undefined as string | undefined,
    GSC_SITE_URL: undefined as string | undefined,
  },
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));

import { channelRow, syncSearchConsole } from "./search-console-sync";

const now = new Date("2026-09-23T11:50:00.000Z");

function buildClient({
  upsertError = null as { message: string } | null,
} = {}) {
  const upserts: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((name: string) => {
    if (name === "channel_sync_runs") {
      return {
        insert: vi.fn(
          async (row: Record<string, unknown>) => (
            runs.push(row),
            { error: null }
          ),
        ),
      };
    }
    return {
      upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        upserts.push(...rows);
        return { error: upsertError };
      }),
    };
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

function fakeSearchConsole(
  fetchDailyTotals: SearchConsoleClient["fetchDailyTotals"],
): SearchConsoleClient {
  return { fetchDailyTotals: vi.fn(fetchDailyTotals), listSites: vi.fn() };
}

describe("syncSearchConsole", () => {
  it("writes each day's impressions and clicks onto Organic search", async () => {
    const { client, upserts, runs } = buildClient();
    const searchConsole = fakeSearchConsole(async () => [
      { day: "2026-09-19", clicks: 41, impressions: 2310 },
      { day: "2026-09-20", clicks: 38, impressions: 1998 },
    ]);

    const result = await syncSearchConsole({ client, searchConsole, now });

    // Ten days ending yesterday.
    expect(searchConsole.fetchDailyTotals).toHaveBeenCalledWith({
      startDate: "2026-09-13",
      endDate: "2026-09-22",
    });
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toMatchObject({
      day: "2026-09-19",
      channel: "Organic search",
      source: "google-search-console",
      medium: "organic",
      campaign: "(not set)",
      content: "(not set)",
      destination: "unknown",
      impressions: 2310,
      clicks: 41,
    });
    // Only its own two metrics: GA4's visits on any key are never touched.
    expect(Object.keys(upserts[0]!)).not.toContain("visits");
    expect(result.connector).toEqual({
      connector: "search-console",
      rowsWritten: 2,
      error: null,
    });
    expect(runs[0]).toMatchObject({
      connector: "search-console",
      error: null,
    });
  });

  it("widens the window for a backfill", async () => {
    const { client } = buildClient();
    const searchConsole = fakeSearchConsole(async () => []);

    await syncSearchConsole({ client, searchConsole, now, days: 480 });

    expect(searchConsole.fetchDailyTotals).toHaveBeenCalledWith({
      startDate: "2025-05-31",
      endDate: "2026-09-22",
    });
  });

  it("records a skip, not an empty run, when the property is not configured", async () => {
    const { client, upserts, runs } = buildClient();
    mocks.config.GA4_SERVICE_ACCOUNT_JSON = "{}";
    mocks.config.GSC_SITE_URL = undefined;

    const result = await syncSearchConsole({ client, now });

    expect(result.connector.error).toBe("skipped: GSC_SITE_URL is not set.");
    expect(upserts).toHaveLength(0);
    expect(runs[0]).toMatchObject({
      error: "skipped: GSC_SITE_URL is not set.",
    });
  });

  it("records a skip when the GA4 key is missing", async () => {
    const { client } = buildClient();
    mocks.config.GA4_SERVICE_ACCOUNT_JSON = undefined;
    mocks.config.GSC_SITE_URL = "sc-domain:vendingpreneurs.com";

    const result = await syncSearchConsole({ client, now });

    expect(result.connector.error).toMatch(
      /^skipped: GA4_SERVICE_ACCOUNT_JSON/,
    );
  });

  it("records an API refusal as a failed run", async () => {
    const { client, runs } = buildClient();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const searchConsole = fakeSearchConsole(async () => {
      throw new Error(
        "Search Console request failed with HTTP 403: User does not have sufficient permission",
      );
    });

    const result = await syncSearchConsole({ client, searchConsole, now });

    expect(result.connector.rowsWritten).toBe(0);
    expect(result.connector.error).toMatch(/^Error: .*HTTP 403/);
    expect(result.connector.error?.startsWith("skipped:")).toBe(false);
    expect(runs[0]?.error).toBe(result.connector.error);
    logged.mockRestore();
  });

  it("reports rows that failed to write", async () => {
    const { client } = buildClient({ upsertError: { message: "boom" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const searchConsole = fakeSearchConsole(async () => [
      { day: "2026-09-19", clicks: 41, impressions: 2310 },
    ]);

    const result = await syncSearchConsole({ client, searchConsole, now });

    expect(result.connector.error).toBe(
      "1 rows failed to write; see the server log.",
    );
    logged.mockRestore();
  });
});

describe("channelRow", () => {
  it("keys on its own source, which resolves to Organic search", () => {
    const key = channelDailyKey(
      channelRow({ day: "2026-09-19", clicks: 1, impressions: 2 }),
    );
    expect(key).toEqual({
      day: "2026-09-19",
      channel: "Organic search",
      source: "google-search-console",
      medium: "organic",
      campaign: "(not set)",
      content: "(not set)",
      destination: "unknown",
    });
  });
});
