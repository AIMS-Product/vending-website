import { describe, expect, it, vi } from "vitest";
import { createYouTubePlaybackClient } from "./playback";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function client(reports: Array<(url: URL) => Response>) {
  const urls: URL[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com")
      return jsonResponse(200, { access_token: "t", expires_in: 3600 });
    urls.push(url);
    const next = reports.shift();
    if (!next) throw new Error("unexpected report request");
    return next(url);
  });
  return {
    youtube: createYouTubePlaybackClient({
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
    urls,
  };
}

describe("createYouTubePlaybackClient", () => {
  it("asks for one video's days by playback location and reads columns by name", async () => {
    const { youtube, urls } = client([
      () =>
        jsonResponse(200, {
          columnHeaders: [
            { name: "insightPlaybackLocationType" },
            { name: "day" },
            { name: "estimatedMinutesWatched" },
            { name: "views" },
            { name: "engagedViews" },
          ],
          rows: [
            ["EMBEDDED", "2026-10-01", 12.6, 9, 6],
            ["WATCH", "2026-10-01", 40, 30, 28],
          ],
        }),
    ]);
    const rows = await youtube.fetchPlaybackDays(
      "vidA",
      "2026-09-01",
      "2026-10-13",
    );
    expect(urls[0]?.searchParams.get("ids")).toBe("channel==MINE");
    expect(urls[0]?.searchParams.get("dimensions")).toBe(
      "day,insightPlaybackLocationType",
    );
    expect(urls[0]?.searchParams.get("filters")).toBe("video==vidA");
    expect(urls[0]?.searchParams.get("metrics")).toBe(
      "views,engagedViews,estimatedMinutesWatched",
    );
    expect(rows[0]).toEqual({
      videoId: "vidA",
      day: "2026-10-01",
      locationType: "EMBEDDED",
      views: 9,
      engagedViews: 6,
      minutesWatched: 13,
    });
  });

  it("asks for the top 25 embedding pages of a month, sorted by views", async () => {
    const { youtube, urls } = client([
      () =>
        jsonResponse(200, {
          columnHeaders: [
            { name: "insightPlaybackLocationDetail" },
            { name: "views" },
            { name: "engagedViews" },
            { name: "estimatedMinutesWatched" },
          ],
          rows: [["https://www.vendingpreneurs.com/masterclass", 40, 31, 90]],
        }),
    ]);
    const pages = await youtube.fetchEmbedPages(
      "vidA",
      "2026-10-01",
      "2026-10-13",
    );
    const params = urls[0]?.searchParams;
    expect(params?.get("filters")).toBe(
      "insightPlaybackLocationType==EMBEDDED;video==vidA",
    );
    expect(params?.get("sort")).toBe("-views");
    expect(params?.get("maxResults")).toBe("25");
    expect(params?.get("startDate")).toBe("2026-10-01");
    expect(params?.get("endDate")).toBe("2026-10-13");
    expect(pages).toEqual([
      {
        videoId: "vidA",
        month: "2026-10-01",
        page: "https://www.vendingpreneurs.com/masterclass",
        views: 40,
        engagedViews: 31,
        minutesWatched: 90,
      },
    ]);
  });

  it("drops engagedViews once if the API refuses it, leaving it null", async () => {
    const { youtube, urls } = client([
      () => jsonResponse(400, { error: { message: "Unknown metric" } }),
      () =>
        jsonResponse(200, {
          columnHeaders: [
            { name: "day" },
            { name: "insightPlaybackLocationType" },
            { name: "views" },
            { name: "estimatedMinutesWatched" },
          ],
          rows: [["2026-10-01", "WATCH", 3, 4]],
        }),
    ]);
    const rows = await youtube.fetchPlaybackDays(
      "vidA",
      "2026-10-01",
      "2026-10-01",
    );
    expect(urls[1]?.searchParams.get("metrics")).toBe(
      "views,estimatedMinutesWatched",
    );
    expect(rows[0]?.engagedViews).toBeNull();
    expect(rows[0]?.views).toBe(3);
  });

  it("throws on any other error rather than returning no rows", async () => {
    const { youtube } = client([
      () => jsonResponse(500, { error: { message: "backend" } }),
    ]);
    await expect(
      youtube.fetchPlaybackDays("vidA", "2026-10-01", "2026-10-01"),
    ).rejects.toThrow(/YouTube Analytics 500/);
  });
});
