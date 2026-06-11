import type { CSSProperties } from "react";
import { AnimatedStatValue } from "@/components/sections/AnimatedStatValue";
import { accelerator } from "@/lib/content/home";
import { statsBandV2 } from "@/lib/content/home-v2";

export function StatsBand() {
  return (
    <section className="relative overflow-hidden border-y-2 border-[#111111] bg-[#f47b3b] px-5 py-20 lg:px-10 lg:py-28">
      <div aria-hidden className="v2-dots-ink absolute inset-0 opacity-30" />
      <span
        aria-hidden
        className="v2-display v2-outline-light pointer-events-none absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 text-[20vw] leading-none whitespace-nowrap uppercase opacity-30 select-none"
      >
        {statsBandV2.ghostWord}
      </span>

      <div className="relative mx-auto max-w-[1500px]">
        <p
          data-reveal
          className="text-sm font-black tracking-wide text-[#111111] uppercase"
        >
          {statsBandV2.eyebrow}
        </p>
        <h2
          data-reveal
          className="v2-display mt-3 max-w-3xl text-[clamp(2.4rem,4vw,4rem)] leading-[1.02] text-[#111111] uppercase"
          style={{ "--v2-delay": "0.06s" } as CSSProperties}
        >
          {statsBandV2.title}
        </h2>

        <dl className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {accelerator.stats.map((stat, index) => (
            <div
              key={stat.label}
              data-reveal
              className="flex flex-col border-l-4 border-[#111111] pl-6"
              style={{ "--v2-delay": `${0.1 + index * 0.1}s` } as CSSProperties}
            >
              <dt className="order-last mt-3 block text-sm leading-snug font-black text-[#111111] uppercase">
                {stat.label}
              </dt>
              <dd className="v2-display text-[clamp(3.25rem,5.5vw,5.5rem)] leading-none text-white tabular-nums [text-shadow:0.05em_0.05em_0_#111111]">
                <AnimatedStatValue value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
