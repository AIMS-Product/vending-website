import { AboutHero } from "@/components/sections/AboutHero";
import { AboutHow } from "@/components/sections/AboutHow";
import { AboutApproach } from "@/components/sections/AboutApproach";
import { FinalCta } from "@/components/sections/FinalCta";

export function AboutPageContent() {
  return (
    <>
      <AboutHero />
      <AboutHow />
      <AboutApproach />
      <FinalCta />
    </>
  );
}
