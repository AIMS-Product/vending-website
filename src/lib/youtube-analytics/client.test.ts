import { describe, expect, it, vi } from "vitest";
import { createYouTubeAnalyticsClient, parseRows } from "./client";

const TABLE = {
  columnHeaders: [
    { name: "video" },
    { name: "views" },
    { name: "videoThumbnailImpressions" },
    { name: "cardImpressions" },
    { name: "cardClicks" },
  ],
  rows: [
    ["vid1", 120, 4000, 90, 7],
    ["vid2", 3, 100, 0, 0],
  ],
};

function buildFetch(report: (url: URL) => { status: number; body: unknown }) {
  const calls: URL[] = [];
  let tokenCalls = 0;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") {
      tokenCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ access_token: "at", expires_in: 3600 }),
      } as unknown as Response;
    }
    calls.push(url);
    const handled = report(url);
    return {
      ok: handled.status < 300,
      status: handled.status,
      text: async () => JSON.stringify(handled.body),
    } as unknown as Response;
  });
  return { fetchImpl, calls, tokenCalls: () => tokenCalls };
}

const make = (fetchImpl: typeof fetch) =>
  createYouTubeAnalyticsClient({
    clientId: "cid",
    clientSecret: "sec",
    refreshToken: "rt",
    fetchImpl,
  });

describe("createYouTubeAnalyticsClient", () => {
  it("refreshes once, queries one day with dimensions=video and reads by header", async () => {
    const { fetchImpl, calls, tokenCalls } = buildFetch(() => ({
      status: 200,
      body: TABLE,
    }));
    const client = make(fetchImpl);
    const rows = await client.fetchVideoDay("2026-09-10");
    await client.fetchVideoDay("2026-09-09");
    expect(tokenCalls()).toBe(1);
    expect(calls[0]!.searchParams.get("ids")).toBe("channel==MINE");
    expect(calls[0]!.searchParams.get("dimensions")).toBe("video");
    expect(calls[0]!.searchParams.get("startDate")).toBe("2026-09-10");
    expect(rows).toEqual([
      {
        videoId: "vid1",
        day: "2026-09-10",
        views: 120,
        impressions: 4000,
        cardImpressions: 90,
        cardClicks: 7,
      },
      {
        videoId: "vid2",
        day: "2026-09-10",
        views: 3,
        impressions: 100,
        cardImpressions: 0,
        cardClicks: 0,
      },
    ]);
  });

  it("drops thumbnail impressions after a 400 and leaves them unobserved", async () => {
    const { fetchImpl, calls } = buildFetch((url) =>
      url.searchParams.get("metrics")!.includes("videoThumbnailImpressions")
        ? { status: 400, body: { error: { message: "unsupported metric" } } }
        : {
            status: 200,
            body: {
              columnHeaders: [
                { name: "video" },
                { name: "views" },
                { name: "cardImpressions" },
                { name: "cardClicks" },
              ],
              rows: [["vid1", 10, 2, 1]],
            },
          },
    );
    const rows = await make(fetchImpl).fetchVideoDay("2026-09-10");
    expect(calls).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      videoId: "vid1",
      views: 10,
      impressions: null,
      cardClicks: 1,
    });
  });
});

describe("parseRows", () => {
  it("returns nothing without a video column", () => {
    expect(
      parseRows(
        { columnHeaders: [{ name: "day" }], rows: [["2026-09-10"]] },
        "2026-09-10",
      ),
    ).toEqual([]);
  });
});
