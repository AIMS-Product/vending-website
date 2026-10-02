import type { Metadata } from "next";
import { LegalDocument } from "@/components/sections/LegalDocument";
import { FinalCta } from "@/components/sections/FinalCta";
import { terms } from "@/lib/content/terms";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "Terms of Service";
const DESCRIPTION =
  "Terms of Service for Vendingpreneurs and the VENDInsights program — membership, data submission, refunds, intellectual property, and dispute resolution.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/terms",
  },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/terms"),
};

export default function TermsPage() {
  return (
    <>
      <LegalDocument doc={terms} />
      <FinalCta />
    </>
  );
}
