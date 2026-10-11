import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { googleAdsSyncSpendCheck } from "./data-audit-google-ads-checks";

const window = { from: "2026-10-05", to: "2026-10-08", label: "Oct 5-8" };

function client(rows: Array<{ day: string; cost: number }>) {
  const chain: Record<string, unknown> = {};
  for (const m of ["gte", "lte", "order", "not", "eq"]) chain[m] = () => chain;
  chain.select = () => chain;
  chain.range = async () => ({ data: rows, error: null });
  return { from: () => chain } as never;
}

const ga4 = (spend: number[]) => ({
  fetchGoogleAdsCampaigns: async () =>
    spend.map((s, i) => ({
      day: "2026-10-05",
      id: String(i),
      name: "c",
      spend: s,
      impressions: 0,
      clicks: 0,
    })),
});

describe("googleAdsSyncSpendCheck", () => {
  it("passes when the script's spend matches GA4's Google Ads cost", async () => {
    const [result] = await googleAdsSyncSpendCheck(
      client([
        { day: "2026-10-05", cost: 100.5 },
        { day: "2026-10-06", cost: 99.5 },
      ]),
      ga4([150, 50]),
      window,
    );
    expect(result).toMatchObject({
      checkId: "google-ads-sync-spend",
      ours: 200,
      source: 200,
      status: "pass",
    });
  });

  it("fails on drift beyond 1%", async () => {
    const [result] = await googleAdsSyncSpendCheck(
      client([{ day: "2026-10-05", cost: 150 }]),
      ga4([200]),
      window,
    );
    expect(result.status).toBe("fail");
  });

  it("fails loudly when the script wrote nothing while Google spent", async () => {
    const [result] = await googleAdsSyncSpendCheck(
      client([]),
      ga4([42]),
      window,
    );
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("stopped");
  });

  it("reports unverified, not passed, without GA4", async () => {
    const [result] = await googleAdsSyncSpendCheck(client([]), null, window);
    expect(result).toMatchObject({
      checkId: "google-ads-sync-config",
      status: "fail",
    });
  });
});
