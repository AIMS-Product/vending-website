import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { BrandStrip } from "@/components/sections/BrandStrip";
import { Benefits } from "@/components/sections/Benefits";
import { AcceleratorProgram } from "@/components/sections/AcceleratorProgram";
import { Testimonials } from "@/components/sections/Testimonials";
import { FinalCta } from "@/components/sections/FinalCta";
import { SupabaseAuthErrorRedirect } from "./SupabaseAuthErrorRedirect";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <SupabaseAuthErrorRedirect />
      <Hero />
      <BrandStrip />
      <AcceleratorProgram />
      <Benefits />
      <Testimonials />
      <FinalCta />
    </>
  );
}
