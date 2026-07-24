import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { submitBookingLead } from "@/app/booking/actions";
import { APPLY_QUIZ_ANCHOR, applyQuiz } from "@/lib/content/apply-page";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { LockIcon, StarRow } from "./icons";

type BookingFormProps = {
  attribution: LeadAttribution;
  idempotencyKey: string;
  // The calendar this page books. On a successful submit the lead is captured
  // (with UTM attribution) and then handed off to this Calendly.
  calendlyUrl: string;
};

// The "Book Your Call" band for the social-ad booking pages. Same dark
// two-panel shell as the qualification quiz, but the left card holds the
// simplified contact form (name/email/phone only) and, on submit, redirects
// straight to the page's Calendly instead of scoring or routing. Shares the
// APPLY_QUIZ_ANCHOR so every on-page "Book Your Call" CTA scrolls here.
export function BookingForm({
  attribution,
  idempotencyKey,
  calendlyUrl,
}: BookingFormProps) {
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
          Book your free call
        </p>
        <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-white uppercase">
          Book Your Call
        </h2>

        <div className="mx-auto mt-11 flex max-w-[1000px] flex-col items-start gap-7 lg:flex-row">
          <div className="w-full min-w-0 flex-1">
            <PublicLeadForm
              action={submitBookingLead}
              attribution={attribution}
              bookingRedirectUrl={calendlyUrl}
              idempotencyKey={idempotencyKey}
              intent="contact"
              simpleContact
              submitLabel="Submit"
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
