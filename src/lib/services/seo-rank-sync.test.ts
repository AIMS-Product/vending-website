import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DataForSeoClient, SerpSnapshot } from "@/lib/dataforseo/client";

vi.mock("@/lib/config", () => ({ config: {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { snapshotRow, syncSeoRanks } from "./seo-rank-sync";

const KEYWORDS = [
  { keyword: "types of vending machines", role: "primary" },
  { keyword: "combo vending machine", role: "supporting" },
];

function buildClient(spent: number[] = []) {
  const upserts: Record<string, unknown[]> = {};
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () =>
        Promise.resolve({
          data:
            table === "seo_keywords"
              ? KEYWORDS
              : table === "dataforseo_spend"
                ? spent.map((usd) => ({ usd }))
                : [],
          error: null,
        }),
      limit: () =>
        Promise.resolve({ data: [{ video_id: "n9vUTOG-L7Y" }], error: null }),
      insert: async (row: Record<string, unknown>) => {
        runs.push(row);
        return { error: null };
      },
      upsert: async (rows: unknown[]) => {
        (upserts[table] ??= []).push(...rows);
        return { error: null };
      },
    };
    return chain;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

const serp = (keyword: string): SerpSnapshot => ({
  keyword,
  vpPosition: null,
  vpUrl: null,
  aiOverview: true,
  aiOverviewRefs: ["https://www.youtube.com/watch?v=n9vUTOG-L7Y"],
  aioCitesSite: false,
  serpFeatures: ["ai_overview"],
  top10: [],
});

/** A queue holding `ready` finished tasks; ids are the keywords. */
const fake = (
  ready: Array<{ id: string; tag: string | null }> = [],
): DataForSeoClient => ({
  serp: vi.fn(async (k: string) => serp(k)),
  postSerpTasks: vi.fn(async (keywords: string[]) => keywords.length),
  readySerpTasks: vi.fn(async () => ready),
  getSerpTask: vi.fn(async (id: string) => serp(id)),
  searchVolume: vi.fn(async () => []),
  keywordDifficulty: vi.fn(async () => []),
  rankedKeywords: vi.fn(async () => [
    {
      keyword: "vending machine for sale",
      position: 3,
      volume: 9900,
      url: "u",
    },
  ]),
});

describe("syncSeoRanks", () => {
  it("skips with the setup pointer while DataForSEO is not connected", async () => {
    const { client, runs } = buildClient();
    const result = await syncSeoRanks({ client, dataforseo: null });
    expect(result.connector.error).toMatch(/^skipped: DATAFORSEO_LOGIN/);
    expect(runs[0]).toMatchObject({ connector: "dataforseo-ranks" });
  });

  it("ranks primary keywords only on an odd ISO week, not on day 8+", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake();
    // 2026-09-14 is ISO week 38 (even); 2026-09-21 is week 39 (odd).
    const result = await syncSeoRanks({
      client,
      dataforseo,
      now: new Date("2026-09-21T13:00:00Z"),
    });
    expect(result.keywords).toBe(1);
    expect(result.volumesRefreshed).toBe(false);
    expect(dataforseo.postSerpTasks).toHaveBeenCalledWith(
      [KEYWORDS.find((k) => k.role === "primary")!.keyword],
      "2026-09-21",
    );
    expect(dataforseo.serp).not.toHaveBeenCalled();
    expect(upserts.seo_rank_snapshots ?? []).toHaveLength(0);
  });

  it("collects finished tasks dated by the day they were posted", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake([
      { id: "a", tag: "2026-09-14" },
      { id: "b", tag: null },
    ]);
    const result = await syncSeoRanks({
      client,
      dataforseo,
      collectOnly: true,
      now: new Date("2026-09-21T13:50:00Z"),
    });
    expect(dataforseo.postSerpTasks).not.toHaveBeenCalled();
    expect(dataforseo.searchVolume).not.toHaveBeenCalled();
    expect(result.keywords).toBe(0);
    expect(
      (
        upserts.seo_rank_snapshots as Array<{ day: string; keyword: string }>
      ).map((r) => [r.day, r.keyword]),
    ).toEqual([
      ["2026-09-14", "a"],
      ["2026-09-21", "b"],
    ]);
  });

  it("ranks everything and refreshes volumes on a full run", async () => {
    const { client } = buildClient();
    const dataforseo = fake();
    const result = await syncSeoRanks({
      client,
      dataforseo,
      full: true,
      now: new Date("2026-09-21T13:00:00Z"),
    });
    expect(result.keywords).toBe(2);
    expect(result.volumesRefreshed).toBe(true);
    expect(dataforseo.searchVolume).toHaveBeenCalledWith(
      KEYWORDS.map((k) => k.keyword),
    );
  });
});

describe("monthly spend cap", () => {
  it("skips before any paid call once the month's budget is used", async () => {
    const { client } = buildClient([20, 6]);
    const dataforseo = fake();
    const result = await syncSeoRanks({ client, dataforseo, budgetUsd: 25 });
    expect(result.connector.error).toMatch(
      /^skipped: this month's DataForSEO budget is used \(\$26\.00 of \$25\)/,
    );
    expect(dataforseo.postSerpTasks).not.toHaveBeenCalled();
    expect(dataforseo.readySerpTasks).not.toHaveBeenCalled();
  });

  it("pulls competitors on the monthly run", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake();
    await syncSeoRanks({
      client,
      dataforseo,
      full: true,
      now: new Date("2026-09-21T13:00:00Z"),
    });
    expect(dataforseo.rankedKeywords).toHaveBeenCalledTimes(4);
    expect(upserts.seo_competitor_keywords?.[0]).toMatchObject({
      month: "2026-09-01",
      domain: "vendsoft.com",
      keyword: "vending machine for sale",
    });
  });
});

describe("time budget", () => {
  it("keeps what it collected and posts nothing once out of time", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake([
      { id: "a", tag: "2026-09-21" },
      { id: "b", tag: "2026-09-21" },
    ]);
    let t = 0;
    const result = await syncSeoRanks({
      client,
      dataforseo,
      full: true,
      now: new Date("2026-09-21T13:00:00Z"),
      clock: () => (t += 1000),
      budgetMs: 1500,
    });
    expect(upserts.seo_rank_snapshots).toHaveLength(2);
    expect(dataforseo.postSerpTasks).not.toHaveBeenCalled();
    expect(result.volumesRefreshed).toBe(false);
  });

  it("does not fail the collect when the volume refresh throws", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake([
      { id: "a", tag: "2026-09-21" },
      { id: "b", tag: "2026-09-21" },
    ]);
    dataforseo.searchVolume = vi.fn(async () => {
      throw new Error("HTTP 500");
    });
    const result = await syncSeoRanks({
      client,
      dataforseo,
      full: true,
      now: new Date("2026-09-21T13:00:00Z"),
    });
    expect(upserts.seo_rank_snapshots).toHaveLength(2);
    // 2 snapshots + 4 competitor rows; the failed volume refresh costs neither.
    expect(result.connector.rowsWritten).toBe(6);
    expect(result.connector.error).toMatch(/volume refresh failed/);
  });
});

describe("snapshotRow", () => {
  it("marks a YouTube citation as VP's only for a VP video", () => {
    expect(
      snapshotRow("2026-09-28", serp("k"), new Set(["n9vUTOG-L7Y"]))
        .aio_cites_youtube,
    ).toBe(true);
    expect(
      snapshotRow("2026-09-28", serp("k"), new Set(["other"]))
        .aio_cites_youtube,
    ).toBe(false);
  });
});
