import type { Metadata } from "next";
import { AboutHero } from "@/components/sections/AboutHero";
import { AboutHow } from "@/components/sections/AboutHow";
import { AboutApproach } from "@/components/sections/AboutApproach";
import { FinalCta } from "@/components/sections/FinalCta";

export const metadata: Metadata = {
  title: "About — Meet Mike",
  description:
    "Meet Mike, the founder of Vendingpreneurs — how he escaped the rat race, built passive income through vending, and the unique approach behind the program.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutHow />
      <AboutApproach />
      <FinalCta />
    </>
  );
}
