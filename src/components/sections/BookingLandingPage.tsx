import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  resolveBookingCopy,
  type BookingPageConfig,
} from "@/lib/content/booking-pages";
import { ApplyHero } from "./apply/ApplyHero";
import { ApplyVsl } from "./apply/ApplyVsl";
import { ApplyTools } from "./apply/ApplyTools";
import { ApplyTestimonials } from "./apply/ApplyTestimonials";
import { ApplyRoadmap } from "./apply/ApplyRoadmap";
import { ApplyMembers } from "./apply/ApplyMembers";
import { ApplyFaq } from "./apply/ApplyFaq";
import { BookingForm } from "./apply/BookingForm";
import { ApplyDisclaimer } from "./apply/ApplyDisclaimer";
import { ApplyStickyCta } from "./apply/ApplyStickyCta";

type BookingLandingPageProps = {
  config: BookingPageConfig;
  attribution: LeadAttribution;
  idempotencyKey: string;
};

// Social-ad booking landing page. Same sections as the /contact apply landing,
// but the qualification quiz is replaced by the simplified "Book Your Call"
// form (contact-only → Calendly), every CTA reads "Book Your Call", and the
// Anthony persona swaps in his hero subcopy, VSL, and FAQ answer. Copy comes
// from resolveBookingCopy so the two personas never drift.
const BOOK_CTA = "Book Your Call";

export function BookingLandingPage({
  config,
  attribution,
  idempotencyKey,
}: BookingLandingPageProps) {
  const copy = resolveBookingCopy(config);

  return (
    <>
      {/* The booking card sits beside the hero copy (Adam, 2026-09-17), not in
          a band near the bottom of the page; the VSL follows directly under. */}
      <ApplyHero
        body={copy.heroBody}
        aside={
          <BookingForm
            attribution={attribution}
            idempotencyKey={idempotencyKey}
            calendlyUrl={config.calendlyUrl}
          />
        }
      />
      <ApplyVsl vsl={copy.vsl} />
      <ApplyTools ctaLabel={BOOK_CTA} />
      <ApplyTestimonials />
      <ApplyRoadmap ctaLabel={BOOK_CTA} />
      <ApplyMembers />
      <ApplyFaq items={copy.faqItems} />
      <ApplyDisclaimer />
      <ApplyStickyCta ctaLabel={BOOK_CTA} />
    </>
  );
}
