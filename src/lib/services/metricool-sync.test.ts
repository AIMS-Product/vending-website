import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  MetricoolCampaign,
  MetricoolClient,
  MetricoolPost,
} from "@/lib/metricool/client";

vi.mock("@/lib/config", () => ({ config: {} }));

import {
  adRow,
  channelRow,
  firstOutboundUrl,
  networkSource,
  postRow,
  syncMetricool,
} from "./metricool-sync";

const now = new Date("2026-09-11T11:30:00.000Z");

const tagged: MetricoolPost = {
  id: "ig-1",
  network: "instagram",
  text: "Register here: https://www.vendingpreneurs.com/webinar?utm_source=instagram&utm_medium=organic&utm_campaign=webinar-sept15&utm_content=ig-1&utm_term=webinar-register.",
  permalink: "https://www.instagram.com/p/ig-1/",
  publishedAt: "2026-09-09T18:00:00.000Z",
  metrics: { reach: 900, impressions: 1100, clicks: 40 },
};

const untagged: MetricoolPost = {
  id: "li-2",
  network: "linkedin",
  text: "Read more https://www.vendingpreneurs.com/blog/routes",
  permalink: "https://www.linkedin.com/posts/li-2",
  publishedAt: "2026-09-10T15:00:00.000Z",
  metrics: { impressions: 300 },
};

const ytVideo: MetricoolPost = {
  id: "WNdORD-DJGQ",
  network: "youtube",
  text: "The worst vending locations",
  permalink: "https://www.youtube.com/watch?v=WNdORD-DJGQ",
  publishedAt: "2026-08-28T17:00:38.000Z",
  metrics: { impressions: 7869 },
};

const noLink: MetricoolPost = {
  id: "tt-3",
  network: "twitter",
  text: "Just vibes",
  permalink: "https://x.com/vp/status/3",
  publishedAt: "2026-09-10T16:00:00.000Z",
  metrics: {},
};

describe("firstOutboundUrl", () => {
  it("skips the post's own host and trims trailing punctuation", () => {
    expect(
      firstOutboundUrl(
        "see https://www.instagram.com/p/x/ and https://a.com/b.",
        "https://instagram.com/p/x/",
      ),
    ).toBe("https://a.com/b");
    expect(firstOutboundUrl("no links", null)).toBeNull();
  });
});

describe("postRow + channelRow", () => {
  it("parses the UTMs and passes the standard for a tagged link", () => {
    const row = postRow(tagged, now);
    expect(row).toMatchObject({
      post_id: "ig-1",
      utm_source: "instagram",
      utm_campaign: "webinar-sept15",
      utm_term: "webinar-register",
      link_compliant: true,
      link_problems: [],
      reach: 900,
      impressions: 1100,
      clicks: 40,
    });
    expect(channelRow(row)).toEqual({
      day: "2026-09-09",
      source: "instagram",
      medium: "organic",
      campaign: "webinar-sept15",
      content: "ig-1",
      term: "webinar-register",
      reach: 900,
      impressions: 1100,
      clicks: 40,
    });
  });

  it("flags an untagged link and still writes the spine under the network", () => {
    const row = postRow(untagged, now);
    expect(row.link_compliant).toBe(false);
    expect(row.link_problems).toContain("utm_source is missing.");
    expect(channelRow(row)).toMatchObject({
      day: "2026-09-10",
      source: "linkedin",
      medium: "organic",
      campaign: null,
      content: "li-2",
      impressions: 300,
      reach: null,
      clicks: null,
    });
  });

  it("leaves a post with no link unchecked and maps twitter to x", () => {
    const row = postRow(noLink, now);
    expect(row.link).toBeNull();
    expect(row.link_compliant).toBeNull();
    expect(channelRow(row).source).toBe("x");
  });

  it("prefixes a person brand's posts with the owner, like a tagged link", () => {
    expect(channelRow(postRow(untagged, now, "6633336")).source).toBe(
      "mike-li",
    );
    expect(channelRow(postRow(noLink, now, "6633345")).source).toBe(
      "anthony-x",
    );
    // A tagged link keeps its own utm_source whatever the brand.
    expect(channelRow(postRow(tagged, now, "6633336")).source).toBe(
      "instagram",
    );
    expect(networkSource("tiktok", "6633336")).toBe("mike-tt");
    expect(networkSource("youtube", "6626386")).toBe("youtube");
  });
});

const noAds = async () => [];

