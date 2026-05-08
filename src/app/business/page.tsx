import type { Metadata } from "next";
import { AboutPageContent } from "@/components/sections/AboutPageContent";

export const metadata: Metadata = {
  title: "About Us | Vendingpreneurs",
  description:
    "Meet Mike, the founder of Vendingpreneurs, and learn the approach behind the Vending Accelerator Program.",
  alternates: {
    canonical: "/about",
  },
};

export default function BusinessPage() {
  return <AboutPageContent />;
}
