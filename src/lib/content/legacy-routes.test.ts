import { describe, expect, it } from "vitest";
import {
  getLegacyLeadRoute,
  legacyLeadRoutes,
} from "@/lib/content/legacy-routes";

// The 13 pages that were Typeform embeds and are now on the native lead form.
// A route with no `embed` renders PublicLeadForm, which captures the lead in
// our database with full UTM/source attribution — so these must stay embed-free.
const NATIVE_FORM_BOOKING_SLUGS = [
  "booking-meta",
  "booking-youtube",
  "booking-reactivation-email",
  "booking-linkedin",
  "booking-ak-x",
  "booking-ak-linkedin",
  "booking-internal-ltf",
  "booking-passivepreneurs",
  "booking-partner",
  "booking-tiktok",
  "start-your-route-ak-ig",
  "start-my-vending-business",
  "apply-vendingpreneurs",
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

  it("never uses a non-Calendly embed (Typeform is fully removed)", () => {
    for (const route of legacyLeadRoutes) {
      if (route.embed) {
        expect(route.embed.kind).toBe("calendly");
      }
    }
  });
});
