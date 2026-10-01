import type { Metadata } from "next";
import "../home-v2.css";
import { ReviewGuide } from "@/components/sections/masterclass/ReviewGuide";

export const metadata: Metadata = {
  title: "Team review | Webinar funnel",
  description: "Internal review of the rebuilt webinar funnel",
  robots: { index: false, follow: false },
};

export default function MasterclassReviewPage() {
  return <ReviewGuide />;
}
