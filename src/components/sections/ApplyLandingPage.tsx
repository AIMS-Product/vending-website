import type { LeadAttribution } from "@/lib/lead-attribution";
import { ApplyHero } from "./apply/ApplyHero";
import { ApplyVsl } from "./apply/ApplyVsl";
import { ApplyTools } from "./apply/ApplyTools";
import { ApplyTestimonials } from "./apply/ApplyTestimonials";
import { ApplyRoadmap } from "./apply/ApplyRoadmap";
import { ApplyMembers } from "./apply/ApplyMembers";
import { ApplyFaq } from "./apply/ApplyFaq";
import { ApplyQuiz } from "./apply/ApplyQuiz";
import { ApplyDisclaimer } from "./apply/ApplyDisclaimer";
import { ApplyStickyCta } from "./apply/ApplyStickyCta";

type ApplyLandingPageProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
  // Set by /book-now only. Replaces the scored stage 2 with this calendar; see
  // ApplyQuiz. Every other page leaves it undefined and keeps the scored funnel.
  bookingEmbedUrl?: string;
};

// Custom-coded /apply landing page. Section order + copy come from Kody's
// approved mockup; the quiz band embeds the live qualification form and hands
// off to the existing /qualify scoring runtime.
export function ApplyLandingPage({
  attribution,
  idempotencyKey,
  bookingEmbedUrl,
}: ApplyLandingPageProps) {
  return (
    <>
      {/* The form rides in the hero's right column (Adam, 2026-09-17): under
          the video it still cost bookings from visitors who never scrolled.
          Every CTA anchors to it, so the deep-scroll path is unchanged, and the
          video keeps its place directly below the hero. */}
      <ApplyHero
        aside={
          <ApplyQuiz
            attribution={attribution}
            idempotencyKey={idempotencyKey}
            bookingEmbedUrl={bookingEmbedUrl}
          />
        }
      />
      <ApplyVsl />
      <ApplyTools />
      <ApplyTestimonials />
      <ApplyRoadmap />
      <ApplyMembers />
      <ApplyFaq />
      <ApplyDisclaimer />
      <ApplyStickyCta />
    </>
  );
}
