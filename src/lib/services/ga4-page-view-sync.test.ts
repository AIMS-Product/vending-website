import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Ga4Client, Ga4PageViewRow } from "@/lib/ga4/client";
import { syncGa4PageViews } from "./ga4-page-view-sync";

function row(overrides: Partial<Ga4PageViewRow> = {}): Ga4PageViewRow {
  return {
    day: "2026-09-01",
    landingPage: "/booking-youtube",
    utmCampaign: "youtube-home",
    utmSource: "youtube",
    screenPageViews: 403,
    sessions: 169,
    engagedSessions: 150,
    newUsers: 120,
    keyEvents: 4,
    userEngagementSeconds: 9123.5,
    ...overrides,
  };
}

function buildClient(upsertError: unknown = null) {
  const batches: Array<{
    rows: Array<Record<string, unknown>>;
    options: Record<string, unknown> | undefined;
  }> = [];
  const from = vi.fn((table: string) => {
    if (table !== "ga4_page_views") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      upsert: vi.fn(
        async (
          rows: Array<Record<string, unknown>>,
          options?: Record<string, unknown>,
        ) => {
          batches.push({ rows, options });
          return { error: upsertError };
        },
      ),
    };
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    batches,
  };
}

function buildGa4(rows: Ga4PageViewRow[]): {
  ga4Client: Ga4Client;
  ranges: Array<{ startDate: string; endDate: string }>;
} {
  const ranges: Array<{ startDate: string; endDate: string }> = [];
  return {
    ranges,
    ga4Client: {
      fetchPageViews: vi.fn(async (range) => {
        ranges.push(range);
        return rows;
      }),
      fetchChannelSessions: vi.fn(async () => []),
    },
  };
}

const NOW = new Date("2026-09-10T18:00:00.000Z");

describe("syncGa4PageViews", () => {
  it("writes GA4 rows onto the day/page/campaign/source grain", async () => {
    const { client, batches } = buildClient();
    const { ga4Client } = buildGa4([row()]);

    const result = await syncGa4PageViews({
      client,
      ga4Client,
      now: NOW,
      days: 3,
    });

    expect(result).toMatchObject({ connected: true, rows: 1, written: 1 });
    expect(batches[0].rows).toEqual([
      {
        day: "2026-09-01",
        landing_page: "/booking-youtube",
        utm_campaign: "youtube-home",
        utm_source: "youtube",
        screen_page_views: 403,
        sessions: 169,
        engaged_sessions: 150,
        new_users: 120,
        key_events: 4,
        user_engagement_seconds: 9123.5,
        synced_at: NOW.toISOString(),
      },
    ]);
  });

  it("upserts on the primary key so a re-sync corrects a day", async () => {
    const { client, batches } = buildClient();
    const { ga4Client } = buildGa4([row()]);

    await syncGa4PageViews({ client, ga4Client, now: NOW, days: 3 });

    expect(batches[0].options).toMatchObject({
      onConflict: "day,landing_page,utm_campaign,utm_source",
    });
  });

  it("pulls a trailing window ending yesterday, because GA4 keeps settling", async () => {
    const { client } = buildClient();
    const { ga4Client, ranges } = buildGa4([]);

    await syncGa4PageViews({ client, ga4Client, now: NOW, days: 3 });

    // now is 2026-09-10, so yesterday is the 9th and three days back is the 7th.
    expect(ranges).toEqual([
      { startDate: "2026-09-07", endDate: "2026-09-09" },
    ]);
  });

  it("honours an explicit range for the one-time backfill", async () => {
    const { client } = buildClient();
    const { ga4Client, ranges } = buildGa4([]);

    await syncGa4PageViews({
      client,
      ga4Client,
      now: NOW,
      startDate: "2026-02-26",
      endDate: "2026-09-09",
    });

    expect(ranges).toEqual([
      { startDate: "2026-02-26", endDate: "2026-09-09" },
    ]);
  });

  it("chunks a large backfill instead of one enormous upsert", async () => {
    const { client, batches } = buildClient();
    const many = Array.from({ length: 2500 }, (_, index) =>
      row({ landingPage: `/p${index}` }),
    );
    const { ga4Client } = buildGa4(many);

    const result = await syncGa4PageViews({
      client,
      ga4Client,
      now: NOW,
      days: 3,
      chunkSize: 1000,
    });

    expect(batches.map((batch) => batch.rows.length)).toEqual([
      1000, 1000, 500,
    ]);
    expect(result.written).toBe(2500);
  });

  it("reports not-connected instead of throwing when GA4 has no credentials", async () => {
    const { client, batches } = buildClient();

    const result = await syncGa4PageViews({
      client,
      ga4Client: null,
      now: NOW,
    });

    expect(result).toMatchObject({ connected: false, rows: 0, written: 0 });
    expect(batches).toHaveLength(0);
  });

  it("counts a failed chunk instead of losing the rest of the backfill", async () => {
    const { client } = buildClient({ message: "deadlock detected" });
    const { ga4Client } = buildGa4([row(), row({ landingPage: "/b" })]);

    const result = await syncGa4PageViews({
      client,
      ga4Client,
      now: NOW,
      days: 3,
      chunkSize: 1,
    });

    expect(result).toMatchObject({
      connected: true,
      rows: 2,
      written: 0,
      failed: 2,
    });
  });

  it("writes nothing when GA4 returns an empty range", async () => {
    const { client, batches } = buildClient();
    const { ga4Client } = buildGa4([]);

    const result = await syncGa4PageViews({
      client,
      ga4Client,
      now: NOW,
      days: 3,
    });

    expect(batches).toHaveLength(0);
    expect(result).toMatchObject({ connected: true, rows: 0, written: 0 });
  });
});
