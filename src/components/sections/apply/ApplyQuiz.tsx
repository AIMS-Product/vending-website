import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { submitInlineQualification } from "@/app/qualification-intake/actions";
import { APPLY_QUIZ_ANCHOR, applyQuiz } from "@/lib/content/apply-page";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { VP_QUALIFICATION_FORM_ID } from "@/lib/qualification/vp-fields";
import { LockIcon, StarRow } from "./icons";

type ApplyQuizProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
};

// The dark two-panel quiz band. The left card holds the full inline
// qualification form — contact + consent + timeline + invest. Submitting
// scores the answers and renders the matching fit result in place (no
// navigation to /qualify or /thank-you). Variant A (dollar ladder) is forced
// server-side; the A/B invest-copy experiment is retired for this funnel.
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

        <div className="mx-auto mt-11 flex max-w-[1000px] flex-col items-start gap-7 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
            <PublicLeadForm
              action={submitInlineQualification}
              attribution={attribution}
              hiddenFields={{
                qualification_form_id: VP_QUALIFICATION_FORM_ID,
                variant_key: "A",
              }}
              idempotencyKey={idempotencyKey}
              intent="qualification"
              inlineQualification
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
