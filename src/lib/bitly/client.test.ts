import { describe, expect, it, vi } from "vitest";
import {
  BitlyApiError,
  campaignFromLongUrl,
  createBitlyClient,
} from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchImpl: typeof fetch) {
  return createBitlyClient({
    accessToken: "token",
    baseUrl: "https://bitly.test/v4",
    fetchImpl,
  });
}

describe("campaignFromLongUrl", () => {
  it("reads the campaign off a tracked link", () => {
    expect(
      campaignFromLongUrl(
        "https://www.vendingpreneurs.com/booking-youtube?utm_source=youtube&utm_medium=video&utm_campaign=how-much-vending&utm_content=desc-link-1",
      ),
    ).toBe("how-much-vending");
  });

  it("returns null for a link with no campaign, and never throws", () => {
    expect(campaignFromLongUrl("https://example.com/no-utms")).toBeNull();
    expect(campaignFromLongUrl("not a url")).toBeNull();
    expect(campaignFromLongUrl("")).toBeNull();
  });
});

describe("dailyClicks", () => {
  it("normalises Bitly's timestamps down to calendar days", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        link_clicks: [
          { date: "2026-09-09T00:00:00+0000", clicks: 12 },
          { date: "2026-09-08T00:00:00+0000", clicks: 0 },
        ],
      }),
    ) as unknown as typeof fetch;

    const series = await client(fetchImpl).dailyClicks("bit.ly/abc", {
      days: 2,
    });

    expect(series).toEqual([
      { date: "2026-09-09", clicks: 12 },
      { date: "2026-09-08", clicks: 0 },
    ]);
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(url).toContain("/bitlinks/bit.ly%2Fabc/clicks");
    expect(url).toContain("unit=day");
    expect(url).toContain("units=2");
  });

  it("drops entries with an unusable date rather than inventing one", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        link_clicks: [
          { date: null, clicks: 5 },
          { date: "whenever", clicks: 5 },
          { date: "2026-09-09T00:00:00+0000", clicks: 5 },
        ],
      }),
    ) as unknown as typeof fetch;

    expect(await client(fetchImpl).dailyClicks("bit.ly/abc")).toEqual([
      { date: "2026-09-09", clicks: 5 },
    ]);
  });

  it("never reports negative or fractional clicks", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        link_clicks: [
          { date: "2026-09-09T00:00:00+0000", clicks: -4 },
          { date: "2026-09-08T00:00:00+0000", clicks: 2.9 },
        ],
      }),
    ) as unknown as typeof fetch;

    expect(await client(fetchImpl).dailyClicks("bit.ly/abc")).toEqual([
      { date: "2026-09-09", clicks: 0 },
      { date: "2026-09-08", clicks: 2 },
    ]);
  });

  it("raises a typed error carrying the status", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "RATE_LIMIT_EXCEEDED" }, 429),
    ) as unknown as typeof fetch;

    await expect(client(fetchImpl).dailyClicks("bit.ly/abc")).rejects.toThrow(
      BitlyApiError,
    );
  });
});

describe("listGroupLinks", () => {
  it("follows the search_after cursor and stops when it runs out", async () => {
    const pages = [
      jsonResponse({
        links: [
          {
            id: "booking.vp.com/a",
            long_url: "https://x.test/?utm_campaign=a",
          },
        ],
        pagination: { search_after: "cursor-1" },
      }),
      jsonResponse({
        links: [
          {
            id: "booking.vp.com/b",
            long_url: "https://x.test/?utm_campaign=b",
          },
        ],
        pagination: {},
      }),
    ];
    let call = 0;
    const fetchImpl = vi.fn(
      async () => pages[call++]!,
    ) as unknown as typeof fetch;

    const links = await client(fetchImpl).listGroupLinks("grp", { size: 1 });

    expect(links.map((link) => link.id)).toEqual([
      "booking.vp.com/a",
      "booking.vp.com/b",
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, second] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls as Array<[string]>;
    expect(second[0]).toContain("search_after=cursor-1");
  });

  it("skips links missing an id or a long url", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        links: [
          { id: null, long_url: "https://x.test/" },
          { id: "booking.vp.com/a", long_url: null },
          { id: "booking.vp.com/b", long_url: "https://x.test/" },
        ],
        pagination: {},
      }),
    ) as unknown as typeof fetch;

    const links = await client(fetchImpl).listGroupLinks("grp");
    expect(links).toEqual([
      { id: "booking.vp.com/b", longUrl: "https://x.test/", title: null },
    ]);
  });

  it("stops at maxPages so a broken cursor cannot loop forever", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        links: [{ id: "a", long_url: "https://x.test/" }],
        // Bitly always hands back the same cursor: without the page cap this
        // would page until the function timed out.
        pagination: { search_after: "same-cursor" },
      }),
    ) as unknown as typeof fetch;

    await client(fetchImpl).listGroupLinks("grp", { maxPages: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
