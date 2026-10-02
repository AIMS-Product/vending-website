import { describe, expect, it } from "vitest";
import {
  buildPaidAttributionProperties,
  channelFromAttributionSignals,
  paidAttributionMetadata,
} from "./paid-attribution";

describe("channelFromAttributionSignals, paid click ids", () => {
  it.each([
    ["gclid", { gclid: "abc" }, "google_ads"],
    ["gbraid", { gbraid: "abc" }, "google_ads"],
    ["wbraid", { wbraid: "abc" }, "google_ads"],
    ["Google ad group id", { adGroupId: "123" }, "google_ads"],
    ["fbclid", { fbclid: "abc" }, "meta_ads"],
    ["Meta ad set id", { adsetId: "123" }, "meta_ads"],
  ] as const)("%s marks the lead as %s", (_label, input, expected) => {
    expect(channelFromAttributionSignals(input)).toBe(expected);
  });

  it("lets an explicit paid platform win over a click id from the other network", () => {
    expect(
      channelFromAttributionSignals({ paidPlatform: "meta_ads", gclid: "abc" }),
    ).toBe("meta_ads");
  });
});

describe("channelFromAttributionSignals, platform aliases", () => {
  it.each([
    ["google", "google_ads"],
    ["googleads", "google_ads"],
    ["Google_Ads", "google_ads"],
    ["google-ads", "google_ads"],
    ["meta", "meta_ads"],
    ["facebook", "meta_ads"],
    ["facebook_ads", "meta_ads"],
    ["Facebook-Ads", "meta_ads"],
    ["instagram", "meta_ads"],
  ])("paid platform %j resolves to %s", (paidPlatform, expected) => {
    expect(channelFromAttributionSignals({ paidPlatform })).toBe(expected);
  });

  it("does not invent a platform from an unknown name", () => {
    expect(channelFromAttributionSignals({ paidPlatform: "tiktok" })).toBe(
      "direct",
    );
  });
});

describe("channelFromAttributionSignals, utm source and medium", () => {
  it.each([
    [{ utmSource: "google", utmMedium: "cpc" }, "google_ads"],
    [{ utmSource: "facebook", utmMedium: "paid_social" }, "meta_ads"],
    [{ utmSource: "instagram", utmMedium: "story" }, "meta_ads"],
    [{ utmSource: "newsletter", utmMedium: "cpc" }, "google_ads"],
    [{ utmSource: "youtube", utmMedium: "video" }, "youtube"],
    [{ utmSource: "kit", utmMedium: "email" }, "email"],
    [{ utmSource: "linkedin", utmMedium: "social" }, "social"],
  ] as const)("%j is %s", (input, expected) => {
    expect(channelFromAttributionSignals(input)).toBe(expected);
  });
});

describe("channelFromAttributionSignals, referrer fallback", () => {
  it("is referral when only a referrer is known", () => {
    expect(
      channelFromAttributionSignals({ referrer: "https://example.com/post" }),
    ).toBe("referral");
    expect(
      channelFromAttributionSignals({
        latestReferrer: "https://example.com/post",
      }),
    ).toBe("referral");
  });

  it("is direct when nothing is known", () => {
    expect(channelFromAttributionSignals({})).toBe("direct");
    expect(
      channelFromAttributionSignals({ utmSource: null, referrer: "" }),
    ).toBe("direct");
  });

  it("prefers a utm channel over the referrer", () => {
    expect(
      channelFromAttributionSignals({
        utmSource: "youtube",
        referrer: "https://www.youtube.com/",
      }),
    ).toBe("youtube");
  });
});

describe("buildPaidAttributionProperties", () => {
  it("keeps only the fields that carry a value", () => {
    expect(
      buildPaidAttributionProperties({
        gclid: "g1",
        fbclid: "",
        campaignId: null,
        adName: undefined,
      }),
    ).toEqual({ gclid: "g1", paid_platform: "google_ads" });
  });

  it("derives the group from the ad set on Meta and the ad group on Google", () => {
    expect(
      buildPaidAttributionProperties({
        fbclid: "f1",
        adsetId: "set-1",
        adsetName: "Set One",
      }),
    ).toMatchObject({ group_id: "set-1", group_name: "Set One" });
    expect(
      buildPaidAttributionProperties({
        gclid: "g1",
        adGroupId: "grp-1",
        adGroupName: "Group One",
      }),
    ).toMatchObject({ group_id: "grp-1", group_name: "Group One" });
  });

  it("builds a source key from platform, campaign, group and ad", () => {
    expect(
      buildPaidAttributionProperties({
        fbclid: "f1",
        campaignId: "c1",
        adsetId: "s1",
        adId: "a1",
      }).paid_source_key,
    ).toBe("meta_ads:c1:s1:a1");
    expect(
      buildPaidAttributionProperties({
        gclid: "g1",
        campaignId: "c1",
        adGroupId: "ag1",
        adId: "a1",
      }).paid_source_key,
    ).toBe("google_ads:c1:ag1:a1");
  });

  it("leaves the source key out when a part is missing, and honours an explicit key", () => {
    expect(
      buildPaidAttributionProperties({ fbclid: "f1", campaignId: "c1" })
        .paid_source_key,
    ).toBeUndefined();
    expect(
      buildPaidAttributionProperties({
        fbclid: "f1",
        paidSourceKey: "custom-key",
      }).paid_source_key,
    ).toBe("custom-key");
  });

  it("returns nothing for an organic visit", () => {
    expect(buildPaidAttributionProperties({ utmSource: "newsletter" })).toEqual(
      {},
    );
  });
});

describe("paidAttributionMetadata", () => {
  it("nests the properties under paid_attribution", () => {
    expect(paidAttributionMetadata({ gclid: "g1" })).toEqual({
      paid_attribution: { gclid: "g1", paid_platform: "google_ads" },
    });
  });

  it("is an empty object when there is nothing to record", () => {
    expect(paidAttributionMetadata({})).toEqual({});
  });
});
