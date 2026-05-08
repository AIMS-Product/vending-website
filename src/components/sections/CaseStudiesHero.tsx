import { caseStudiesHero } from "@/lib/content/case-studies";

export function CaseStudiesHero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111] bg-[#f5fbff]">
      <div className="mx-auto max-w-[1150px] px-5 pt-28 pb-16 text-center lg:px-10 lg:pt-32 lg:pb-20">
        <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          {caseStudiesHero.eyebrow}
        </p>
        <h1 className="mt-8 text-[clamp(3rem,7vw,6.5rem)] leading-[1.05] font-black text-[#111111] uppercase">
          {caseStudiesHero.title}
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-xl leading-8 font-semibold text-slate-700">
          {caseStudiesHero.body}
        </p>
      </div>
    </section>
  );
}
