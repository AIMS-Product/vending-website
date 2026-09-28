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

function buildClient() {
  const upserts: Record<string, unknown[]> = {};
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () =>
        Promise.resolve({
          data: table === "seo_keywords" ? KEYWORDS : [],
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

const fake = (): DataForSeoClient => ({
  serp: vi.fn(async (k: string) => serp(k)),
  searchVolume: vi.fn(async () => []),
  keywordDifficulty: vi.fn(async () => []),
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
    expect(dataforseo.serp).toHaveBeenCalledTimes(1);
    expect(upserts.seo_rank_snapshots).toHaveLength(1);
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

describe("time budget", () => {
  it("keeps what it pulled and says how many it left for next time", async () => {
    const { client, upserts } = buildClient();
    let t = 0;
    const result = await syncSeoRanks({
      client,
      dataforseo: fake(),
      full: true,
      now: new Date("2026-09-21T13:00:00Z"),
      clock: () => (t += 1000),
      budgetMs: 1500,
    });
    // First batch (both keywords) runs; the budget is spent before volumes.
    expect(upserts.seo_rank_snapshots).toHaveLength(2);
    expect(result.volumesRefreshed).toBe(false);
  });

  it("does not fail the snapshots when the volume refresh throws", async () => {
    const { client, upserts } = buildClient();
    const dataforseo = fake();
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
    expect(result.connector.rowsWritten).toBe(2);
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
