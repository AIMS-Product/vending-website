import { Hero } from "@/components/sections/Hero";
import { BrandStrip } from "@/components/sections/BrandStrip";
import { Benefits } from "@/components/sections/Benefits";
import { AcceleratorProgram } from "@/components/sections/AcceleratorProgram";
import { Testimonials } from "@/components/sections/Testimonials";
import { FinalCta } from "@/components/sections/FinalCta";

export default function Home() {
  return (
    <>
      <Hero />
      <BrandStrip />
      <Benefits />
      <AcceleratorProgram />
      <Testimonials />
      <FinalCta />
    </>
  );
}
