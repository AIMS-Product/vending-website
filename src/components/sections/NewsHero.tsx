export function NewsHero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111] bg-[#f5fbff]">
      <div className="mx-auto max-w-[1500px] px-5 pt-28 pb-16 lg:px-10 lg:pt-32 lg:pb-20">
        <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          Insights from the route
        </p>
        <h1 className="mt-8 max-w-4xl text-[clamp(3.5rem,9vw,8rem)] leading-[0.9] font-black text-[#111111] uppercase">
          News
        </h1>
        <p className="mt-7 max-w-2xl text-xl leading-8 font-semibold text-slate-700">
          Strategies on locations, machine selection, products, and the
          back-office work that makes a vending route compound. New posts drop
          here as we publish them.
        </p>
      </div>
    </section>
  );
}
