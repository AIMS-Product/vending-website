import { describe, expect, it } from "vitest";
import {
  mergeLeadAttributionWithSession,
  parseAttributionSession,
  serializeAttributionSession,
  updateAttributionSessionFromPage,
} from "./attribution-session";
import { emptyLeadAttribution } from "./lead-attribution";

describe("attribution session", () => {
  it("preserves first-touch attribution across internal navigation", () => {
    const first = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/landing/foo?utm_source=facebook&utm_medium=paid_social&campaign_id=camp-1&adset_id=set-1&ad_id=ad-1&fbclid=click-1",
      referrer: "https://facebook.com/",
      nowIso: "2026-06-26T00:00:00.000Z",
      sessionIdFactory: () => "vp-session-1",
    });

    const next = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/apply",
      referrer: "https://www.vendingpreneurs.com/landing/foo",
      existing: first,
      nowIso: "2026-06-26T00:05:00.000Z",
      sessionIdFactory: () => "vp-session-new",
    });

    expect(next.vp_session_id).toBe("vp-session-1");
    expect(next.first_landing_path).toBe("/landing/foo");
    expect(next.latest_landing_path).toBe("/landing/foo");
    expect(next.campaign_id).toBe("camp-1");
    expect(next.adset_id).toBe("set-1");
    expect(next.ad_id).toBe("ad-1");
    expect(next.fbclid).toBe("click-1");
  });

  it("recovers the tags from our own tagged referrer when the session starts late", () => {
    // Production, 2026-09-17: a visitor landed on /?utm_source=ig&... and
    // clicked through to /contact before the homepage stored a session, so
    // the lead arrived untagged although its referrer carried every tag.
    const session = updateAttributionSessionFromPage({
      href: "https://vendingpreneurs.com/contact?source_path=%2F&clicked_href=%2Fcontact",
      referrer:
        "https://vendingpreneurs.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=abc",
      nowIso: "2026-09-17T10:41:36.371Z",
      sessionIdFactory: () => "vp-session-late",
    });

    expect(session.utm_source).toBe("ig");
    expect(session.utm_medium).toBe("social");
    expect(session.utm_content).toBe("link_in_bio");
    expect(session.fbclid).toBe("abc");
  });

  it("never takes tags from another site's referrer", () => {
    const session = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/contact",
      referrer: "https://partner.example.com/?utm_source=partner",
      nowIso: "2026-09-17T10:41:36.371Z",
      sessionIdFactory: () => "vp-session-ext",
    });

    expect(session.utm_source ?? "").toBe("");
  });

  it("updates latest-touch fields when a new paid payload appears", () => {
    const first = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/landing/foo?utm_source=facebook&campaign_id=camp-1&ad_id=ad-1",
      referrer: "https://facebook.com/",
      nowIso: "2026-06-26T00:00:00.000Z",
      sessionIdFactory: () => "vp-session-1",
    });

    const next = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/landing/bar?utm_source=google&utm_medium=cpc&campaign_id=camp-2&ad_group_id=group-2&ad_id=ad-2&gclid=click-2",
      referrer: "https://www.google.com/",
      existing: first,
      nowIso: "2026-06-26T01:00:00.000Z",
      sessionIdFactory: () => "vp-session-new",
    });

    expect(next.first_landing_path).toBe("/landing/foo");
    expect(next.latest_landing_path).toBe("/landing/bar");
    expect(next.campaign_id).toBe("camp-2");
    expect(next.ad_group_id).toBe("group-2");
    expect(next.ad_id).toBe("ad-2");
    expect(next.gclid).toBe("click-2");
  });

  it("round-trips storage and merges stored attribution into form fields", () => {
    const session = updateAttributionSessionFromPage({
      href: "https://www.vendingpreneurs.com/landing/foo?utm_source=google&utm_medium=cpc&campaign_id=camp-1&ad_group_id=group-1&ad_id=ad-1&gclid=click-1",
      referrer: "https://www.google.com/",
      nowIso: "2026-06-26T00:00:00.000Z",
      sessionIdFactory: () => "vp-session-1",
    });
    const parsed = parseAttributionSession(
      serializeAttributionSession(session),
    );
    const merged = mergeLeadAttributionWithSession(
      emptyLeadAttribution("/apply"),
      parsed,
    );

    expect(merged.vp_session_id).toBe("vp-session-1");
    expect(merged.source_path).toBe("/landing/foo");
    expect(merged.landing_path).toBe("/apply");
    expect(merged.first_landing_path).toBe("/landing/foo");
    expect(merged.latest_landing_path).toBe("/landing/foo");
    expect(merged.campaign_id).toBe("camp-1");
    expect(merged.ad_group_id).toBe("group-1");
    expect(merged.ad_id).toBe("ad-1");
    expect(merged.gclid).toBe("click-1");
  });
});
