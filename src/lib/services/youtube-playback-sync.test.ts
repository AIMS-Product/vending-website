import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { YouTubeAnalyticsError } from "@/lib/youtube-analytics/client";
import type {
  PlaybackDayRow,
  YouTubePlaybackClient,
} from "@/lib/youtube-analytics/playback";

vi.mock("@/lib/config", () => ({ config: {} }));

import {
  dateWindows,
  embeddedMonths,
  monthEnd,
  syncYouTubePlayback,
  videoQueue,
} from "./youtube-playback-sync";

const now = new Date("2026-10-14T12:00:00.000Z");
const yesterday = "2026-10-13";

type Tables = Partial<
  Record<string, { data: unknown[]; error?: { code: string; message: string } }>
>;

function buildClient(tables: Tables) {
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
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "not", "order", "gte", "gt", "range"])
      builder[method] = vi.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown) => {
      const table = tables[name] ?? { data: [] };
      return Promise.resolve({
        data: table.error ? null : table.data,
        count: table.data.length,
        error: table.error ?? null,
      }).then(resolve);
    };
    builder.upsert = vi.fn(async (rows: unknown) => {
      (upserts[name] ??= []).push(
        ...((Array.isArray(rows) ? rows : [rows]) as Array<
          Record<string, unknown>
        >),
      );
      return { error: null };
    });
    return builder;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

function day(
  videoId: string,
  date: string,
  locationType: string,
  views: number,
): PlaybackDayRow {
  return {
    videoId,
    day: date,
    locationType,
    views,
    engagedViews: views,
    minutesWatched: views * 2,
  };
}

function fakeYouTube(
  rows: Record<string, PlaybackDayRow[]>,
  fail: Record<string, Error> = {},
) {
  const asked: Array<[string, string, string]> = [];
  const embeds: Array<[string, string, string]> = [];
  const youtube: YouTubePlaybackClient = {
    async fetchPlaybackDays(videoId, start, end) {
      asked.push([videoId, start, end]);
      if (fail[videoId]) throw fail[videoId];
      return (rows[videoId] ?? []).filter(
        (row) => row.day >= start && row.day <= end,
      );
    },
    async fetchEmbedPages(videoId, month, end) {
      embeds.push([videoId, month, end]);
      return [
        {
          videoId,
          month,
          page: "https://www.vendingpreneurs.com/masterclass",
          views: 7,
          engagedViews: 5,
          minutesWatched: 30,
        },
      ];
    },
  };
  return { youtube, asked, embeds };
}

