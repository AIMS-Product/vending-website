import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BitlyClient } from "@/lib/bitly/client";
import type { Ga4Client } from "@/lib/ga4/client";

const mocks = vi.hoisted(() => ({
  config: { BITLY_GROUP_GUID: "grp" as string | undefined },
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));

import { syncChannelDaily } from "./channel-sync";

/**
 * A chainable, thenable PostgREST stand-in: every filter returns the builder
 * and awaiting it yields the table's rows. Enough for pageAll's `.range()`
 * walk, since every fixture is under one page.
 */
function table(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of [
    "select",
    "gte",
    "lte",
    "lt",
    "eq",
    "is",
    "not",
    "order",
    "range",
  ]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return builder;
}

function buildClient(data: {
  clicks?: unknown[];
  videos?: unknown[];
  links?: unknown[];
  leads?: unknown[];
  bookings?: unknown[];
}) {
  const upserts: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((name: string) => {
    switch (name) {
      case "channel_daily":
        return {
          upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
            upserts.push(...rows);
            return { error: null };
          }),
        };
      case "channel_sync_runs":
        return {
          insert: vi.fn(async (row: Record<string, unknown>) => {
            runs.push(row);
            return { error: null };
          }),
        };
      case "bitly_link_clicks":
        return table(data.clicks ?? []);
      case "youtube_videos":
        return table(data.videos ?? []);
      case "marketing_links":
        return table(data.links ?? []);
      case "lead_submissions":
        return table(data.leads ?? []);
      case "calendly_bookings":
        return table(data.bookings ?? []);
      default:
        throw new Error(`Unexpected table: ${name}`);
    }
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    upserts,
    runs,
  };
}

const NOW = new Date("2026-09-11T12:00:00.000Z");

const ga4 = (rows: unknown[]) =>
  ({
    fetchPageViews: vi.fn(),
    fetchChannelSessions: vi.fn(async () => rows),
  }) as unknown as Ga4Client;

const bitly = (links: Array<{ id: string; longUrl: string }>) =>
  ({
    listGroupLinks: vi.fn(async () =>
      links.map((link) => ({ ...link, title: null })),
    ),
    dailyClicks: vi.fn(),
    createBitlink: vi.fn(),
  }) as unknown as BitlyClient;

