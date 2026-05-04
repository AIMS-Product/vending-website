import type { Metadata } from "next";
import { LegalDocument } from "@/components/sections/LegalDocument";
import { FinalCta } from "@/components/sections/FinalCta";
import { terms } from "@/lib/content/terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Vendingpreneurs and the VENDInsights program — membership, data submission, refunds, intellectual property, and dispute resolution.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <LegalDocument doc={terms} />
      <FinalCta />
    </>
  );
}
