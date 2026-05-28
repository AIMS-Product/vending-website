import type { Metadata } from "next";
import { AboutPageContent } from "@/components/sections/AboutPageContent";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Meet Mike, the founder of Vendingpreneurs, and learn the approach behind the Vending Accelerator Program.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutUsPage() {
  return <AboutPageContent />;
}
