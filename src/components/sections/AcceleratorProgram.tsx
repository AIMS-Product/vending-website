import Image from "next/image";
import { AnimatedStatValue } from "@/components/sections/AnimatedStatValue";
import { Button } from "@/components/ui/Button";
import { accelerator } from "@/lib/content/home";

export function AcceleratorProgram() {
  return (
    <section className="border-y-2 border-[#111111] bg-[#f5fbff] px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
            {accelerator.title}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-8 font-semibold text-slate-700">
            {accelerator.body}
          </p>

          <dl className="mt-10 max-w-md divide-y-2 divide-[#bfeeff]">
            {accelerator.stats.map((stat) => (
              <div
                key={stat.label}
                className="grid grid-cols-[auto_1fr] items-baseline gap-6 py-5"
              >
                <dt className="text-4xl font-black text-[#111111] sm:text-5xl">
                  <AnimatedStatValue value={stat.value} />
                </dt>
                <dd className="text-sm font-black text-[#2d9fd6] uppercase">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <Button href={accelerator.cta.href}>{accelerator.cta.label}</Button>
          </div>
        </div>

        <div className="rounded-[12px] border-2 border-[#111111] bg-white p-8 shadow-[10px_10px_0_#55b8e8] lg:p-10">
          <ul className="space-y-3">
            {accelerator.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] bg-[#f47b3b] text-[#111111]"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none">
                    <path
                      d="M3 8.5l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="font-semibold text-slate-700">{point}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 font-semibold text-slate-700">
            <strong className="font-black text-[#111111]">
              {accelerator.bonus.label}
            </strong>{" "}
            {accelerator.bonus.body}
          </p>

          <div className="relative mt-8 aspect-[16/10] w-full overflow-hidden rounded-[8px] border-2 border-[#111111]">
            <Image
              src={accelerator.image.src}
              alt={accelerator.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="eager"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
