import type { Metadata } from "next";
import { PrivacyPageContent } from "@/components/sections/PrivacyPageContent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Vendingpreneurs and Modern Amenities collect, use, and safeguard your information across membership services, the VENDInsights program, and SMS communications.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPageContent />;
}
