import type { Metadata } from "next";
import { LegalDocument } from "@/components/sections/LegalDocument";
import { FinalCta } from "@/components/sections/FinalCta";
import { privacy } from "@/lib/content/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Vendingpreneurs and Modern Amenities collect, use, and safeguard your information across membership services, the VENDInsights program, and SMS communications.",
};

export default function PrivacyPage() {
  return (
    <>
      <LegalDocument doc={privacy} />
      <FinalCta />
    </>
  );
}
