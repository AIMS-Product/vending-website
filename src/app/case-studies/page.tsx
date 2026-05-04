import type { Metadata } from "next";
import { CaseStudiesHero } from "@/components/sections/CaseStudiesHero";
import { CaseStudyVideos } from "@/components/sections/CaseStudyVideos";
import { CaseStudyQuotes } from "@/components/sections/CaseStudyQuotes";
import { FinalCta } from "@/components/sections/FinalCta";

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Vendingpreneurs members share how they went from zero vending experience to a working route — video stories and written testimonials in their own words.",
  alternates: {
    canonical: "/case-studies",
  },
};

export default function CaseStudiesPage() {
  return (
    <>
      <CaseStudiesHero />
      <CaseStudyVideos />
      <CaseStudyQuotes />
      <FinalCta />
    </>
  );
}