describe("syncChannelDaily", () => {
  beforeEach(() => {
    mocks.config.BITLY_GROUP_GUID = "grp";
  });

  it("records GA4 as skipped, not failed, when it is not configured", async () => {
    const { client, runs, upserts } = buildClient({});

    const result = await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: null,
      now: NOW,
    });

    expect(result.connectors.map((run) => run.connector)).toEqual([
      "ga4-visits",
      "bitly-clicks",
      "leads",
    ]);
    expect(result.connectors[0].error).toMatch(/^skipped:/);
    expect(runs).toHaveLength(3);
    expect(upserts).toHaveLength(0);
  });

  it("writes GA4 sessions as visits, blanking GA4's (not set) placeholders", async () => {
    const { client, upserts } = buildClient({});

    await syncChannelDaily({
      client,
      ga4Client: ga4([
        {
          day: "2026-09-10",
          source: "instagram",
          medium: "(none)",
          campaign: "webinar-sept15",
          content: "(not set)",
          term: "webinar-register",
          sessions: 40,
        },
      ]),
      bitlyClient: null,
      now: NOW,
    });

    expect(upserts).toEqual([
      expect.objectContaining({
        day: "2026-09-10",
        channel: "Instagram",
        source: "instagram",
        medium: "(not set)",
        campaign: "webinar-sept15",
        content: "(not set)",
        destination: "webinar-register",
        visits: 40,
      }),
    ]);
    expect(upserts[0]).not.toHaveProperty("leads");
  });

  it("keys Bitly clicks by the UTMs on the short link's long URL", async () => {
    const { client, upserts, runs } = buildClient({
      clicks: [
        { bitly_id: "vp.link/a", day: "2026-09-10", clicks: 7 },
        { bitly_id: "vp.link/orphan", day: "2026-09-10", clicks: 2 },
      ],
      videos: [{ bitly_id: "vp.link/a", utm_campaign: "yt-old" }],
    });

    await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: bitly([
        {
          id: "vp.link/a",
          longUrl:
            "https://www.vendingpreneurs.com/book?utm_source=youtube&utm_medium=organic&utm_campaign=vsl&utm_content=vid1&utm_term=book-call",
        },
      ]),
      now: NOW,
    });

    const mapped = upserts.find((row) => row.campaign === "vsl");
    expect(mapped).toMatchObject({
      channel: "YouTube",
      source: "youtube",
      content: "vid1",
      destination: "book-call",
      clicks: 7,
    });
    const orphan = upserts.find((row) => row.clicks === 2);
    expect(orphan).toMatchObject({ source: "(not set)", channel: "Website" });
    const bitlyRun = runs.find((run) => run.connector === "bitly-clicks");
    expect(bitlyRun?.error).toBe("1 click rows had no UTMs on their long URL.");
    expect(bitlyRun?.rows_written).toBe(2);
  });

  it("falls back to the YouTube registry when Bitly is not connected", async () => {
    const { client, upserts } = buildClient({
      clicks: [{ bitly_id: "vp.link/a", day: "2026-09-10", clicks: 3 }],
      videos: [{ bitly_id: "vp.link/a", utm_campaign: "how-much-vending" }],
    });

    await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: null,
      now: NOW,
    });

    expect(upserts[0]).toMatchObject({
      channel: "YouTube",
      source: "youtube",
      campaign: "how-much-vending",
      destination: "unknown",
      clicks: 3,
    });
  });

  it("credits leads, booked, showed and won to the lead's cohort day and skips internal leads", async () => {
    const lead = (overrides: Record<string, unknown>) => ({
      created_at: "2026-09-10T15:00:00.000Z",
      email: "buyer@gmail.com",
      full_name: "Buyer",
      utm_source: "instagram",
      utm_medium: "organic",
      utm_campaign: "webinar-sept15",
      utm_content: "reel",
      utm_term: "webinar-register",
      call_booked_at: null,
      call_outcome: null,
      closed_won_at: null,
      ...overrides,
    });
    const { client, upserts } = buildClient({
      leads: [
        lead({}),
        lead({ call_booked_at: "2026-09-12", call_outcome: null }),
        lead({ call_booked_at: "2026-09-12", call_outcome: "no_show" }),
        lead({
          call_booked_at: "2026-09-12",
          call_outcome: "won",
          closed_won_at: "2026-09-20",
        }),
        lead({ email: "qa@example.com" }),
      ],
    });

    await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: null,
      now: NOW,
    });

    expect(upserts).toEqual([
      expect.objectContaining({
        day: "2026-09-10",
        channel: "Instagram",
        leads: 4,
        booked: 3,
        showed: 2,
        won: 1,
      }),
    ]);
    expect(upserts[0]).not.toHaveProperty("revenue");
  });

  it("credits an untagged chatbot-captured lead to Chatbot, not Website", async () => {
    const base = {
      created_at: "2026-09-10T15:00:00.000Z",
      email: "buyer@gmail.com",
      full_name: "Buyer",
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      call_booked_at: "2026-09-12",
      call_outcome: null,
      closed_won_at: null,
    };
    const { client, upserts } = buildClient({
      leads: [
        { ...base, metadata: { source: "chatbot", conversationId: "c1" } },
        { ...base, metadata: null },
        // A tagged lead keeps its campaign even when the chatbot captured it.
        { ...base, utm_source: "youtube", metadata: { source: "chatbot" } },
      ],
    });

    await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: null,
      now: NOW,
    });

    const byChannel = Object.fromEntries(
      upserts.map((row) => [row.channel, row]),
    );
    expect(byChannel.Chatbot).toMatchObject({ leads: 1, booked: 1 });
    expect(byChannel.Website).toMatchObject({ leads: 1 });
    expect(byChannel.YouTube).toMatchObject({ leads: 1 });
  });

  it("counts a tagged Calendly booking with no lead form as booked, leads unobserved", async () => {
    const { client, upserts } = buildClient({
      bookings: [
        {
          created_at: "2026-09-09T10:00:00.000Z",
          utm_source: "linkedin",
          utm_medium: "organic",
          utm_campaign: "bio",
          utm_content: "profile",
          utm_term: "book-call",
        },
      ],
    });

    await syncChannelDaily({
      client,
      ga4Client: null,
      bitlyClient: null,
      now: NOW,
    });

    expect(upserts).toEqual([
      expect.objectContaining({
        day: "2026-09-09",
        channel: "LinkedIn",
        destination: "book-call",
        leads: null,
        booked: 1,
        showed: null,
        won: null,
      }),
    ]);
  });
});
