import { APPLY_QUIZ_ANCHOR, applyHero } from "@/lib/content/apply-page";

export function ApplyHero({
  body = applyHero.body,
  aside,
}: {
  body?: string;
  // The booking card. Adam, 2026-09-17: on every booking page the copy runs
  // left and the form/calendar sits beside it on the first screen — a form the
  // visitor has to scroll to costs bookings. It carries the CTA anchor, so
  // every "Book Your Call" on the page scrolls back to this one form and the
  // page never renders two.
  aside?: React.ReactNode;
} = {}) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Dotted paper-blue wash, matching the mockup hero band. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[#eaf6ff]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(42,143,204,0.20) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-12 px-5 py-20 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-14 lg:px-10 lg:py-24">
        <div className="max-w-[640px]">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {applyHero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-[16ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.04] font-black tracking-tight text-balance text-[#111111] uppercase">
            {applyHero.headline}
          </h1>
          {/* Kody, 2026-08-11: the deep blue rather than ink, so the eye can
              tell the qualifier from the claim above it at a glance. Same
              #066a99 as the eyebrow and every other section eyebrow. */}
          <p className="mt-4 max-w-[24ch] text-[clamp(1.5rem,2.6vw,2.3rem)] leading-[1.08] font-black tracking-tight text-balance text-[#066a99] uppercase">
            {applyHero.subheadline}
          </p>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed font-semibold text-slate-700">
            {body}
          </p>
        </div>

        {aside ? (
          <div id={APPLY_QUIZ_ANCHOR} className="w-full scroll-mt-24">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
