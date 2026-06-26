import { describe, expect, it } from "vitest";
import { buildLeadAttribution } from "./lead-attribution";

describe("buildLeadAttribution", () => {
  it("captures Google paid click and ad identifiers from landing params", () => {
    expect(
      buildLeadAttribution(
        {
          utm_source: "google",
          utm_medium: "cpc",
          gclid: "gclid-1",
          gbraid: "gbraid-1",
          campaign_id: "camp-1",
          campaign_name: "Search campaign",
          ad_group_id: "group-1",
          ad_group_name: "Search group",
          ad_id: "ad-1",
          ad_name: "Search ad",
        },
        "/apply",
      ),
    ).toMatchObject({
      gclid: "gclid-1",
      gbraid: "gbraid-1",
      campaign_id: "camp-1",
      campaign_name: "Search campaign",
      ad_group_id: "group-1",
      ad_group_name: "Search group",
      ad_id: "ad-1",
      ad_name: "Search ad",
    });
  });

  it("captures Meta paid click and ad set identifiers from landing params", () => {
    expect(
      buildLeadAttribution(
        {
          utm_source: "facebook",
          utm_medium: "paid_social",
          fbclid: "fbclid-1",
          campaignId: "camp-2",
          adSetId: "set-2",
          adset_name: "Prospecting set",
          adId: "ad-2",
          adName: "Meta ad",
        },
        "/contact",
      ),
    ).toMatchObject({
      fbclid: "fbclid-1",
      campaign_id: "camp-2",
      adset_id: "set-2",
      adset_name: "Prospecting set",
      ad_id: "ad-2",
      ad_name: "Meta ad",
    });
  });
});