describe("syncYouTubePlayback", () => {
  it("is skipped until the OAuth grant exists", async () => {
    const { client, runs } = buildClient({});
    const result = await syncYouTubePlayback({ client, youtube: null, now });
    expect(result.connector.error).toMatch(/^skipped: YouTube OAuth/);
    expect(runs).toHaveLength(1);
  });

  it("is skipped, not failed, before the tables are pasted in", async () => {
    const { client } = buildClient({
      youtube_playback_sync_state: {
        data: [],
        error: { code: "PGRST205", message: "Could not find the table" },
      },
    });
    const { youtube, asked } = fakeYouTube({});
    const result = await syncYouTubePlayback({ client, youtube, now });
    expect(result.connector.error).toMatch(/^skipped: table missing/);
    expect(asked).toHaveLength(0);
  });

  it("backfills a never-synced video from its publish date and stores the embedding pages of months with embedded plays", async () => {
    const { client, upserts } = buildClient({
      youtube_videos: {
        data: [{ video_id: "vidA", published_at: "2026-08-20T15:00:00Z" }],
      },
    });
    const { youtube, asked, embeds } = fakeYouTube({
      vidA: [
        day("vidA", "2026-08-21", "WATCH", 100),
        day("vidA", "2026-09-02", "EMBEDDED", 4),
        day("vidA", "2026-10-03", "EMBEDDED", 9),
        day("vidA", "2026-10-03", "BROWSE", 20),
      ],
    });
    const result = await syncYouTubePlayback({ client, youtube, now });

    expect(result.connector.error).toBeNull();
    expect(asked).toEqual([["vidA", "2026-08-20", yesterday]]);
    // August had no embedded plays, so it is never asked for pages.
    expect(embeds).toEqual([
      ["vidA", "2026-09-01", "2026-09-30"],
      ["vidA", "2026-10-01", yesterday],
    ]);
    expect(upserts.youtube_video_playback_daily).toHaveLength(4);
    expect(upserts.youtube_video_playback_daily?.[1]).toMatchObject({
      video_id: "vidA",
      day: "2026-09-02",
      location_type: "EMBEDDED",
      views: 4,
      engaged_views: 4,
      minutes_watched: 8,
    });
    expect(upserts.youtube_video_embed_pages).toHaveLength(2);
    expect(upserts.youtube_playback_sync_state).toEqual([
      expect.objectContaining({ video_id: "vidA", synced_through: yesterday }),
    ]);
    expect(result.connector.rowsWritten).toBe(6);
  });

  it("re-reads a week for active videos only, and leaves fresh or idle ones alone", async () => {
    const { client } = buildClient({
      youtube_videos: {
        data: [
          { video_id: "stale", published_at: "2025-01-01T00:00:00Z" },
          { video_id: "idle", published_at: "2025-01-01T00:00:00Z" },
          { video_id: "fresh", published_at: "2025-01-01T00:00:00Z" },
        ],
      },
      youtube_playback_sync_state: {
        data: [
          {
            video_id: "stale",
            synced_through: "2026-10-10",
            synced_at: "2026-10-11T00:00:00Z",
          },
          {
            video_id: "idle",
            synced_through: "2026-10-10",
            synced_at: "2026-10-11T00:00:00Z",
          },
          {
            video_id: "fresh",
            synced_through: "2026-10-13",
            synced_at: "2026-10-14T06:00:00Z",
          },
        ],
      },
      youtube_video_daily: {
        data: [
          { video_id: "stale", day: "2026-10-12" },
          { video_id: "fresh", day: "2026-10-12" },
        ],
      },
    });
    const { youtube, asked } = fakeYouTube({});
    await syncYouTubePlayback({ client, youtube, now });
    expect(asked).toEqual([["stale", "2026-10-03", yesterday]]);
  });

  it("stops starting videos at the time budget without calling it a failure", async () => {
    const { client, upserts } = buildClient({
      youtube_videos: {
        data: [{ video_id: "vidA", published_at: "2026-10-01T00:00:00Z" }],
      },
    });
    const { youtube, asked } = fakeYouTube({});
    let t = 0;
    const result = await syncYouTubePlayback({
      client,
      youtube,
      now,
      budgetMs: 10,
      clock: () => (t += 100),
    });
    expect(asked).toHaveLength(0);
    expect(upserts.youtube_playback_sync_state).toBeUndefined();
    expect(result.connector.error).toBeNull();
  });

  it("counts a failed video, keeps going, and does not mark it synced", async () => {
    const { client, upserts } = buildClient({
      youtube_videos: {
        data: [
          { video_id: "bad", published_at: "2026-10-02T00:00:00Z" },
          { video_id: "good", published_at: "2026-10-01T00:00:00Z" },
        ],
      },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { youtube } = fakeYouTube(
      { good: [day("good", "2026-10-05", "WATCH", 3)] },
      { bad: new YouTubeAnalyticsError("YouTube Analytics 500", 500) },
    );
    const result = await syncYouTubePlayback({ client, youtube, now });
    expect(result.connector.error).toBe(
      "1 of 2 videos failed; see the server log.",
    );
    expect(upserts.youtube_playback_sync_state).toEqual([
      expect.objectContaining({ video_id: "good" }),
    ]);
    error.mockRestore();
  });

  it("fails the run on a refused grant instead of reading it as no views", async () => {
    const { client } = buildClient({
      youtube_videos: {
        data: [{ video_id: "vidA", published_at: "2026-10-01T00:00:00Z" }],
      },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { youtube } = fakeYouTube(
      {},
      { vidA: new YouTubeAnalyticsError("YouTube Analytics 403", 403) },
    );
    const result = await syncYouTubePlayback({ client, youtube, now });
    expect(result.connector.error).toMatch(/403/);
    expect(result.connector.rowsWritten).toBe(0);
    error.mockRestore();
  });
});

describe("videoQueue", () => {
  it("puts the backfill first, newest video first, from the fallback start when unpublished", () => {
    const queue = videoQueue({
      published: new Map([
        ["old", "2024-01-01T00:00:00Z"],
        ["new", "2026-05-01T00:00:00Z"],
      ]),
      active: new Set(["unlisted"]),
      state: new Map(),
      now,
    });
    expect(queue).toEqual([
      { videoId: "new", start: "2026-05-01" },
      { videoId: "old", start: "2024-01-01" },
      { videoId: "unlisted", start: "2015-01-01" },
    ]);
  });
});

describe("date helpers", () => {
  it("splits a long range into windows of at most a year", () => {
    expect(dateWindows("2024-01-01", "2025-06-30")).toEqual([
      ["2024-01-01", "2024-12-30"],
      ["2024-12-31", "2025-06-30"],
    ]);
    expect(dateWindows("2026-10-14", "2026-10-13")).toEqual([]);
  });

  it("caps a month at the last synced day", () => {
    expect(monthEnd("2026-02-01", "2026-10-13")).toBe("2026-02-28");
    expect(monthEnd("2026-10-01", "2026-10-13")).toBe("2026-10-13");
  });

  it("only lists months with embedded plays", () => {
    expect(
      embeddedMonths([
        day("v", "2026-08-03", "WATCH", 5),
        day("v", "2026-09-03", "EMBEDDED", 0),
        day("v", "2026-10-03", "EMBEDDED", 2),
      ]),
    ).toEqual(["2026-10-01"]);
  });
});
