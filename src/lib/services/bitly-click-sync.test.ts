import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncBitlyClicks } from "./bitly-click-sync";
import type { BitlyClient } from "@/lib/bitly/client";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({
  config: {
    BITLY_ACCESS_TOKEN: "token_test",
    BITLY_GROUP_GUID: "grp_test",
  },
}));

const NOW = new Date("2026-09-10T12:00:00.000Z");

type VideoRow = { utm_campaign: string; bitly_id: string | null };

type Recorded = {
  clickUpserts: Array<Record<string, unknown>>;
  clickUpsertOptions: Array<Record<string, unknown> | undefined>;
  videoUpdates: Array<{ campaign: string; patch: Record<string, unknown> }>;
};

/**
 * Stands in for the two tables the sync touches.
 *
 * `unmapped` are the rows `mapMissingLinks` sees (bitly_id is null) and
 * `claimable` are what the batch claim returns — kept separate so a test can
 * exercise one path without implying the other.
 */
function buildClient({
  claimable = [],
  unmapped = [],
  upsertError = null,
  selectError = null,
}: {
  claimable?: VideoRow[];
  unmapped?: VideoRow[];
  upsertError?: unknown;
  selectError?: unknown;
} = {}) {
  const recorded: Recorded = {
    clickUpserts: [],
    clickUpsertOptions: [],
    videoUpdates: [],
  };

  const videoSelect = vi.fn(() => ({
    // mapMissingLinks: .select().is("bitly_id", null)
    is: vi.fn(async () => ({
      data: selectError ? null : unmapped,
      error: selectError,
    })),
    // claimBatch: .select().not().order().limit()
    not: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(async () => ({
          data: selectError ? null : claimable,
          error: selectError,
        })),
      })),
    })),
  }));

  const videoUpdate = vi.fn((patch: Record<string, unknown>) => ({
    eq: vi.fn(async (_column: string, campaign: string) => {
      recorded.videoUpdates.push({ campaign, patch });
      return { error: null };
    }),
  }));

  const from = vi.fn((table: string) => {
    if (table === "youtube_videos") {
      return { select: videoSelect, update: videoUpdate };
    }
    if (table === "bitly_link_clicks") {
      return {
        upsert: vi.fn(
          async (
            rows: Array<Record<string, unknown>>,
            options?: Record<string, unknown>,
          ) => {
            recorded.clickUpsertOptions.push(options);
            if (!upsertError) recorded.clickUpserts.push(...rows);
            return { error: upsertError };
          },
        ),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    recorded,
  };
}

function buildBitlyClient({
  clicks = {},
  links = [],
  failOn = [],
}: {
  clicks?: Record<string, Array<{ date: string; clicks: number }>>;
  links?: Array<{ id: string; longUrl: string; title: string | null }>;
  failOn?: string[];
} = {}) {
  return {
    listGroupLinks: vi.fn(async () => links),
    dailyClicks: vi.fn(async (bitlinkId: string) => {
      if (failOn.includes(bitlinkId)) throw new Error("bitly unreachable");
      return clicks[bitlinkId] ?? [];
    }),
  } as unknown as BitlyClient;
}

describe("syncBitlyClicks", () => {
  /**
   * LOW: `if (!row?.bitly_id) return;` conflated "the queue is empty" with
   * "this row has no id", so one null-id row in a claimed batch abandoned the
   * rest of that worker's share.
   */
  it("skips a claimed row with no id and keeps syncing the rest", async () => {
    // One null row per worker at the head of the batch: every worker used to
    // return on its first read and the linked rows behind them were never
    // touched. claimBatch filters null ids today, so this is the guard that
    // keeps a future change to that filter from silently dropping a batch.
    const unlinked = Array.from({ length: 4 }, (_, index) => ({
      utm_campaign: `no-id-${index}`,
      bitly_id: null,
    }));
    const linked = Array.from({ length: 8 }, (_, index) => ({
      utm_campaign: `video-${index}`,
      bitly_id: `bit.ly/${index}`,
    }));
    const { client, recorded } = buildClient({
      claimable: [...unlinked, ...linked],
    });
    const bitlyClient = buildBitlyClient({
      clicks: Object.fromEntries(
        linked.map((row) => [
          row.bitly_id,
          [{ date: "2026-09-09", clicks: 4 }],
        ]),
      ),
    });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result.updated).toBe(8);
    expect(result.daysWritten).toBe(8);
    expect(new Set(recorded.clickUpserts.map((row) => row.bitly_id)).size).toBe(
      8,
    );
  });

  it("writes a day per click entry and stamps the link as synced", async () => {
    const { client, recorded } = buildClient({
      claimable: [{ utm_campaign: "how-much-vending", bitly_id: "bit.ly/a" }],
    });
    const bitlyClient = buildBitlyClient({
      clicks: {
        "bit.ly/a": [
          { date: "2026-09-09", clicks: 12 },
          { date: "2026-09-08", clicks: 3 },
        ],
      },
    });

    const result = await syncBitlyClicks({
      client,
      bitlyClient,
      now: NOW,
    });

    expect(result).toMatchObject({
      scanned: 1,
      updated: 1,
      daysWritten: 2,
      failed: 0,
    });
    expect(recorded.clickUpserts).toEqual([
      {
        bitly_id: "bit.ly/a",
        day: "2026-09-09",
        clicks: 12,
        utm_campaign: "how-much-vending",
        synced_at: NOW.toISOString(),
      },
      {
        bitly_id: "bit.ly/a",
        day: "2026-09-08",
        clicks: 3,
        utm_campaign: "how-much-vending",
        synced_at: NOW.toISOString(),
      },
    ]);
    // Without onConflict the upsert falls back to the primary key by name and
    // a re-sync of the same day inserts a duplicate instead of correcting it.
    expect(recorded.clickUpsertOptions).toEqual([
      { onConflict: "bitly_id,day" },
    ]);
    expect(recorded.videoUpdates).toEqual([
      {
        campaign: "how-much-vending",
        patch: { clicks_synced_at: NOW.toISOString() },
      },
    ]);
  });

  it("still stamps a link that has no clicks, so it leaves the queue front", async () => {
    const { client, recorded } = buildClient({
      claimable: [{ utm_campaign: "quiet-video", bitly_id: "bit.ly/quiet" }],
    });
    const bitlyClient = buildBitlyClient({ clicks: { "bit.ly/quiet": [] } });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ scanned: 1, updated: 1, daysWritten: 0 });
    expect(recorded.clickUpserts).toEqual([]);
    // Without this the link would be re-read first on every single run.
    expect(recorded.videoUpdates).toHaveLength(1);
  });

  it("keeps going when one link fails and does not stamp that link", async () => {
    const { client, recorded } = buildClient({
      claimable: [
        { utm_campaign: "good", bitly_id: "bit.ly/good" },
        { utm_campaign: "bad", bitly_id: "bit.ly/bad" },
      ],
    });
    const bitlyClient = buildBitlyClient({
      clicks: { "bit.ly/good": [{ date: "2026-09-09", clicks: 4 }] },
      failOn: ["bit.ly/bad"],
    });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ scanned: 2, updated: 1, failed: 1 });
    expect(recorded.videoUpdates.map((row) => row.campaign)).toEqual(["good"]);
  });

  /**
   * MEDIUM: bitlinkPath refuses an off-pattern id, the worker caught it as a
   * failure, and the route turned any failure into a 500. A row whose stored id
   * can never be valid therefore failed every run forever -- the cron paged
   * nightly and the row kept its old clicks_synced_at, so it stayed at the
   * front of the claim queue and crowded out links that do work.
   */
  it("counts a permanently malformed id apart from a failure, and moves it on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, recorded } = buildClient({
      claimable: [
        { utm_campaign: "broken", bitly_id: "../users" },
        { utm_campaign: "fine", bitly_id: "bit.ly/works" },
      ],
    });
    const bitlyClient = buildBitlyClient({
      clicks: { "bit.ly/works": [{ date: "2026-09-09", clicks: 3 }] },
    });

    const result = await syncBitlyClicks({
      client,
      bitlyClient,
      now: NOW,
    });

    expect(result).toMatchObject({ scanned: 2, updated: 1, invalid: 1 });
    // The whole point: the cron reads green, because there is nothing to retry.
    expect(result.failed).toBe(0);
    // Never sent. An id we refuse is refused before the request, not after.
    expect(bitlyClient.dailyClicks).not.toHaveBeenCalledWith(
      "../users",
      expect.anything(),
    );
    // Stamped, so it rotates to the back of the queue instead of blocking it.
    expect(recorded.videoUpdates).toContainEqual({
      campaign: "broken",
      patch: { clicks_synced_at: NOW.toISOString() },
    });
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).toContain("broken");
    warn.mockRestore();
  });

  it("logs a link it could not reach instead of swallowing it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = buildClient({
      claimable: [{ utm_campaign: "unreachable", bitly_id: "bit.ly/down" }],
    });
    const bitlyClient = buildBitlyClient({ failOn: ["bit.ly/down"] });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ failed: 1, invalid: 0, updated: 0 });
    expect(JSON.stringify(warn.mock.calls)).toContain("unreachable");
    warn.mockRestore();
  });

  it("does not stamp a link whose click write failed", async () => {
    const { client, recorded } = buildClient({
      claimable: [{ utm_campaign: "a", bitly_id: "bit.ly/a" }],
      upsertError: { message: "conflict" },
    });
    const bitlyClient = buildBitlyClient({
      clicks: { "bit.ly/a": [{ date: "2026-09-09", clicks: 1 }] },
    });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ failed: 1, updated: 0, daysWritten: 0 });
    // A stamp here would mark the link fresh while its clicks were never saved.
    expect(recorded.videoUpdates).toEqual([]);
  });

  it("maps a missing bitly_id from the campaign in Bitly's own long url", async () => {
    const { client, recorded } = buildClient({
      unmapped: [{ utm_campaign: "needs-link", bitly_id: null }],
    });
    const bitlyClient = buildBitlyClient({
      links: [
        {
          id: "booking.vendingpreneurs.com/yt-needs-link",
          longUrl:
            "https://www.vendingpreneurs.com/booking-youtube?utm_source=youtube&utm_campaign=needs-link",
          title: null,
        },
        {
          id: "booking.vendingpreneurs.com/yt-other",
          longUrl: "https://www.vendingpreneurs.com/x?utm_campaign=other",
          title: null,
        },
      ],
    });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result.linksMapped).toBe(1);
    expect(recorded.videoUpdates).toEqual([
      {
        campaign: "needs-link",
        patch: {
          bitly_id: "booking.vendingpreneurs.com/yt-needs-link",
          bitly_url: "https://booking.vendingpreneurs.com/yt-needs-link",
        },
      },
    ]);
  });

  it("leaves a registry row alone when Bitly has no link for its campaign", async () => {
    const { client, recorded } = buildClient({
      unmapped: [{ utm_campaign: "no-link-anywhere", bitly_id: null }],
    });
    const bitlyClient = buildBitlyClient({
      links: [
        {
          id: "booking.vendingpreneurs.com/yt-a",
          longUrl: "https://x.test/?utm_campaign=something-else",
          title: null,
        },
      ],
    });

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result.linksMapped).toBe(0);
    expect(recorded.videoUpdates).toEqual([]);
  });

  it("takes the first Bitly link when a campaign has two, so the number is stable", async () => {
    const { client, recorded } = buildClient({
      unmapped: [{ utm_campaign: "dupe", bitly_id: null }],
    });
    const bitlyClient = buildBitlyClient({
      links: [
        {
          id: "booking.vendingpreneurs.com/first",
          longUrl: "https://x.test/?utm_campaign=dupe",
          title: null,
        },
        {
          id: "booking.vendingpreneurs.com/second",
          longUrl: "https://x.test/?utm_campaign=dupe",
          title: null,
        },
      ],
    });

    await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(recorded.videoUpdates[0]?.patch).toMatchObject({
      bitly_id: "booking.vendingpreneurs.com/first",
    });
  });

  it("survives a Bitly listing failure without abandoning the click sync", async () => {
    const { client, recorded } = buildClient({
      unmapped: [{ utm_campaign: "needs-link", bitly_id: null }],
      claimable: [{ utm_campaign: "a", bitly_id: "bit.ly/a" }],
    });
    const bitlyClient = {
      listGroupLinks: vi.fn(async () => {
        throw new Error("bitly down");
      }),
      dailyClicks: vi.fn(async () => [{ date: "2026-09-09", clicks: 2 }]),
    } as unknown as BitlyClient;

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result.linksMapped).toBe(0);
    // The mapping is a bonus pass; the clicks are the job.
    expect(result.updated).toBe(1);
    expect(recorded.clickUpserts).toHaveLength(1);
  });

  it("passes the requested window through to Bitly for a backfill", async () => {
    const { client } = buildClient({
      claimable: [{ utm_campaign: "a", bitly_id: "bit.ly/a" }],
    });
    const bitlyClient = buildBitlyClient({ clicks: { "bit.ly/a": [] } });

    await syncBitlyClicks({ client, bitlyClient, now: NOW, days: 365 });

    expect(bitlyClient.dailyClicks).toHaveBeenCalledWith("bit.ly/a", {
      days: 365,
    });
  });

  it("does nothing at all when there is no link to sync", async () => {
    const { client, recorded } = buildClient({ claimable: [] });
    const bitlyClient = buildBitlyClient();

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ scanned: 0, updated: 0, failed: 0 });
    expect(recorded.clickUpserts).toEqual([]);
  });

  it("reports nothing rather than throwing when the claim query fails", async () => {
    const { client } = buildClient({ selectError: { message: "no table" } });
    const bitlyClient = buildBitlyClient();

    const result = await syncBitlyClicks({ client, bitlyClient, now: NOW });

    expect(result).toMatchObject({ scanned: 0, failed: 0, linksMapped: 0 });
  });
});
