import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyLandingPage } from "@/components/sections/ApplyLandingPage";
import { applyMeta } from "@/lib/content/apply-page";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { applyVslStructuredData } from "@/lib/site-structured-data";

export const metadata: Metadata = {
  title: applyMeta.title,
  description: applyMeta.description,
  alternates: {
    canonical: "/contact",
  },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(await searchParams, "/contact");

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised server-side from our own static config, never from user input.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(applyVslStructuredData()),
        }}
      />
      <ApplyLandingPage
        attribution={attribution}
        idempotencyKey={randomUUID()}
        accent="orange"
      />
    </>
  );
}
