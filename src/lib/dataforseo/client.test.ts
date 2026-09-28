import { describe, expect, it, vi } from "vitest";
import {
  createDataForSeoClient,
  snapshotFromItems,
  urlsIn,
  youtubeIds,
} from "./client";

const ok = (result: unknown[]) => ({
  status_code: 20000,
  tasks: [{ status_code: 20000, result }],
});

function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: status < 300,
        status,
        text: async () => JSON.stringify(body),
      } as Response;
    },
  );
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const SERP_ITEMS = [
  {
    type: "ai_overview",
    items: [
      {
        type: "ai_overview_element",
        references: [
          { url: "https://www.youtube.com/watch?v=n9vUTOG-L7Y" },
          { url: "https://vendsoft.com/blog/types" },
        ],
      },
    ],
  },
  {
    type: "organic",
    rank_group: 1,
    domain: "vendsoft.com",
    url: "https://vendsoft.com/blog/types",
    title: "Types",
    timestamp: "2023-01-02 00:00:00 +00:00",
  },
  {
    type: "organic",
    rank_group: 2,
    domain: "www.vendingpreneurs.com",
    url: "https://www.vendingpreneurs.com/resources/types-of-vending-machines",
    title: "VP",
  },
  { type: "people_also_ask" },
];

describe("snapshotFromItems", () => {
  it("finds VP's rank, the AI Overview's nested references and features", () => {
    const snap = snapshotFromItems("types of vending machines", SERP_ITEMS);
    expect(snap.vpPosition).toBe(2);
    expect(snap.vpUrl).toContain("/resources/types-of-vending-machines");
    expect(snap.aiOverview).toBe(true);
    expect(snap.aiOverviewRefs).toEqual([
      "https://vendsoft.com/blog/types",
      "https://www.youtube.com/watch?v=n9vUTOG-L7Y",
    ]);
    expect(snap.aioCitesSite).toBe(false);
    expect(snap.serpFeatures).toEqual(["ai_overview", "people_also_ask"]);
    expect(snap.top10[0]).toMatchObject({
      rank: 1,
      domain: "vendsoft.com",
      date: "2023-01-02 00:00:00 +00:00",
    });
  });

  it("counts a VP citation only on VP's own host", () => {
    const snap = snapshotFromItems("x", [
      {
        type: "ai_overview",
        url: "https://notvendingpreneurs.com.evil.io/page",
      },
    ]);
    expect(snap.aioCitesSite).toBe(false);
    const cited = snapshotFromItems("x", [
      { type: "ai_overview", url: "https://www.vendingpreneurs.com/a" },
    ]);
    expect(cited.aioCitesSite).toBe(true);
    const lookalike = snapshotFromItems("x", [
      {
        type: "organic",
        rank_group: 1,
        domain: "notvendingpreneurs.com",
        url: "https://notvendingpreneurs.com/",
      },
      { type: "ai_overview", url: "https://notvendingpreneurs.com/a" },
    ]);
    expect(lookalike.vpPosition).toBeNull();
    expect(lookalike.aioCitesSite).toBe(false);
  });
});

describe("helpers", () => {
  it("urlsIn walks any depth", () => {
    expect(urlsIn({ a: [{ b: { url: "u1" } }, { url: "u2" }] })).toEqual([
      "u1",
      "u2",
    ]);
  });
  it("youtubeIds reads every link style", () => {
    expect(
      youtubeIds([
        "https://www.youtube.com/watch?v=n9vUTOG-L7Y",
        "https://youtu.be/HEq6FaimWeI?si=x",
        "https://www.youtube.com/shorts/abcdefghijk",
        "https://example.com",
      ]),
    ).toEqual(["n9vUTOG-L7Y", "HEq6FaimWeI", "abcdefghijk"]);
  });
});

