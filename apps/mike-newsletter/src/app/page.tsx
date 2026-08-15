import { ClosingCta } from "@/components/ClosingCta";
import { FromTheField } from "@/components/FromTheField";
import { Hero } from "@/components/Hero";
import { MeetMike } from "@/components/MeetMike";
import { ProofBar } from "@/components/ProofBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WhatYouGet } from "@/components/WhatYouGet";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <ProofBar />
        <WhatYouGet />
        <FromTheField />
        <MeetMike />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
