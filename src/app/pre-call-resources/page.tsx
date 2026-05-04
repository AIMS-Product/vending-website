import type { Metadata } from "next";
import { SupportPage } from "@/components/sections/SupportPage";

export const metadata: Metadata = {
  title: "Pre-Call Resources",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreCallResourcesPage() {
  return (
    <SupportPage
      eyebrow="Pre-call resources"
      title="Prepare for your vending strategy call."
      body="A focused call is easier when the business basics are already clear."
      items={[
        "Know the city or region where you want to place machines.",
        "Bring any location, machine, or financing questions you already have.",
        "Review your available budget and the timeline you want to work toward.",
      ]}
    />
  );
}
