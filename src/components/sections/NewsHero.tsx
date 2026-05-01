export function NewsHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)]" />

      <div className="mx-auto max-w-[1100px] px-6 pt-32 pb-16 text-center lg:px-10 lg:pt-40 lg:pb-20">
        <p className="text-brand-500 text-sm font-medium tracking-wide uppercase">
          Insights from the Route
        </p>
        <h1 className="text-brand-500 mt-3 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          News
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-slate-600">
          Strategies on locations, machine selection, products, and the
          back-office work that makes a vending route compound. New posts drop
          here as we publish them.
        </p>
      </div>
    </section>
  );
}
