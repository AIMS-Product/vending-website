import { Container } from "@/components/ui/Container";

// Same hero as /case-studies: text eyebrow, the index H1 scale (it was a
// 128px "NEWS", the largest H1 on the site) and the page Container.
export function NewsHero() {
  return (
    <section className="border-ink relative isolate overflow-hidden border-b-2 bg-[#f5fbff] pt-28 pb-16 lg:pt-32 lg:pb-20">
      <Container>
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          Insights from the route
        </p>
        <h1 className="text-ink mt-5 text-[clamp(2.25rem,4.6vw,4.25rem)] leading-[1.05] font-black uppercase">
          News
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed font-semibold text-slate-700 lg:text-xl">
          Strategies on locations, machine selection, products, and the
          back-office work that makes a vending route compound. New posts drop
          here as we publish them.
        </p>
      </Container>
    </section>
  );
}
