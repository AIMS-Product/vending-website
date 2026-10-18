import { describe, expect, it } from "vitest";
import { mikeBioLinks, mikeBioInternalHref } from "./mike-bio";
import { linkStandardSchema } from "@/lib/analytics/link-standard";
import { appendSessionClickAttributionToHref } from "@/lib/lead-attribution-links";
import { updateAttributionSessionFromPage } from "@/lib/attribution-session";
import { hidesChatWidget, isBookingFunnelPath } from "./booking-funnel-routes";
import { isMikeBioPath } from "@/lib/routing/mike-bio";
import { isUnknownSingleSegmentPublicPath } from "@/lib/routing/single-segment-routes";
import { POPUPS, popupMatchesPath } from "./popups";

describe("Mike Instagram bio hub", () => {
  it("uses five valid and distinct placement tags", () => {
    const contents = new Set<string>();
    for (const href of Object.values(mikeBioLinks)) {
      const url = new URL(href);
      const p = url.searchParams;
      expect(
        linkStandardSchema.safeParse({
          baseUrl: url.origin + url.pathname,
          source: p.get("utm_source"),
          medium: p.get("utm_medium"),
          campaign: p.get("utm_campaign"),
          content: p.get("utm_content"),
          destination: p.get("utm_term"),
        }).success,
      ).toBe(true);
      expect(p.get("utm_source")).toBe("instagram");
      expect(p.get("utm_campaign")).toBe("mh-ig-bio");
      contents.add(p.get("utm_content")!);
    }
    expect(contents.size).toBe(5);
    expect(new URL(mikeBioLinks.video).searchParams.get("v")).toBe(
      "3HDu68I0_-o",
    );
  });

  it("carries the browser and CTA source into the existing booking funnel without replacing its placement tags", () => {
    const session = updateAttributionSessionFromPage({
      href: mikeBioLinks.entry,
      nowIso: "2026-10-18T12:00:00Z",
      sessionIdFactory: () => "bio-session",
    });
    const href = appendSessionClickAttributionToHref({
      href: mikeBioInternalHref(mikeBioLinks.booking),
      session,
      context: {
        sourcePath: "/mike",
        sourcePageSlug: "mike-ig-bio",
        sourceCtaTrackingName: "bio-booking",
      },
    });
    const url = new URL(href, "https://www.vendingpreneurs.com");
    expect(url.pathname).toBe("/booking-t5-socials");
    expect(url.searchParams.get("vp_session_id")).toBe("bio-session");
    expect(url.searchParams.get("source_path")).toBe("/mike");
    expect(url.searchParams.get("utm_content")).toBe("bio-v1-book-call");
    expect(session.utm_content).toBe("bio-v1");
    expect(session.first_landing_path).toBe("/mike");
  });

  it("keeps the route reachable and removes distractions without classifying it as a booking form", () => {
    expect(isUnknownSingleSegmentPublicPath("/mike")).toBe(false);
    expect(isMikeBioPath("/mike")).toBe(true);
    expect(isMikeBioPath("/mike-other")).toBe(false);
    expect(isBookingFunnelPath("/mike")).toBe(false);
    expect(hidesChatWidget("/mike")).toBe(true);
    for (const popup of POPUPS)
      expect(popupMatchesPath(popup, "/mike")).toBe(false);
  });
});
