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
    canonical: "/apply",
  },
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const attribution = buildLeadAttribution(await searchParams, "/apply");

  return (
    <ApplyLandingPage attribution={attribution} idempotencyKey={randomUUID()} />
  );
}
