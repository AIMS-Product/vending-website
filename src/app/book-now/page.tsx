import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyLandingPage } from "@/components/sections/ApplyLandingPage";
import { applyMeta } from "@/lib/content/apply-page";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { THANK_YOU_LINKS } from "@/lib/qualification/thank-you-links";

// Clone of /contact with the qualification stage removed (Kody, 2026-08-10).
// The visitor gives contact details and both consents, the lead is captured
// exactly as it is on /contact, and the setter calendar then replaces the form
// — no timeline question, no invest question, no scoring, no lane routing.
// Canonical + noindex point at /contact so the duplicate is not indexed.
export const metadata: Metadata = {
  title: applyMeta.title,
  description: applyMeta.description,
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/contact",
  },
};

export default async function BookNowPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(await searchParams, "/book-now");

  return (
    <ApplyLandingPage
      attribution={attribution}
      idempotencyKey={randomUUID()}
      // Single source for the setter link — same constant the scored funnel and
      // /thank-you read, so an env override moves all three at once.
      bookingEmbedUrl={THANK_YOU_LINKS.setterCalendlyUrl}
      // Placeholder until Kody supplies a heading: the default asks visitors to
      // "see if vending is right for you", which this funnel no longer does.
      quizTitle="Book Your Call"
    />
  );
}
