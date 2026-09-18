import { describe, expect, it } from "vitest";
import type { AttributionSession } from "@/lib/attribution-session";
import { eventContext, pageGroupFor, sourcePathFor } from "./event-context";

const session: AttributionSession = {
  version: 1,
  vp_session_id: "sess-1",
  first_landing_url:
    "https://www.vendingpreneurs.com/booking-youtube?utm_source=youtube",
  first_landing_path: "/booking-youtube",
  first_referrer: "https://www.youtube.com/",
  first_touch_at: "2026-09-18T10:00:00.000Z",
  latest_landing_url: "https://www.vendingpreneurs.com/contact",
  latest_landing_path: "/contact",
  latest_referrer: "",
  latest_touch_at: "2026-09-18T10:05:00.000Z",
  utm_source: "youtube",
  utm_medium: "video",
  utm_campaign: "q4",
};

describe("pageGroupFor", () => {
  it("classifies the booking funnels, post-conversion and lead magnets", () => {
    expect(pageGroupFor("/contact")).toBe("funnel");
    expect(pageGroupFor("/booking-youtube")).toBe("funnel");
    expect(pageGroupFor("/booking-ak-t5")).toBe("funnel");
    expect(pageGroupFor("/thank-you")).toBe("post_conversion");
    expect(pageGroupFor("/pre-call-resources")).toBe("post_conversion");
    expect(pageGroupFor("/resources/roadmap")).toBe("lead_magnet");
    expect(pageGroupFor("/start")).toBe("legacy_lead");
    expect(pageGroupFor("/news/some-post")).toBe("content");
    expect(pageGroupFor("/admin/analytics")).toBe("admin");
  });

  it("folds a retired funnel URL into the page it now renders", () => {
    expect(pageGroupFor("/booking-b5-socials")).toBe("funnel");
    expect(pageGroupFor("/Contact/")).toBe("funnel");
  });
});

describe("sourcePathFor", () => {
  it("prefers the redirect's ?source_path= over the page", () => {
    const url = new URL(
      "https://www.vendingpreneurs.com/contact?source_path=%2Fbooking-website&utm_source=x",
    );
    expect(sourcePathFor(url)).toBe("/booking-website");
  });

  it("folds a retired source_path the same way the funnel report does", () => {
    const url = new URL(
      "https://www.vendingpreneurs.com/contact?source_path=%2Fbook-my-advisory-call-accelerator",
    );
    expect(sourcePathFor(url)).toBe("/contact");
  });

  it("falls back to the canonical page path", () => {
    expect(
      sourcePathFor(
        new URL("https://www.vendingpreneurs.com/Booking-Meta/?x=1"),
      ),
    ).toBe("/booking-meta");
  });
});

describe("eventContext", () => {
  it("stamps the join key, source_path, page group and session UTMs", () => {
    const props = eventContext({
      url: new URL("https://www.vendingpreneurs.com/contact"),
      session,
      environment: "production",
    });
    expect(props).toMatchObject({
      vp_session_id: "sess-1",
      source_path: "/contact",
      page_group: "funnel",
      environment: "production",
      utm_source: "youtube",
      vp_utm_source: "youtube",
      vp_utm_medium: "video",
      vp_utm_campaign: "q4",
      vp_first_landing_path: "/booking-youtube",
    });
    expect(props).not.toHaveProperty("vp_utm_term");
  });

  it("never overwrites a utm_source PostHog already captured", () => {
    const props = eventContext({
      url: new URL("https://www.vendingpreneurs.com/?utm_source=meta"),
      session,
      environment: "production",
      existing: { utm_source: "meta" },
    });
    expect(props).not.toHaveProperty("utm_source");
    expect(props.vp_utm_source).toBe("youtube");
  });

  it("still stamps page context with no first-party session", () => {
    const props = eventContext({
      url: new URL("https://www.vendingpreneurs.com/news/post"),
      session: null,
      environment: "preview",
    });
    expect(props).toEqual({
      source_path: "/news/post",
      page_group: "content",
      environment: "preview",
    });
  });
});
