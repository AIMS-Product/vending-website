import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyLandingPage } from "@/components/sections/ApplyLandingPage";
import { applyMeta } from "@/lib/content/apply-page";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

// 1:1 clone of /contact (the VP apply funnel) for the YouTube booking traffic.
// Same page + same lead/qualification flow; only the attribution source_path
// differs so leads are tagged to this page. Canonical + noindex point at
// /contact so the duplicate isn't indexed.
export const metadata: Metadata = {
  title: applyMeta.title,
  description: applyMeta.description,
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/contact",
  },
};

export default async function BookingYoutubePage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(
    await searchParams,
    "/booking-youtube",
  );

  return (
    <ApplyLandingPage attribution={attribution} idempotencyKey={randomUUID()} />
  );
}
