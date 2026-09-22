import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  finishInlineQualification,
  startInlineQualification,
} from "@/app/qualification-intake/actions";
import { applyQuiz } from "@/lib/content/apply-page";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { VP_QUALIFICATION_FORM_ID } from "@/lib/qualification/vp-fields";
import { HeroFormPanel } from "./HeroFormPanel";

type ApplyQuizProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
  // /book-now drops the scoring stage: stage 1 submits and this calendar takes
  // the card.
  bookingEmbedUrl?: string;
};

// The inline qualification form, rendered in the hero's right column (Adam,
// 2026-09-17 — it used to be a dark band lower down the page). It is split in
// two: stage 1 is contact details + both consents (the lead is captured and
// contactable from there), stage 2 replaces those fields in the same card with
// the timeline/invest questions. Answering scores them and renders the matching
// fit result in place — no navigation to /qualify or /thank-you at any point.
// Variant A (dollar ladder) is forced server-side; the A/B invest-copy
// experiment is retired for this funnel.
export function ApplyQuiz({
  attribution,
  idempotencyKey,
  bookingEmbedUrl,
}: ApplyQuizProps) {
  return (
    <HeroFormPanel>
      <PublicLeadForm
        action={startInlineQualification}
        finishAction={finishInlineQualification}
        attribution={attribution}
        hiddenFields={{
          qualification_form_id: VP_QUALIFICATION_FORM_ID,
          variant_key: "A",
        }}
        idempotencyKey={idempotencyKey}
        intent="qualification"
        inlineQualification
        bookingEmbedUrl={bookingEmbedUrl}
        submitLabel={applyQuiz.submitLabel}
      />
    </HeroFormPanel>
  );
}
