import type { Metadata } from "next";
import { ReviewGuide } from "@/components/sections/masterclass/ReviewGuide";

export const metadata: Metadata = {
  title: "Team review | Webinar funnel",
  robots: { index: false, follow: false },
};

export default function MasterclassReviewPage() {
  return <ReviewGuide />;
}
