import type { Metadata } from "next";
import { Anton } from "next/font/google";
import { BrandStrip } from "@/components/sections/BrandStrip";
import { BenefitsV2 } from "@/components/sections/home-v2/BenefitsV2";
import { FinalCtaV2 } from "@/components/sections/home-v2/FinalCtaV2";
import { HeroV2 } from "@/components/sections/home-v2/HeroV2";
import { ProgramV2 } from "@/components/sections/home-v2/ProgramV2";
import { RevealObserver } from "@/components/sections/home-v2/RevealObserver";
import { StatsBand } from "@/components/sections/home-v2/StatsBand";
import { TestimonialsV2 } from "@/components/sections/home-v2/TestimonialsV2";
import { TickerStrip } from "@/components/sections/home-v2/TickerStrip";
import { SupabaseAuthErrorRedirect } from "./SupabaseAuthErrorRedirect";
import "./home-v2.css";

// Display face for the v2 design. `swap` + the default size-matched fallback
// keeps CLS near zero while guaranteeing the headline face always arrives
// (unlike `optional`, which would strand slow first visits on the fallback).
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <div className={anton.variable}>
      <SupabaseAuthErrorRedirect />
      <RevealObserver />
      <HeroV2 />
      <BrandStrip />
      <ProgramV2 />
      <StatsBand />
      <BenefitsV2 />
      <TickerStrip />
      <TestimonialsV2 />
      <FinalCtaV2 />
    </div>
  );
}
