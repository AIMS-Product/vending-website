import { applyHero, CTA_TRUST_LINE } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";

// eyebrow/headline/subheadline are overridable so the social-ad booking pages
// can stay frozen on the copy their paid traffic already sees (Kody's
// 2026-08-10 rewrite is scoped to the contact funnel). subheadline is optional
// because the contact funnel no longer has one — its headline carries the
// income figure itself.
export function ApplyHero({
  eyebrow = applyHero.eyebrow,
  headline = applyHero.headline,
  subheadline,
  body = applyHero.body,
  ctaLabel = applyHero.ctaLabel,
}: {
  eyebrow?: string;
  headline?: string;
  subheadline?: { prefix: string; highlight: string; suffix: string };
  body?: string;
  ctaLabel?: string;
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
      <div className="relative mx-auto max-w-[1180px] px-5 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {eyebrow}
          </p>
          {/* Sized for Kody's 2026-08-10 headline, which is ~20 words rather
              than the 5 it replaced: a wider measure and a smaller ceiling keep
              it to three lines on desktop and off the fold on mobile. */}
          <h1 className="mx-auto mt-5 max-w-[26ch] text-[clamp(1.9rem,3.4vw,3.1rem)] leading-[1.06] font-black tracking-tight text-balance text-[#111111] uppercase">
            {headline}
          </h1>
          {subheadline ? (
            <p className="mt-4 text-[clamp(1.7rem,2.8vw,2.5rem)] leading-[1.05] font-black tracking-tight text-[#111111] uppercase">
              {subheadline.prefix}
              <span className="text-[#f47b3b]">{subheadline.highlight}</span>
              {subheadline.suffix}
            </p>
          ) : null}
          <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed font-semibold text-slate-700">
            {body}
          </p>
          <div className="mt-8">
            <ApplyCtaButton>{ctaLabel}</ApplyCtaButton>
            <p className="mt-3.5 text-sm font-medium text-slate-500">
              {CTA_TRUST_LINE}
            </p>
          </div>

          <ul className="mx-auto mt-9 flex max-w-[46ch] flex-wrap items-baseline justify-center gap-x-8 gap-y-3">
            {applyHero.trustStats.map((stat) => (
              <li key={stat.label} className="flex items-baseline gap-2">
                <span className="text-2xl leading-none font-black text-[#066a99]">
                  {stat.value}
                </span>
                <span className="text-[13px] font-semibold text-slate-600">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
