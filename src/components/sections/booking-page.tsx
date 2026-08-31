import "server-only";

import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { BookingLandingPage } from "./BookingLandingPage";
import { bookingPages, type BookingSlug } from "@/lib/content/booking-pages";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

// Shared wiring for the 4 social-ad booking routes so each page.tsx stays a
// thin two-liner. Pages are noindex (paid ad landers) and canonicalize to
// /contact, matching the legacy conversion pages.
export function bookingMetadata(slug: BookingSlug): Metadata {
  const config = bookingPages[slug];
  return {
    // Absolute: the metaTitle strings already end in "| Vendingpreneurs", so
    // the root layout's "%s | Vendingpreneurs" template would double the brand.
    title: { absolute: config.metaTitle },
    description: config.metaDescription,
    robots: { index: false, follow: false },
    alternates: { canonical: "/contact" },
  };
}

export async function renderBookingPage(
  slug: BookingSlug,
  searchParams: Promise<LeadSearchParams>,
) {
  const config = bookingPages[slug];
  const attribution = buildLeadAttribution(await searchParams, config.path);

  return (
    <BookingLandingPage
      config={config}
      attribution={attribution}
      idempotencyKey={randomUUID()}
    />
  );
}
