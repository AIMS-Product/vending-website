import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { submitQualificationLead } from "@/app/qualification-intake/actions";
import { APPLY_QUIZ_ANCHOR, applyQuiz } from "@/lib/content/apply-page";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { LockIcon, StarRow } from "./icons";

// The seeded "VP Lead Capture" qualification form (see the seed migration).
// Passing it explicitly keeps this independent of whichever form is the global
// default — same id used by the /vp-quiz QA seam.
const VP_QUALIFICATION_FORM_ID = "a1b2c3d4-0000-4000-8000-000000000001";

type ApplyQuizProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
};

// The dark two-panel quiz band. For v1 the left card holds the qualification
// CONTACT form; on submit, PublicLeadForm creates a session and hands off to
// /qualify/[token] (the multi-step question runtime), which scores the answers
// and routes to the matching /thank-you fit state. No calendlyUrl is passed —
// that would skip the quiz. Fully embedding the multi-step questions inline
// here is a deliberate fast-follow, not v1.
export function ApplyQuiz({ attribution, idempotencyKey }: ApplyQuizProps) {
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
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#f47b3b] uppercase">
          {applyQuiz.eyebrow}
        </p>
        <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-white uppercase">
          {applyQuiz.title}
        </h2>
        <p className="mx-auto mt-4 max-w-[56ch] text-center text-lg font-semibold text-white/70">
          {applyQuiz.body}
        </p>

        <div className="mx-auto mt-11 flex max-w-[1000px] flex-col items-start gap-7 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
            <PublicLeadForm
              action={submitQualificationLead}
              attribution={attribution}
              hiddenFields={{
                qualification_form_id: VP_QUALIFICATION_FORM_ID,
              }}
              idempotencyKey={idempotencyKey}
              intent="qualification"
              submitLabel={applyQuiz.submitLabel}
            />
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-[18px] lg:w-[300px]">
            <figure className="rounded-[14px] border-2 border-white/15 bg-white/[0.06] p-6">
              <StarRow
                className="mb-3 flex gap-0.5 text-[#f47b3b]"
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
                      index === 0 ? "text-[#f47b3b]" : "text-white"
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
              <LockIcon className="size-3.5 text-[#f47b3b]" />
              {applyQuiz.rail.availabilityNote}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
