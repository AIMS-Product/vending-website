import { caseStudiesHero } from "@/lib/content/case-studies";
import { Container } from "@/components/ui/Container";

// Same Container as the featured story and the grid below it, so the page
// has one left edge (it had two, 145px apart, until 2026-09-23). The eyebrow
// is text, not a chip: a pill is reserved for state (DESIGN.md).
export function CaseStudiesHero() {
  return (
    <section className="border-ink relative isolate overflow-hidden border-b-2 bg-[#f5fbff] pt-28 pb-16 lg:pt-32 lg:pb-20">
      <Container>
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {caseStudiesHero.eyebrow}
        </p>
        <h1 className="text-ink mt-5 text-[clamp(2.25rem,4.6vw,4.25rem)] leading-[1.05] font-black uppercase">
          {caseStudiesHero.title}
        </h1>
        <p className="mt-6 max-w-[760px] text-lg leading-relaxed font-semibold text-slate-700 lg:text-xl">
          {caseStudiesHero.body}
        </p>
      </Container>
    </section>
  );
}
