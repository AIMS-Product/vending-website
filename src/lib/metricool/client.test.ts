import { describe, expect, it, vi } from "vitest";
import { createMetricoolClient, readMetric, toIso } from "./client";

function buildFetch(
  handler: (url: string) => { status: number; body: unknown },
) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: init?.headers as Record<string, string> });
      const handled = handler(url);
      return {
        ok: handled.status >= 200 && handled.status < 300,
        status: handled.status,
        text: async () => JSON.stringify(handled.body),
      } as unknown as Response;
    },
  );
  return { fetchImpl, calls };
}

describe("createMetricoolClient", () => {
  it("authenticates with X-Mc-Auth plus userId and blogId and normalises posts", async () => {
    const summaryBody = {
      data: [
        {
          id: "p1",
          network: "INSTAGRAM",
          text: "New video https://www.vendingpreneurs.com/book?utm_source=instagram",
          link: "https://www.instagram.com/p/abc/",
          publicationDate: {
            dateTime: "2026-09-10T09:00:00",
            timezone: "America/Los_Angeles",
          },
          metrics: { IMPRESSIONS: 1500 },
        },
        { id: "broken", network: "facebook" },
      ],
      page: { next: null },
    };
    // Instagram typed ids differ from the summary ids; the URL joins them.
    const typedBody = {
      data: [
        {
          postId: "media-1",
          url: "https://instagram.com/p/abc",
          reach: 1200,
          clicks: 40,
          blogId: 99,
        },
      ],
    };
    const { fetchImpl, calls } = buildFetch((url) => ({
      status: 200,
      body: url.includes("brand-summary")
        ? summaryBody
        : url.includes("posts/instagram")
          ? typedBody
          : { data: [] },
    }));
    const client = createMetricoolClient({
      apiKey: "tok",
      userId: "u1",
      fetchImpl,
    });
    const posts = await client.fetchPosts({
      blogId: "b1",
      from: "2026-09-01",
      to: "2026-09-11",
    });
    expect(posts).toEqual([
      {
        id: "p1",
        network: "instagram",
        text: "New video https://www.vendingpreneurs.com/book?utm_source=instagram",
        permalink: "https://www.instagram.com/p/abc/",
        publishedAt: "2026-09-10T16:00:00.000Z",
        metrics: { IMPRESSIONS: 1500, reach: 1200, clicks: 40 },
      },
    ]);
    // One summary call plus the two Instagram typed endpoints.
    expect(
      calls.map((call) => new URL(call.url).pathname.split("/analytics/")[1]),
    ).toEqual(["brand-summary/posts", "posts/instagram", "reels/instagram"]);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/api/v2/analytics/brand-summary/posts");
    expect(url.searchParams.get("userId")).toBe("u1");
    expect(url.searchParams.get("blogId")).toBe("b1");
    expect(url.searchParams.get("from")).toBe("2026-09-01T00:00:00");
    expect(calls[0]!.headers["X-Mc-Auth"]).toBe("tok");
  });

  it("treats a 403 from a typed endpoint as not connected", async () => {
    const { fetchImpl } = buildFetch((url) =>
      url.includes("brand-summary")
        ? { status: 200, body: { data: [post("p1")] } }
        : { status: 403, body: { title: "Forbidden" } },
    );
    const client = createMetricoolClient({
      apiKey: "tok",
      userId: "u1",
      fetchImpl,
    });
    const posts = await client.fetchPosts({
      blogId: "b1",
      from: "2026-09-01",
      to: "2026-09-11",
    });
    expect(posts.map((row) => row.id)).toEqual(["p1"]);
  });

  it("follows a full-URL page.next and stops on anything else", async () => {
    const { fetchImpl, calls } = buildFetch((url) =>
      !url.includes("brand-summary")
        ? { status: 200, body: { data: [] } }
        : url.includes("cursor=2")
          ? {
              status: 200,
              body: { data: [post("p2")], page: { next: "opaque-token" } },
            }
          : {
              status: 200,
              body: {
                data: [post("p1")],
                page: {
                  next: "https://app.metricool.com/api/v2/analytics/brand-summary/posts?cursor=2",
                },
              },
            },
    );
    const client = createMetricoolClient({
      apiKey: "tok",
      userId: "u1",
      fetchImpl,
    });
    const posts = await client.fetchPosts({
      blogId: "b1",
      from: "2026-09-01",
      to: "2026-09-11",
    });
    expect(posts.map((row) => row.id)).toEqual(["p1", "p2"]);
    expect(calls.filter((c) => c.url.includes("brand-summary"))).toHaveLength(
      2,
    );
  });
});

function post(id: string) {
  return {
    id,
    network: "facebook",
    text: "",
    publicationDate: { dateTime: "2026-09-10T09:00:00Z" },
  };
}

describe("readMetric", () => {
  it("accepts numbers or {value} under any listed name, else null", () => {
    expect(readMetric({ Reach: 10 }, ["reach"])).toBe(10);
    expect(
      readMetric({ impressionsTotal: { value: 7.6 } }, [
        "impressions",
        "impressionsTotal",
      ]),
    ).toBe(8);
    expect(readMetric({ clicks: "n/a" }, ["clicks"])).toBeNull();
  });
});

describe("toIso", () => {
  it("resolves a local wall-clock time through its zone", () => {
    expect(toIso("2026-01-10T09:00:00", "America/Los_Angeles")).toBe(
      "2026-01-10T17:00:00.000Z",
    );
    expect(toIso("2026-09-10T09:00:00Z", undefined)).toBe(
      "2026-09-10T09:00:00.000Z",
    );
  });
});
