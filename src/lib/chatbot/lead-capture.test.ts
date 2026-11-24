import { describe, expect, it } from "vitest";
import { chatbotAttributionFields } from "./lead-capture";

const session = {
  version: 1,
  vp_session_id: "vp-abc",
  first_landing_url:
    "https://www.vendingpreneurs.com/booking-youtube?utm_source=youtube",
  first_landing_path: "/booking-youtube",
  first_referrer: "https://www.youtube.com/",
  first_touch_at: "2026-11-24T00:00:00.000Z",
  latest_landing_url: "",
  latest_landing_path: "",
  latest_referrer: "",
  latest_touch_at: "",
  utm_source: "youtube",
  utm_medium: "video",
  utm_campaign: "abc123",
  gclid: "g-1",
};

describe("chatbotAttributionFields", () => {
  it("carries the visitor's UTMs, click id and session onto the lead", () => {
    expect(chatbotAttributionFields(session)).toMatchObject({
      vpSessionId: "vp-abc",
      utmSource: "youtube",
      utmMedium: "video",
      utmCampaign: "abc123",
      gclid: "g-1",
      firstLandingPath: "/booking-youtube",
      referrer: "https://www.youtube.com/",
    });
  });

  it("cuts an over-long value instead of failing the lead", () => {
    const fields = chatbotAttributionFields({
      ...session,
      utm_source: "x".repeat(500),
    });
    expect(fields.utmSource).toHaveLength(160);
  });

  it("returns nothing for a missing or malformed session", () => {
    for (const raw of [undefined, null, "nope", 7, [], { version: 2 }]) {
      expect(chatbotAttributionFields(raw)).toEqual({});
    }
  });
});
