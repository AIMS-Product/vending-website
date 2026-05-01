import { caseStudiesHero } from "@/lib/content/case-studies";

export function CaseStudiesHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)]" />

      <div className="mx-auto max-w-[1100px] px-6 pt-32 pb-16 text-center lg:px-10 lg:pt-40 lg:pb-20">
        <p className="text-brand-500 text-sm font-medium tracking-wide uppercase">
          {caseStudiesHero.eyebrow}
        </p>
        <h1 className="text-brand-500 mt-3 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {caseStudiesHero.title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-slate-600">
          {caseStudiesHero.body}
        </p>
      </div>
    </section>
  );
}
