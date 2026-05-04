import type { Metadata } from "next";
import { SupportPage } from "@/components/sections/SupportPage";

export const metadata: Metadata = {
  title: "Thank You For Applying",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ThankYouForApplyingPage() {
  return (
    <SupportPage
      eyebrow="Application received"
      title="Thanks for applying."
      body="The team reviews application details before the next conversation."
      items={[
        "Watch your inbox for the next step.",
        "Have your vending goals, launch market, and budget range ready.",
        "If anything changes, send the team a note through the contact page.",
      ]}
    />
  );
}
