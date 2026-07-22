import type { LeadAttribution } from "@/lib/lead-attribution";
import { ApplyHero } from "./apply/ApplyHero";
import { ApplyVsl } from "./apply/ApplyVsl";
import { ApplyTools } from "./apply/ApplyTools";
import { ApplyTestimonials } from "./apply/ApplyTestimonials";
import { ApplyRoadmap } from "./apply/ApplyRoadmap";
import { ApplyMembers } from "./apply/ApplyMembers";
import { ApplyFaq } from "./apply/ApplyFaq";
import { ApplyQuiz } from "./apply/ApplyQuiz";
import { ApplyYouTube } from "./apply/ApplyYouTube";
import { ApplyDisclaimer } from "./apply/ApplyDisclaimer";
import { ApplyStickyCta } from "./apply/ApplyStickyCta";

type ApplyLandingPageProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
};

// Custom-coded /apply landing page. Section order + copy come from Kody's
// approved mockup; the quiz band embeds the live qualification form and hands
// off to the existing /qualify scoring runtime.
export function ApplyLandingPage({
  attribution,
  idempotencyKey,
}: ApplyLandingPageProps) {
  return (
    <>
      <ApplyHero />
      <ApplyVsl />
      <ApplyTools />
      <ApplyTestimonials />
      <ApplyRoadmap />
      <ApplyMembers />
      <ApplyFaq />
      <ApplyQuiz attribution={attribution} idempotencyKey={idempotencyKey} />
      <ApplyYouTube />
      <ApplyDisclaimer />
      <ApplyStickyCta />
    </>
  );
}
