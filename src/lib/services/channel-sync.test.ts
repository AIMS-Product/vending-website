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
    "limit",
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
  /** The Close mirror: the only place a logged show exists. */
  shows?: unknown[];
  /** Rows already on the spine, for the superseded-metric sweep to read. */
  channelDaily?: unknown[];
  /**
   * A metric column whose upsert fails, as `thankyou_visits` does in
   * production where the column was never added.
   */
  missingColumn?: string;
}) {
  const upserts: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const from = vi.fn((name: string) => {
    switch (name) {
      case "channel_daily":
        return {
          ...table(data.channelDaily ?? []),
          upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
            if (
              data.missingColumn &&
              rows.some((row) => data.missingColumn! in row)
            ) {
              return {
                error: {
                  message: `column ${data.missingColumn} does not exist`,
                },
              };
            }
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
      case "close_lead_funnel":
        return table(data.shows ?? []);
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

const ga4 = (rows: unknown[], thankYou: unknown[] = []) =>
  ({
    fetchPageViews: vi.fn(),
    fetchChannelSessions: vi.fn(async () => rows),
    fetchThankYouSessions: vi.fn(async () => thankYou),
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

  it("keys paid Google visits on the Ads campaign id, so they meet their leads", async () => {
    const { client, upserts } = buildClient({});

    await syncChannelDaily({
      client,
      ga4Client: ga4([
        {
          day: "2026-09-10",
          source: "google",
          medium: "cpc",
          campaign: "VP - Search - Brand",
          content: "(not set)",
          term: "(not set)",
          campaignId: "23805931083",
          sessions: 120,
        },
        // Organic google: the name is what its links carry, id is filler.
        {
          day: "2026-09-10",
          source: "google",
          medium: "organic",
          campaign: "(not set)",
          content: "(not set)",
          term: "(not set)",
          campaignId: "0",
          sessions: 9,
        },
      ]),
      bitlyClient: null,
      now: NOW,
    });

    expect(upserts).toEqual([
      expect.objectContaining({
        channel: "Google Ads",
        medium: "cpc",
        campaign: "23805931083",
        visits: 120,
      }),
      expect.objectContaining({
        channel: "Organic search",
        medium: "organic",
        campaign: "(not set)",
        visits: 9,
      }),
    ]);
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
      // Four different people: the same email twice is one lead.
      leads: [
        lead({ email: "one@gmail.com" }),
        lead({
          email: "two@gmail.com",
          call_booked_at: "2026-09-12",
          call_outcome: null,
        }),
        lead({
          email: "three@gmail.com",
          call_booked_at: "2026-09-12",
          call_outcome: "no_show",
        }),
        lead({
          email: "four@gmail.com",
          call_booked_at: "2026-09-12",
          call_outcome: "won",
          closed_won_at: "2026-09-20",
          closed_won_value: 5997,
        }),
        lead({ email: "qa@example.com" }),
      ],
      // A show counts only when a rep logged it in Close. two@ booked but
      // nobody logged the call, so it is not shown.
      shows: [
        {
          email: "three@gmail.com",
          first_sales_call_booked_date: "2026-09-10",
          first_call_show_up: "No",
        },
        {
          email: "four@gmail.com",
          first_sales_call_booked_date: "2026-09-10",
          first_call_show_up: "Yes",
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
        day: "2026-09-10",
        channel: "Instagram",
        leads: 4,
        booked: 3,
        showed: 1,
        won: 1,
        // One won lead carries a deal value; the three that did not win
        // contribute null, which does not drag the sum down to zero.
        revenue: 5997,
      }),
    ]);
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
        {
          ...base,
          email: "one@gmail.com",
          metadata: { source: "chatbot", conversationId: "c1" },
        },
        { ...base, email: "two@gmail.com", metadata: null },
        // A tagged lead keeps its campaign even when the chatbot captured it.
        {
          ...base,
          email: "three@gmail.com",
          utm_source: "youtube",
          metadata: { source: "chatbot" },
        },
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

  it("counts one person who submitted twice as one lead, with the booking from either row", async () => {
    const base = {
      email: "pat@buyer.com",
      full_name: "Pat",
      utm_source: "youtube",
      utm_medium: "video",
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      call_outcome: null,
      closed_won_at: null,
      metadata: null,
    };
    const { client, upserts } = buildClient({
      leads: [
        {
          ...base,
          created_at: "2026-09-10T15:00:00.000Z",
          call_booked_at: null,
        },
        {
          ...base,
          email: "PAT@buyer.com",
          created_at: "2026-09-10T15:05:00.000Z",
          call_booked_at: "2026-09-12",
        },
        {
          ...base,
          email: "reader@buyer.com",
          created_at: "2026-09-10T16:00:00.000Z",
          call_booked_at: null,
          lifecycle_status: "newsletter_subscribed",
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
      expect.objectContaining({ channel: "YouTube", leads: 1, booked: 1 }),
    ]);
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

  it("dates a backfilled booking by Calendly's booked-at, not the import day", async () => {
    // A backfill wrote months of Calendly history in one afternoon. Bucketing
    // on the mirror row's own created_at piles all of it onto the import date
    // and every month-to-date number downstream is wrong.
    const { client, upserts } = buildClient({
      bookings: [
        {
          created_at: "2026-09-14T19:05:00.000Z",
          booked_at: "2026-06-24T15:12:00.000Z",
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
      expect.objectContaining({ day: "2026-06-24", booked: 1 }),
    ]);
  });

  it("nulls visits on a link GA4 stopped reporting, because it moved the session", async () => {
    const { client, upserts } = buildClient({
      channelDaily: [
        // The key GA4 still reports. Left alone.
        {
          day: "2026-09-10",
          source: "youtube",
          medium: "social",
          campaign: "youtube-home",
          content: "(not set)",
          destination: "unknown",
          visits: 12,
          thankyou_visits: null,
        },
        // The provisional key the same sessions first landed on.
        {
          day: "2026-09-10",
          source: "(not set)",
          medium: "(not set)",
          campaign: "(not set)",
          content: "(not set)",
          destination: "unknown",
          visits: 9,
          thankyou_visits: null,
        },
      ],
    });

    await syncChannelDaily({
      client,
      ga4Client: ga4([
        {
          day: "2026-09-10",
          source: "youtube",
          medium: "social",
          campaign: "youtube-home",
          content: "",
          term: "",
          campaignId: "",
          sessions: 12,
        },
      ]),
      bitlyClient: null,
      now: NOW,
    });

    const cleared = upserts.filter((row) => row.visits === null);
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({
      day: "2026-09-10",
      source: "(not set)",
      visits: null,
    });
    // Null, not zero: the dashboard renders not-observed as a dash.
    expect(cleared[0].visits).toBeNull();
  });

  it("clears only the column whose write landed, never one the run could not touch", async () => {
    // Production shape on 2026-09-18: `thankyou_visits` is in the generated
    // types but not in the database, so every confirmations upsert fails.
    const { client, upserts } = buildClient({
      missingColumn: "thankyou_visits",
      channelDaily: [
        {
          day: "2026-09-10",
          source: "(not set)",
          medium: "(not set)",
          campaign: "(not set)",
          content: "(not set)",
          destination: "unknown",
          visits: 9,
          thankyou_visits: 2,
        },
      ],
    });

    await syncChannelDaily({
      client,
      ga4Client: ga4(
        [
          {
            day: "2026-09-10",
            source: "youtube",
            medium: "social",
            campaign: "youtube-home",
            content: "",
            term: "",
            campaignId: "",
            sessions: 12,
          },
        ],
        [
          {
            day: "2026-09-10",
            source: "youtube",
            medium: "social",
            campaign: "youtube-home",
            content: "",
            term: "",
            campaignId: "",
            sessions: 3,
          },
        ],
      ),
      bitlyClient: null,
      now: NOW,
    });

    const cleared = upserts.filter((row) => row.visits === null);
    expect(cleared).toHaveLength(1);
    // visits was written this run, so a superseded key may be cleared.
    expect(cleared[0]).toHaveProperty("visits", null);
    // thankyou_visits was not, so it must not appear in the clearing payload.
    expect(cleared[0]).not.toHaveProperty("thankyou_visits");
  });
});
