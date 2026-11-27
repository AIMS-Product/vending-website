import { describe, expect, it } from "vitest";
import {
  getLegacyLeadRoute,
  isLegacyLeadPath,
  legacyLeadRoutes,
} from "@/lib/content/legacy-routes";
import { buildCalendlySrc } from "@/lib/content/lead-embed";
import { buildLeadAttribution } from "@/lib/lead-attribution";
import { isFirstCallCalendar } from "@/lib/services/team-report";
import { CONTACT_CLONE_SLUGS } from "@/lib/content/contact-clone-pages";
import { APP_TOP_LEVEL_PAGE_SEGMENTS } from "@/lib/routing/single-segment-routes";

// The pages that were Typeform embeds and still render here on the native lead
// form. A route with no `embed` renders PublicLeadForm, which captures the lead
// in our database with full UTM/source attribution — so these stay embed-free.
//
// Most of this list left on 2026-09-17: the migration sheet's "Clone Contact"
// slugs became real routes (CONTACT_CLONE_SLUGS) and the redirect sheet's
// retired URLs now 301 from next.config (FUNNEL_REDIRECTS). These two are what
// still renders here.
const NATIVE_FORM_BOOKING_SLUGS = [
  "booking-x",
  "booking-modern-entrepreneur-newsletter",
] as const;

describe("legacy lead routes", () => {
  it("keeps every former-Typeform booking page on the native lead form", () => {
    for (const slug of NATIVE_FORM_BOOKING_SLUGS) {
      const route = getLegacyLeadRoute(slug);
      expect(route, `route ${slug} should exist`).toBeDefined();
      expect(
        route?.embed,
        `route ${slug} must use the native form`,
      ).toBeUndefined();
    }
  });

  /*
    Root-cause guard. A real route under src/app shadows its [legacyLeadPath]
    entry, so an entry left behind here is dead config that still reads as
    live — and if the app route is ever deleted, the page silently reverts to
    the legacy layout instead of 404ing. booking-meta and booking-youtube sat
    in both lists for exactly that reason before the 2026-09-17 migration.
  */
  it("never keeps an entry that a real app route already shadows", () => {
    for (const route of legacyLeadRoutes) {
      expect(
        APP_TOP_LEVEL_PAGE_SEGMENTS.has(route.slug),
        `legacy route ${route.slug} is shadowed by src/app/${route.slug}`,
      ).toBe(false);
    }
  });

  it("has no legacy entry for a contact-clone route", () => {
    for (const slug of CONTACT_CLONE_SLUGS) {
      expect(
        getLegacyLeadRoute(slug),
        `${slug} moved to src/app`,
      ).toBeUndefined();
    }
  });

  it("never uses a non-Calendly embed (Typeform is fully removed)", () => {
    for (const route of legacyLeadRoutes) {
      if (route.embed) {
        expect(route.embed.kind).toBe("calendly");
      }
    }
  });
});

describe("isLegacyLeadPath", () => {
  it("matches every registered lead page", () => {
    for (const route of legacyLeadRoutes) {
      expect(isLegacyLeadPath(route.path)).toBe(true);
    }
  });

  it("does not match other pages or deeper paths", () => {
    expect(isLegacyLeadPath("/about")).toBe(false);
    expect(isLegacyLeadPath("/")).toBe(false);
    expect(isLegacyLeadPath("/booking-ig/extra")).toBe(false);
  });
});

// The tags Calendly receives for a visit to an embedded booking page, built the
// way the page builds them (PR #274 review: a missing source used to replace an
// incoming medium and campaign with the page defaults).
function bookingTags(slug: string, params: Record<string, string>) {
  const route = getLegacyLeadRoute(slug);
  if (!route?.embed) throw new Error(`${slug} has no calendar embed`);
  const url = new URL(
    buildCalendlySrc(
      route.embed.url,
      buildLeadAttribution(params, route.path),
      { fallbackUtms: route.embed.fallbackUtms },
    ),
  );
  return {
    calendar: url.pathname,
    source: url.searchParams.get("utm_source"),
    medium: url.searchParams.get("utm_medium"),
    campaign: url.searchParams.get("utm_campaign"),
  };
}

describe("booking page tags with partial UTMs", () => {
  const partial = { utm_medium: "paid_social", utm_campaign: "spring" };

  it("/booking-ig keeps an incoming medium and campaign and fills only the source", () => {
    expect(bookingTags("booking-ig", partial)).toEqual({
      calendar: "/d/cvr6-cfd-zgd/vendingpreneurs-consultation-call",
      source: "instagram",
      medium: "paid_social",
      campaign: "spring",
    });
  });

  it("/start keeps an incoming medium and campaign and fills only the source", () => {
    expect(bookingTags("start", partial)).toEqual({
      calendar: "/d/cxwj-zxk-2z4/vending-route-advisory-call",
      source: "internal-webinar",
      medium: "paid_social",
      campaign: "spring",
    });
  });

  it("/start leaves the webinar's own night-of tags untouched", () => {
    expect(
      bookingTags("start", {
        utm_source: "internal-webinar",
        utm_medium: "during-night-of",
        utm_campaign: "book_meeting",
      }),
    ).toMatchObject({
      source: "internal-webinar",
      medium: "during-night-of",
      campaign: "book_meeting",
    });
  });

  // PR #274 review 2: `?utm_source=youtube` on /booking-ig came through as
  // youtube / organic / booking-ig, and the spine files a booking under its
  // medium and campaign, so the page defaults read as the link's own.
  it("a source-only link is passed through with no page default added", () => {
    for (const slug of ["booking-ig", "start"]) {
      expect(bookingTags(slug, { utm_source: "youtube" })).toMatchObject({
        source: "youtube",
        medium: null,
        campaign: null,
      });
      expect(bookingTags(slug, { utm_source: "meta_ads" })).toMatchObject({
        source: "meta_ads",
        medium: null,
      });
    }
  });

  it("a page-default campaign is always marked untagged-", () => {
    for (const route of legacyLeadRoutes) {
      if (route.embed?.fallbackUtms) {
        expect(route.embed.fallbackUtms.utm_campaign).toBe(
          `untagged-${route.slug}`,
        );
      }
    }
  });

  it("an untagged visit gets every page default", () => {
    expect(bookingTags("booking-ig", {})).toMatchObject({
      source: "instagram",
      medium: "organic",
      campaign: "untagged-booking-ig",
    });
    expect(bookingTags("start", {})).toMatchObject({
      source: "internal-webinar",
      medium: "owned",
      campaign: "untagged-start",
    });
  });
});

// /booking-ig left the Consultation Session calendar on 2026-11-22. Links to
// that calendar already sent out still book it, so its title must keep counting
// as a first sales call alongside the calendar the page books now.
describe("calendar titles after the Instagram page moved", () => {
  it("still counts the old and the new calendar as first sales calls", () => {
    expect(isFirstCallCalendar("Vendingpreneurs Consultation Session")).toBe(
      true,
    );
    expect(isFirstCallCalendar("Vendingpreneurs Consultation Call")).toBe(true);
    expect(isFirstCallCalendar("Vending Route Advisory Call")).toBe(true);
  });
});
