import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MetricoolClient, MetricoolPost } from "@/lib/metricool/client";

vi.mock("@/lib/config", () => ({ config: {} }));

import {
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
          },
    );
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
      metricool: { fetchPosts: async () => [tagged] },
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
      metricool: { fetchPosts },
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

  it("stores posts, writes the spine and reports non-compliant links", async () => {
    const { client, upserts } = buildClient();
    const metricool: MetricoolClient = {
      fetchPosts: async () => [tagged, untagged, noLink],
    };
    const result = await syncMetricool({
      client,
      metricool,
      blogIds: ["6626386"],
      now,
    });
    expect(result.connector).toMatchObject({
      connector: "metricool-posts",
      rowsWritten: 6,
      error: "1 posts link somewhere without the standard UTMs.",
    });
    expect(upserts.metricool_posts).toHaveLength(3);
    expect(upserts.channel_daily).toContainEqual(
      expect.objectContaining({
        channel: "Instagram",
        campaign: "webinar-sept15",
        clicks: 40,
      }),
    );
  });
});