const webinarCampaign: MetricoolCampaign = {
  id: "120245678748410338",
  name: "LL - VP Masterclass Webinar | Leads | ABO - Sep 15 - 7:30 CT",
  spend: 2435.2,
  impressions: 66632,
  reach: 50000,
  clicks: 2809,
};

const googleCampaign: MetricoolCampaign = {
  id: "23805931083",
  name: "VP | W2 | Consideration",
  spend: 285.71,
  impressions: 1116,
  reach: null,
  clicks: 120,
};

describe("adRow", () => {
  it("keys Google by campaign id under google / cpc so spend meets the leads", () => {
    expect(adRow("googleads", googleCampaign, "2026-08-20")).toEqual({
      day: "2026-08-20",
      channel: null,
      source: "google",
      medium: "cpc",
      campaign: "23805931083",
      content: "VP | W2 | Consideration",
      term: null,
      spend: 285.71,
      impressions: 1116,
      reach: null,
      clicks: 120,
    });
  });

  it("sends a Meta campaign named for the webinar to the Webinar program", () => {
    expect(adRow("facebookads", webinarCampaign, "2026-08-20")).toMatchObject({
      channel: "Webinar",
      source: "meta_ads",
      medium: "paid",
      campaign: "120245678748410338",
    });
    expect(
      adRow(
        "facebookads",
        { ...webinarCampaign, name: "RT | Book Calls/Leads | ABO | US" },
        "2026-08-20",
      ).channel,
    ).toBeNull();
  });
});

