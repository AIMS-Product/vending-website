import { applyHero, CTA_TRUST_LINE } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";

export function ApplyHero({
  body = applyHero.body,
  ctaLabel = applyHero.ctaLabel,
}: {
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
            {applyHero.eyebrow}
          </p>
          <h1 className="mx-auto mt-5 max-w-[21ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.04] font-black tracking-tight text-balance text-[#111111] uppercase">
            {applyHero.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-[24ch] text-[clamp(1.5rem,2.6vw,2.3rem)] leading-[1.08] font-black tracking-tight text-balance text-[#111111] uppercase">
            {applyHero.subheadline}
          </p>
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
