import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import {
  finishInlineQualification,
  startInlineQualification,
} from "@/app/qualification-intake/actions";
import { APPLY_QUIZ_ANCHOR, applyQuiz } from "@/lib/content/apply-page";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { VP_QUALIFICATION_FORM_ID } from "@/lib/qualification/vp-fields";
import { LockIcon, StarRow } from "./icons";

type ApplyQuizProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
  // /book-now drops the scoring stage: stage 1 submits and this calendar takes
  // the card. The band heading changes with it, because "see if vending is
  // right for you" describes questions that funnel no longer asks.
  bookingEmbedUrl?: string;
  title?: string;
};

// The dark two-panel quiz band. The left card holds the inline qualification
// form, split in two: stage 1 is contact details + both consents (the lead is
// captured and contactable from there), stage 2 replaces those fields in the
// same card with the timeline/invest questions. Answering scores them and
// renders the matching fit result in place — no navigation to /qualify or
// /thank-you at any point. Variant A (dollar ladder) is forced server-side;
// the A/B invest-copy experiment is retired for this funnel.
export function ApplyQuiz({
  attribution,
  idempotencyKey,
  bookingEmbedUrl,
  title = applyQuiz.title,
}: ApplyQuizProps) {
  return (
    <section
      id={APPLY_QUIZ_ANCHOR}
      className="scroll-mt-24 border-y-2 border-[#111111] bg-[#111111]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="mx-auto max-w-[1120px] px-5 py-24 lg:px-10">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#2a8fcc] uppercase">
          {applyQuiz.eyebrow}
        </p>
        <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-white uppercase">
          {title}
        </h2>

        <div className="mx-auto mt-11 flex max-w-[1000px] flex-col items-start gap-7 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
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
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-[18px] lg:w-[300px]">
            <figure className="rounded-[14px] border-2 border-white/15 bg-white/[0.06] p-6">
              <StarRow
                className="mb-3 flex gap-0.5 text-[#2a8fcc]"
                starClassName="size-[18px]"
              />
              <blockquote className="text-[17px] leading-snug font-black text-white">
                {applyQuiz.rail.quote}
              </blockquote>
              <figcaption className="mt-3 text-[13px] font-semibold text-white/60">
                {applyQuiz.rail.attribution}
              </figcaption>
            </figure>

            <div className="flex flex-col gap-4 px-1">
              {applyQuiz.rail.stats.map((stat, index) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <span
                    className={`text-3xl leading-none font-black ${
                      index === 0 ? "text-[#2a8fcc]" : "text-white"
                    }`}
                  >
                    {stat.value}
                  </span>
                  <span className="text-[13px] font-semibold text-white/70">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/70">
              <LockIcon className="size-3.5 text-[#2a8fcc]" />
              {applyQuiz.rail.availabilityNote}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
