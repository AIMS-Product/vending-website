import { describe, expect, it } from "vitest";
import {
  getLegacyLeadRoute,
  isLegacyLeadPath,
  legacyLeadRoutes,
} from "@/lib/content/legacy-routes";
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