describe("syncMetricool", () => {
  function buildClient() {
    const upserts: Record<string, Array<Record<string, unknown>>> = {};
    const runs: Array<Record<string, unknown>> = [];
    const from = vi.fn((name: string) =>
      name === "channel_sync_runs"
        ? {
            insert: vi.fn(
              async (row: Record<string, unknown>) => (
                runs.push(row),
                { error: null }
              ),
            ),
          }
        : {
            upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
              (upserts[name] ??= []).push(...rows);
              return { error: null };
            }),
            select: () => emptyQuery,
          },
    );
    const emptyQuery = {
      in: () => emptyQuery,
      gte: () => emptyQuery,
      lte: () => emptyQuery,
      not: () => emptyQuery,
      order: () => emptyQuery,
      range: async () => ({ data: [], error: null }),
    };
    return {
      client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
      upserts,
      runs,
    };
  }

  it("is skipped without a client or without brands", async () => {
    const { client } = buildClient();
    const result = await syncMetricool({ client, metricool: null, now });
    expect(result.connector.error).toMatch(/^skipped:/);
    const noBrands = await syncMetricool({
      client,
      metricool: {
        fetchPosts: async () => [tagged],
        fetchCampaigns: noAds,
        fetchYouTubeVideos: noAds,
      },
      blogIds: [],
      now,
    });
    expect(noBrands.connector.error).toMatch(/^skipped:/);
  });

  it("pulls every brand once and lets the first brand own a shared post", async () => {
    const { client, upserts } = buildClient();
    const fetchPosts = vi.fn(async ({ blogId }: { blogId: string }) =>
      blogId === "6626386" ? [noLink] : [noLink, untagged],
    );
    await syncMetricool({
      client,
      metricool: {
        fetchPosts,
        fetchCampaigns: noAds,
        fetchYouTubeVideos: noAds,
      },
      blogIds: ["6626386", "6633336"],
      now,
    });
    expect(fetchPosts.mock.calls.map(([arg]) => arg.blogId)).toEqual([
      "6626386",
      "6633336",
    ]);
    expect(upserts.metricool_posts).toEqual([
      expect.objectContaining({ post_id: "tt-3", brand_id: "6626386" }),
      expect.objectContaining({ post_id: "li-2", brand_id: "6633336" }),
    ]);
    expect(upserts.channel_daily?.map((row) => row.source)).toEqual([
      "x",
      "mike-li",
    ]);
  });

  it("stores posts, writes the spine, and an untagged link does not fail the run", async () => {
    const { client, upserts } = buildClient();
    const metricool: MetricoolClient = {
      fetchPosts: async () => [tagged, untagged, noLink, ytVideo],
      fetchCampaigns: noAds,
      fetchYouTubeVideos: noAds,
    };
    const result = await syncMetricool({
      client,
      metricool,
      blogIds: ["6626386"],
      now,
    });
    expect(result.connector).toMatchObject({
      connector: "metricool-posts",
      rowsWritten: 7,
      // The untagged post is flagged on its row for "Fix these links"; the
      // run itself succeeded.
      error: null,
    });
    expect(upserts.metricool_posts).toContainEqual(
      expect.objectContaining({ link_compliant: false }),
    );
    // The YouTube video is stored but its Seen is youtube-analytics' to write.
    expect(upserts.metricool_posts).toHaveLength(4);
    expect(
      upserts.channel_daily?.some((row) => row.content === "WNdORD-DJGQ"),
    ).toBe(false);
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        channel: "Instagram",
        campaign: "webinar-sept15",
        clicks: 40,
      }),
    );
  });

  it("writes one spine row per campaign per day from the first brand only", async () => {
    const { client, upserts, runs } = buildClient();
    const fetchCampaigns = vi.fn(
      async ({
        network,
        from,
      }: {
        blogId: string;
        network: string;
        from: string;
      }) =>
        network === "googleads"
          ? [googleCampaign]
          : from === "2026-09-11"
            ? [webinarCampaign]
            : [],
    );
    const result = await syncMetricool({
      client,
      metricool: {
        fetchPosts: async () => [],
        fetchCampaigns,
        fetchYouTubeVideos: noAds,
      },
      blogIds: ["6626386", "6633336"],
      now,
      days: 1,
    });
    expect(result.ads).toMatchObject({
      connector: "metricool-ads",
      rowsWritten: 3,
      error: null,
    });
    // Two days (yesterday and today) times two networks, one brand.
    expect(fetchCampaigns).toHaveBeenCalledTimes(4);
    expect(
      new Set(fetchCampaigns.mock.calls.map(([arg]) => arg.blogId)),
    ).toEqual(new Set(["6626386"]));
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        day: "2026-09-11",
        channel: "Google Ads",
        source: "google",
        medium: "cpc",
        campaign: "23805931083",
        spend: 285.71,
      }),
    );
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        day: "2026-09-11",
        channel: "Webinar",
        source: "meta_ads",
        campaign: "120245678748410338",
        spend: 2435.2,
      }),
    );
    expect(runs.map((run) => run.connector)).toEqual([
      "metricool-posts",
      "metricool-ads",
    ]);
  });

  it("clears a campaign day stored under the name it had before a rename", async () => {
    // Measured in production: the Sep 15 webinar campaign was renamed "Sep 22"
    // and its Sep 15 spend sat under both names, $462 + $698.43 against
    // Meta's $866.03 for the whole day.
    const stored = [
      {
        day: "2026-09-11",
        source: "meta_ads",
        medium: "paid",
        campaign: "120245678748410338",
        content: "LL - VP Masterclass Webinar | Sep 15",
        destination: "unknown",
      },
      {
        day: "2026-09-11",
        source: "meta_ads",
        medium: "paid",
        campaign: "120245678748410338",
        content: webinarCampaign.name,
        destination: "unknown",
      },
      // Another campaign's row the run did not write: not a rename, untouched.
      {
        day: "2026-09-11",
        source: "google",
        medium: "cpc",
        campaign: "999",
        content: "Paused campaign",
        destination: "unknown",
      },
    ];
    const upserts: Array<Record<string, unknown>> = [];
    const query = {
      select: () => query,
      in: () => query,
      gte: () => query,
      lte: () => query,
      not: () => query,
      order: () => query,
      range: async () => ({ data: stored, error: null }),
      upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
        upserts.push(...rows);
        return { error: null };
      }),
      insert: async () => ({ error: null }),
    };
    const client = { from: () => query } as unknown as Pick<
      SupabaseClient<Database>,
      "from"
    >;
    await syncMetricool({
      client,
      metricool: {
        fetchPosts: async () => [],
        fetchCampaigns: async ({ network, from }) =>
          network === "facebookads" && from === "2026-09-11"
            ? [webinarCampaign]
            : [],
        fetchYouTubeVideos: noAds,
      },
      blogIds: ["6626386"],
      now,
      days: 1,
    });
    const blanked = upserts.filter((row) => row.spend === null);
    expect(blanked).toEqual([
      expect.objectContaining({
        day: "2026-09-11",
        campaign: "120245678748410338",
        content: "LL - VP Masterclass Webinar | Sep 15",
        spend: null,
        impressions: null,
        reach: null,
        clicks: null,
      }),
    ]);
  });
});
