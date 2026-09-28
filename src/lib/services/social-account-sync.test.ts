import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricoolTimelines } from "@/lib/metricool/timelines";

vi.mock("@/lib/config", () => ({ config: {} }));

import { syncSocialAccounts } from "./social-account-sync";

function buildClient() {
  const upserts: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn(() => ({
    insert: async (row: Record<string, unknown>) => (
      runs.push(row),
      { error: null }
    ),
    upsert: async (rows: Array<Record<string, unknown>>) => (
      upserts.push(...rows),
      { error: null }
    ),
  }));
  return {
    client: { from } as unknown as Pick<SupabaseClient, "from">,
    upserts,
    runs,
  };
}

describe("syncSocialAccounts", () => {
  it("merges each network's series into one row a day and lets one brand own Facebook", async () => {
    const { client, upserts } = buildClient();
    const timelines: MetricoolTimelines = {
      fetch: vi.fn(async ({ network, metric }) => {
        if (network === "instagram" && metric === "followers")
          return [{ day: "2026-09-01", value: 235 }];
        if (network === "instagram" && metric === "impressions")
          return [{ day: "2026-09-01", value: 900 }];
        if (network === "facebook" && metric === "pageFollows")
          return [{ day: "2026-09-01", value: 142391 }];
        if (network === "instagram" || network === "facebook") return [];
        return null; // not connected
      }),
    };
    const outcome = await syncSocialAccounts({
      client,
      blogIds: ["6626386", "6633336"],
      timelines,
      from: "2026-09-01",
      to: "2026-09-01",
    });

    expect(outcome.error).toBeNull();
    const facebook = upserts.filter((r) => r.network === "facebook");
    expect(facebook).toEqual([
      {
        day: "2026-09-01",
        network: "facebook",
        brand_id: "6626386",
        followers: 142391,
      },
    ]);
    expect(upserts).toContainEqual({
      day: "2026-09-01",
      network: "instagram",
      brand_id: "6633336",
      followers: 235,
      impressions: 900,
    });
  });

  it("skips while Metricool is not configured", async () => {
    const { client } = buildClient();
    const outcome = await syncSocialAccounts({
      client,
      blogIds: [],
      timelines: null,
      from: "2026-09-01",
      to: "2026-09-01",
    });
    expect(outcome.error).toMatch(/^skipped: METRICOOL_API_KEY/);
  });

  it("fails loudly when every request errors", async () => {
    const { client } = buildClient();
    const outcome = await syncSocialAccounts({
      client,
      blogIds: ["1"],
      timelines: {
        fetch: vi.fn(async () => Promise.reject(new Error("HTTP 500"))),
      },
      from: "2026-09-01",
      to: "2026-09-01",
    });
    expect(outcome.error).toMatch(/All \d+ Metricool timeline requests failed/);
  });
});
