import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  channelDailyKey,
  NOT_SET,
  recordSyncRun,
  upsertChannelDaily,
} from "./channel-daily";

function buildClient(upsertError: unknown = null) {
  const upserts: Array<{
    rows: Array<Record<string, unknown>>;
    options: Record<string, unknown> | undefined;
  }> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    if (table === "channel_daily") {
      return {
        upsert: vi.fn(
          async (
            rows: Array<Record<string, unknown>>,
            options?: Record<string, unknown>,
          ) => {
            upserts.push({ rows, options });
            return { error: upsertError };
          },
        ),
      };
    }
    if (table === "channel_sync_runs") {
      return {
        insert: vi.fn(async (row: Record<string, unknown>) => {
          runs.push(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

const NOW = new Date("2026-09-11T12:00:00.000Z");

describe("channelDailyKey", () => {
  it("normalises the link dimensions once, for every connector", () => {
    expect(
      channelDailyKey({
        day: "2026-09-01",
        source: " Instagram ",
        medium: "Organic",
        campaign: "webinar-sept15",
        content: "Reel-0911",
        term: "Webinar-Register",
      }),
    ).toEqual({
      day: "2026-09-01",
      channel: "Instagram",
      source: "instagram",
      medium: "organic",
      campaign: "webinar-sept15",
      content: "Reel-0911",
      destination: "webinar-register",
    });
  });

  it("stores blanks as (not set) and an off-list term as unknown", () => {
    expect(
      channelDailyKey({
        day: "2026-09-01",
        source: "",
        medium: null,
        campaign: undefined,
        content: "  ",
        term: "vending machines",
      }),
    ).toMatchObject({
      channel: "Website",
      source: NOT_SET,
      medium: NOT_SET,
      campaign: NOT_SET,
      content: NOT_SET,
      destination: "unknown",
    });
  });

  it("lets a program (webinar) own rows whose traffic source is an ad platform", () => {
    expect(
      channelDailyKey({
        day: "2026-09-01",
        channel: "webinar",
        source: "meta_ads",
        medium: "paid",
        campaign: "webinar-2026-09-01",
        content: "warm",
        term: "webinar-register",
      }),
    ).toMatchObject({ channel: "Webinar", source: "meta_ads" });
  });
});

describe("upsertChannelDaily", () => {
  it("sums rows that share a key before writing, and writes only the metrics given", async () => {
    const { client, upserts } = buildClient();
    const base = {
      day: "2026-09-01",
      source: "instagram",
      medium: "organic",
      campaign: "c",
      content: "p",
      term: "book-call",
    };

    const result = await upsertChannelDaily(
      client,
      [
        { ...base, leads: 1, booked: 1 },
        { ...base, leads: 1, booked: 0 },
        { ...base, source: "youtube", leads: 1, booked: null },
      ],
      { now: NOW },
    );

    expect(result).toEqual({ written: 2, failed: 0 });
    expect(upserts[0].options).toEqual({
      onConflict: "day,channel,source,medium,campaign,content,destination",
    });
    expect(upserts[0].rows).toEqual([
      {
        day: "2026-09-01",
        channel: "Instagram",
        source: "instagram",
        medium: "organic",
        campaign: "c",
        content: "p",
        destination: "book-call",
        leads: 2,
        booked: 1,
        synced_at: NOW.toISOString(),
      },
      {
        day: "2026-09-01",
        channel: "YouTube",
        source: "youtube",
        medium: "organic",
        campaign: "c",
        content: "p",
        destination: "book-call",
        leads: 1,
        booked: null,
        synced_at: NOW.toISOString(),
      },
    ]);
    // No visits/clicks/spend keys: GA4's columns are not blanked by the lead write.
    expect(Object.keys(upserts[0].rows[0])).not.toContain("visits");
  });

  it("keeps null as not-observed when summing", async () => {
    const { client, upserts } = buildClient();
    const base = {
      day: "2026-09-01",
      source: "x",
      medium: "organic",
      campaign: "c",
      content: "p",
      term: "none",
    };
    await upsertChannelDaily(
      client,
      [
        { ...base, booked: null, showed: null },
        { ...base, booked: 2, showed: null },
      ],
      { now: NOW },
    );
    expect(upserts[0].rows[0]).toMatchObject({ booked: 2, showed: null });
  });

  it("chunks and counts a failed chunk without dropping the rest", async () => {
    const { client, upserts } = buildClient({ message: "boom" });
    const rows = Array.from({ length: 3 }, (_, index) => ({
      day: "2026-09-01",
      source: "youtube",
      medium: "organic",
      campaign: `c${index}`,
      content: "p",
      term: "content",
      clicks: 1,
    }));
    const result = await upsertChannelDaily(client, rows, {
      now: NOW,
      chunkSize: 2,
    });
    expect(upserts.map((batch) => batch.rows.length)).toEqual([2, 1]);
    expect(result).toEqual({ written: 0, failed: 3 });
  });

  it("writes nothing for an empty batch", async () => {
    const { client, upserts } = buildClient();
    expect(await upsertChannelDaily(client, [])).toEqual({
      written: 0,
      failed: 0,
    });
    expect(upserts).toHaveLength(0);
  });
});

describe("recordSyncRun", () => {
  it("records a successful run with its row count", async () => {
    const { client, runs } = buildClient();
    const outcome = await recordSyncRun(
      client,
      "ga4-visits",
      async () => ({ rowsWritten: 12 }),
      { now: () => NOW },
    );
    expect(outcome).toEqual({
      connector: "ga4-visits",
      rowsWritten: 12,
      error: null,
    });
    expect(runs[0]).toMatchObject({
      connector: "ga4-visits",
      rows_written: 12,
      error: null,
      started_at: NOW.toISOString(),
    });
  });

  it("records a thrown error instead of propagating it", async () => {
    const { client, runs } = buildClient();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const outcome = await recordSyncRun(client, "bitly-clicks", async () => {
      throw new Error("HTTP 429 from Bitly");
    });
    expect(outcome.error).toBe("Error: HTTP 429 from Bitly");
    expect(runs[0]).toMatchObject({
      connector: "bitly-clicks",
      rows_written: 0,
      error: "Error: HTTP 429 from Bitly",
    });
    consoleError.mockRestore();
  });
});
