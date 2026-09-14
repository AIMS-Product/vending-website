import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { YouTubeAnalyticsClient } from "@/lib/youtube-analytics/client";

vi.mock("@/lib/config", () => ({ config: {} }));

import {
  metricoolYouTubeClient,
  syncYouTubeAnalytics,
} from "./youtube-analytics-sync";

const now = new Date("2026-09-11T11:40:00.000Z");

function buildClient() {
  const upserts: Record<string, Array<Record<string, unknown>>> = {};
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
    if (name === "youtube_videos") {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "not", "limit"])
        builder[method] = vi.fn(() => builder);
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: [{ video_id: "vid1", utm_campaign: "yt-desc-link-1-routes" }],
          error: null,
        }).then(resolve);
      return builder;
    }
    return {
      upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        (upserts[name] ??= []).push(...rows);
        return { error: null };
      }),
    };
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

describe("syncYouTubeAnalytics", () => {
  it("is skipped until the refresh token exists", async () => {
    const { client, runs } = buildClient();
    const result = await syncYouTubeAnalytics({ client, youtube: null, now });
    expect(result.connector.error).toMatch(/^skipped: Neither YouTube OAuth/);
    expect(runs).toHaveLength(1);
  });

  it("walks each day ending yesterday and joins the video's campaign", async () => {
    const { client, upserts } = buildClient();
    const asked: string[] = [];
    const youtube: YouTubeAnalyticsClient = {
      fetchVideoDay: async (day) => {
        asked.push(day);
        return day === "2026-09-10"
          ? [
              {
                videoId: "vid1",
                day,
                views: 50,
                impressions: 900,
                cardImpressions: 10,
                cardClicks: 2,
              },
              {
                videoId: "vid9",
                day,
                views: 1,
                impressions: null,
                cardImpressions: null,
                cardClicks: 0,
              },
            ]
          : [];
      },
    };
    const result = await syncYouTubeAnalytics({
      client,
      youtube,
      now,
      days: 2,
    });
    expect(asked).toEqual(["2026-09-10", "2026-09-09"]);
    expect(result.connector).toMatchObject({
      connector: "youtube-analytics",
      error: null,
      rowsWritten: 4,
    });
    expect(upserts.youtube_video_daily).toHaveLength(2);
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        day: "2026-09-10",
        channel: "YouTube",
        source: "youtube",
        campaign: "yt-desc-link-1-routes",
        content: "vid1",
        impressions: 900,
        clicks: 2,
      }),
    );
    // No thumbnail impressions reported, so the day's views stand in as Seen.
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        content: "vid9",
        campaign: "(not set)",
        impressions: 1,
        clicks: 0,
      }),
    );
  });
});

describe("metricoolYouTubeClient", () => {
  it("asks Metricool for one day and keeps only videos that were watched", async () => {
    const fetchYouTubeVideos = vi.fn(async () => [
      { videoId: "a", title: "A", publishedAt: null, views: 5 },
      { videoId: "b", title: "B", publishedAt: null, views: 40 },
      { videoId: "c", title: "C", publishedAt: null, views: 0 },
      { videoId: "d", title: "D", publishedAt: null, views: null },
    ]);
    const youtube = metricoolYouTubeClient(
      {
        fetchPosts: async () => [],
        fetchCampaigns: async () => [],
        fetchYouTubeVideos,
      },
      "6626386",
    );
    const rows = await youtube.fetchVideoDay("2026-08-20");
    expect(fetchYouTubeVideos).toHaveBeenCalledWith({
      blogId: "6626386",
      from: "2026-08-20",
      to: "2026-08-20",
    });
    expect(rows).toEqual([
      {
        videoId: "b",
        day: "2026-08-20",
        views: 40,
        impressions: null,
        cardImpressions: null,
        cardClicks: null,
      },
      {
        videoId: "a",
        day: "2026-08-20",
        views: 5,
        impressions: null,
        cardImpressions: null,
        cardClicks: null,
      },
    ]);
  });
});
