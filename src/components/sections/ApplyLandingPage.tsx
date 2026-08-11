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
  // Set by /book-now only. Replaces the scored stage 2 with this calendar; see
  // ApplyQuiz. Every other page leaves it undefined and keeps the scored funnel.
  bookingEmbedUrl?: string;
  quizTitle?: string;
};

// Custom-coded /apply landing page. Section order + copy come from Kody's
// approved mockup; the quiz band embeds the live qualification form and hands
// off to the existing /qualify scoring runtime.
export function ApplyLandingPage({
  attribution,
  idempotencyKey,
  bookingEmbedUrl,
  quizTitle,
}: ApplyLandingPageProps) {
  return (
    <>
      <ApplyHero />
      <ApplyVsl />
      {/* The form sits directly under the video (Kody, 2026-07-28): at the
          bottom of the page it was losing visitors who never scrolled that far.
          Every CTA still anchors here, so the deep-scroll path is unchanged. */}
      <ApplyQuiz
        attribution={attribution}
        idempotencyKey={idempotencyKey}
        bookingEmbedUrl={bookingEmbedUrl}
        title={quizTitle}
      />
      <ApplyTools />
      <ApplyTestimonials />
      <ApplyRoadmap />
      <ApplyMembers />
      <ApplyFaq />
      <ApplyYouTube />
      <ApplyDisclaimer />
      <ApplyStickyCta />
    </>
  );
}
