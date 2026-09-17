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
      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-12 px-5 py-14 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-14 lg:px-10 lg:py-16">
        <div className="max-w-[640px]">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {applyHero.eyebrow}
          </p>
          <h1 className="mt-4 max-w-[19ch] text-[clamp(1.85rem,3.1vw,2.8rem)] leading-[1.06] font-black tracking-[-0.015em] text-balance text-[#111111] uppercase">
            {applyHero.headline}
          </h1>
          {/* Kody, 2026-08-11: the deep blue rather than ink, so the eye can
              tell the qualifier from the claim above it at a glance. Same
              #066a99 as the eyebrow and every other section eyebrow. */}
          <p className="mt-3.5 max-w-[34ch] text-[clamp(0.95rem,1.45vw,1.2rem)] leading-[1.3] font-black tracking-[0.02em] text-balance text-[#066a99] uppercase">
            {applyHero.subheadline}
          </p>
          <p className="mt-5 max-w-[50ch] text-[17px] leading-[1.65] font-medium text-slate-600">
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
