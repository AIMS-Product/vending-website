import { describe, expect, it } from "vitest";
import {
  appendLeadAttributionToHref,
  appendSessionClickAttributionToHref,
  shouldPreserveLeadAttribution,
} from "./lead-attribution-links";
import { emptyLeadAttribution } from "./lead-attribution";
import type { AttributionSession } from "./attribution-session";

describe("lead attribution links", () => {
  it("preserves full attribution for server-rendered lead destination links", () => {
    const href = appendLeadAttributionToHref({
      href: "/apply?existing=1",
      attribution: {
        ...emptyLeadAttribution("/landing/foo"),
        vp_session_id: "vp-session-1",
        campaign_id: "camp-1",
        ad_group_id: "group-1",
        ad_id: "ad-1",
        gclid: "click-1",
      },
      context: {
        sourcePath: "/landing/foo",
        sourcePageId: "page_1",
        sourcePageSlug: "foo",
        sourceBlockId: "block_cta",
        sourceCtaTrackingName: "hero_apply",
        clickedHref: "/apply",
      },
    });

    expect(href).toContain("/apply?");
    expect(href).toContain("existing=1");
    expect(href).toContain("vp_session_id=vp-session-1");
    expect(href).toContain("campaign_id=camp-1");
    expect(href).toContain("ad_group_id=group-1");
    expect(href).toContain("ad_id=ad-1");
    expect(href).toContain("gclid=click-1");
    expect(href).toContain("source_page_id=page_1");
    expect(href).toContain("source_block_id=block_cta");
    expect(href).toContain("source_cta_tracking_name=hero_apply");
  });

  it("adds only session and click context for client-side CTA clicks", () => {
    const session: AttributionSession = {
      version: 1,
      vp_session_id: "vp-session-1",
      first_landing_url: "https://www.vendingpreneurs.com/landing/foo",
      first_landing_path: "/landing/foo",
      first_referrer: "https://facebook.com/",
      first_touch_at: "2026-06-26T00:00:00.000Z",
      latest_landing_url: "https://www.vendingpreneurs.com/landing/foo",
      latest_landing_path: "/landing/foo",
      latest_referrer: "https://facebook.com/",
      latest_touch_at: "2026-06-26T00:00:00.000Z",
      campaign_id: "camp-1",
      ad_id: "ad-1",
    };

    const href = appendSessionClickAttributionToHref({
      href: "/contact",
      session,
      context: {
        sourcePath: "/landing/foo",
        sourceBlockId: "block_cta",
        clickedHref: "/contact",
      },
    });

    expect(href).toBe(
      "/contact?vp_session_id=vp-session-1&source_path=%2Flanding%2Ffoo&source_block_id=block_cta&clicked_href=%2Fcontact",
    );
  });

  it("covers legacy lead routes and ignores external links", () => {
    expect(shouldPreserveLeadAttribution("/booking-meta")).toBe(true);
    expect(shouldPreserveLeadAttribution("https://example.com/apply")).toBe(
      false,
    );
  });
});
