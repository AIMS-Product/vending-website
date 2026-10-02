import type { Metadata } from "next";
import { PrivacyPageContent } from "@/components/sections/PrivacyPageContent";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "How Vendingpreneurs and Modern Amenities collect, use, and safeguard your information across membership services, the VENDInsights program, and SMS communications.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/privacy"),
};

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