describe("createDataForSeoClient", () => {
  it("posts a US English live SERP with AI Overview loading, basic auth", async () => {
    const { fetchImpl, calls } = fakeFetch(ok([{ items: SERP_ITEMS }]));
    const client = createDataForSeoClient({
      login: "me@x.com",
      password: "pw",
      fetchImpl,
    });
    const snap = await client.serp("types of vending machines");
    expect(snap.vpPosition).toBe(2);
    expect(calls[0].url).toBe(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
    );
    expect(
      (calls[0].init?.headers as Record<string, string>).Authorization,
    ).toBe(`Basic ${Buffer.from("me@x.com:pw").toString("base64")}`);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual([
      {
        keyword: "types of vending machines",
        location_code: 2840,
        language_code: "en",
        depth: 100,
        load_async_ai_overview: true,
      },
    ]);
  });

  it("throws on a failed task even when the envelope says OK", async () => {
    const { fetchImpl } = fakeFetch({
      status_code: 20000,
      tasks: [{ status_code: 40200, status_message: "Payment Required." }],
    });
    const client = createDataForSeoClient({
      login: "a",
      password: "secret-pw",
      fetchImpl,
    });
    const error = await client.serp("x").catch((e: Error) => e);
    expect(String(error)).toMatch(/40200 Payment Required/);
    expect(String(error)).not.toContain("secret-pw");
  });

  it("reads volume with 12 months of history", async () => {
    const { fetchImpl } = fakeFetch(
      ok([
        {
          keyword: "vending machine business plan",
          search_volume: 8100,
          cpc: 3.83,
          competition: "LOW",
          competition_index: 12,
          monthly_searches: [
            { year: 2026, month: 8, search_volume: 9900 },
            { year: 2026, month: 7, search_volume: null },
          ],
        },
      ]),
    );
    const client = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl,
    });
    expect(
      await client.searchVolume(["vending machine business plan"]),
    ).toEqual([
      {
        keyword: "vending machine business plan",
        volume: 8100,
        cpc: 3.83,
        competition: 0.12,
        monthly: [{ month: "2026-08-01", volume: 9900 }],
      },
    ]);
  });
});

describe("retry on transient failures", () => {
  function sequence(responses: Array<{ status: number; body: unknown }>) {
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      const r = responses[Math.min(i++, responses.length - 1)];
      return {
        ok: r.status < 300,
        status: r.status,
        text: async () => JSON.stringify(r.body),
      } as Response;
    });
    return fetchImpl as unknown as typeof fetch & {
      mock: { calls: unknown[] };
    };
  }
  const serpOk = ok([{ items: [] }]);

  it("retries once on HTTP 403 and succeeds", async () => {
    const fetchImpl = sequence([
      { status: 403, body: {} },
      { status: 200, body: serpOk },
    ]);
    const client = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl,
      retryDelayMs: 0,
    });
    await expect(client.serp("x")).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry", async () => {
    const fetchImpl = sequence([{ status: 503, body: {} }]);
    const client = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl,
      retryDelayMs: 0,
    });
    await expect(client.serp("x")).rejects.toThrow("HTTP 503");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 402 (out of funds)", async () => {
    const fetchImpl = sequence([{ status: 402, body: {} }]);
    const client = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl,
      retryDelayMs: 0,
    });
    await expect(client.serp("x")).rejects.toThrow("HTTP 402");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a task-level 40101", async () => {
    const fetchImpl = sequence([
      {
        status: 200,
        body: { status_code: 20000, tasks: [{ status_code: 40101 }] },
      },
      { status: 200, body: serpOk },
    ]);
    const client = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl,
      retryDelayMs: 0,
    });
    await expect(client.serp("x")).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps a 40106 partial result and records cost even on failure", async () => {
    const costs: number[] = [];
    const partial = sequence([
      {
        status: 200,
        body: {
          status_code: 20000,
          cost: 0.01,
          tasks: [{ status_code: 40106, result: [{ items: [] }] }],
        },
      },
    ]);
    const c1 = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl: partial,
      retryDelayMs: 0,
      onCost: (_, usd) => costs.push(usd),
    });
    await expect(c1.serp("x")).resolves.toBeDefined();
    const failed = sequence([
      {
        status: 200,
        body: {
          status_code: 20000,
          cost: 0.02,
          tasks: [{ status_code: 40501, status_message: "Invalid Field" }],
        },
      },
    ]);
    const c2 = createDataForSeoClient({
      login: "a",
      password: "b",
      fetchImpl: failed,
      retryDelayMs: 0,
      onCost: (_, usd) => costs.push(usd),
    });
    await expect(c2.serp("x")).rejects.toThrow("40501");
    expect(costs).toEqual([0.01, 0.02]);
  });
});
