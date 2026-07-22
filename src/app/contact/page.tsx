import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyLandingPage } from "@/components/sections/ApplyLandingPage";
import { applyMeta } from "@/lib/content/apply-page";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

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
    <ApplyLandingPage attribution={attribution} idempotencyKey={randomUUID()} />
  );
}
