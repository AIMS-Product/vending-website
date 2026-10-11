import { describe, expect, it } from "vitest";
import { liveAdsOf, servedCopy } from "./google-ads-live-ads";

const status = (adId: string, over: Record<string, unknown> = {}) => ({
  ad_id: adId,
  campaign_id: "w2",
  ad_group_name: "Research",
  ad_group_status: "ENABLED",
  status: "ENABLED",
  approval_status: "APPROVED",
  review_status: "REVIEWED",
  ...over,
});

describe("liveAdsOf", () => {
  const campaigns = new Map([["w2", "VP | W2"]]);

  it("keeps only ads that can serve, with copy and range spend", () => {
    const out = liveAdsOf(
      [
        status("1"),
        status("2", { status: "PAUSED" }),
        status("3", { approval_status: "DISAPPROVED" }),
        status("4", { campaign_id: "paused-campaign" }),
        status("5", { ad_group_status: "PAUSED" }),
      ],
      [
        {
          adId: "1",
          headlines: ["H1", "H2"],
          descriptions: ["D1"],
          finalUrls: ["https://x.com/contact"],
        },
      ],
      [
        {
          adId: "1",
          campaign: "VP | W2",
          adGroup: "Research",
          headlines: [],
          landing: null,
          status: "ENABLED",
          approval: "APPROVED",
          spend: 42,
          clicks: 7,
          impressions: 90,
        },
      ],
      campaigns,
      new Map(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      adId: "1",
      campaign: "VP | W2",
      headlines: ["H1", "H2"],
      landing: "https://x.com/contact",
      spend: 42,
    });
  });

  it("falls back to served copy and flags ads in review", () => {
    const served = servedCopy([
      {
        ad_id: "1",
        day: "2026-10-01",
        headlines: ["Old"],
        descriptions: [],
        final_urls: [],
      },
      {
        ad_id: "1",
        day: "2026-10-05",
        headlines: ["New"],
        descriptions: ["D"],
        final_urls: ["u"],
      },
    ]);
    const [ad] = liveAdsOf(
      [status("1", { review_status: "REVIEW_IN_PROGRESS" })],
      [],
      [],
      campaigns,
      served,
    );
    expect(ad.headlines).toEqual(["New"]);
    expect(ad.inReview).toBe(true);
    expect(ad.spend).toBe(0);
  });
});
