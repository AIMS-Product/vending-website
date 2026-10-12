import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: {} }));

import { createMetaAdsClient } from "./ads-client";

const row = (day: string, spend: string) => ({
  date_start: day,
  campaign_id: "120251321060910338",
  campaign_name: "LL - VP Masterclass Webinar | Purchase",
  spend,
  impressions: "81542",
  clicks: "9753",
});

describe("createMetaAdsClient", () => {
  it("parses string metrics, follows Graph paging, and refuses other hosts", async () => {
    const pages: Record<string, unknown> = {
      first: {
        data: [row("2026-10-05", "1210.22")],
        paging: { next: "https://graph.facebook.com/v21.0/next-page" },
      },
      second: {
        data: [row("2026-10-06", "988.10")],
        paging: { next: "https://evil.example/steal" },
      },
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const body = url.includes("next-page") ? pages.second : pages.first;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const client = createMetaAdsClient({
      accessToken: "t",
      adAccountId: "1318510052808578",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const rows = await client.fetchCampaignDays({
      startDate: "2026-10-05",
      endDate: "2026-10-06",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      "/act_1318510052808578/insights?",
    );
    expect(rows).toEqual([
      expect.objectContaining({
        day: "2026-10-05",
        spend: 1210.22,
        clicks: 9753,
        reach: null,
      }),
      expect.objectContaining({ day: "2026-10-06", spend: 988.1 }),
    ]);
  });

  it("throws on an API error instead of reading it as no spend", async () => {
    const client = createMetaAdsClient({
      accessToken: "t",
      adAccountId: "act_1",
      fetchImpl: (async () =>
        new Response('{"error":{"message":"bad"}}', {
          status: 400,
        })) as unknown as typeof fetch,
    });
    await expect(
      client.fetchCampaignDays({
        startDate: "2026-10-05",
        endDate: "2026-10-05",
      }),
    ).rejects.toThrow(/Meta insights 400/);
  });
});
