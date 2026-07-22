import { applyHero } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";
import { LockIcon } from "./icons";

export function ApplyHero() {
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
        <div className="max-w-3xl">
          <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
            {applyHero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-[15ch] text-[clamp(2.6rem,4.6vw,4.1rem)] leading-[1.02] font-black tracking-tight text-[#111111] uppercase">
            {applyHero.headline}
          </h1>
          <p className="mt-4 text-[clamp(1.7rem,2.8vw,2.5rem)] leading-[1.05] font-black tracking-tight text-[#111111] uppercase">
            {applyHero.subheadline.prefix}
            <span className="text-[#f47b3b]">
              {applyHero.subheadline.highlight}
            </span>
            {applyHero.subheadline.suffix}
          </p>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed font-semibold text-slate-700">
            {applyHero.body}
          </p>
          <div className="mt-8">
            <ApplyCtaButton>{applyHero.ctaLabel}</ApplyCtaButton>
            <p className="mt-3.5 text-sm font-medium text-slate-500">
              {applyHero.ctaNote}
            </p>
            <p className="mt-2.5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
              <LockIcon className="size-3.5" />
              {applyHero.availabilityNote}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
