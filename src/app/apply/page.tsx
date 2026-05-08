import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { ApplyPageContent } from "@/components/sections/ApplyPageContent";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { submitApplicationLead } from "./actions";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Apply to the Vending Accelerator Program — mentorship and tools to launch a profitable vending business.",
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
    <ApplyPageContent
      action={submitApplicationLead}
      attribution={attribution}
      idempotencyKey={randomUUID()}
    />
  );
}
