import type { CSSProperties } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { accelerator } from "@/lib/content/home";
import { programV2 } from "@/lib/content/home-v2";

export function ProgramV2() {
  return (
    <section className="bg-white px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p
            data-reveal
            className="text-sm font-black tracking-wide text-[#066a99] uppercase"
          >
            {programV2.eyebrow}
          </p>
          <h2
            data-reveal
            className="v2-display mt-3 text-[clamp(2.6rem,4vw,4rem)] leading-[1.02] text-[#111111] uppercase"
            style={{ "--v2-delay": "0.06s" } as CSSProperties}
          >
            {accelerator.title}
          </h2>
          <p
            data-reveal
            className="mt-6 max-w-md text-lg leading-8 font-semibold text-slate-700"
            style={{ "--v2-delay": "0.12s" } as CSSProperties}
          >
            {accelerator.body}
          </p>

          <p
            data-reveal
            className="mt-8 max-w-md rounded-[10px] border-2 border-[#111111] bg-[#eaf8ff] p-5 font-semibold text-slate-700 shadow-[5px_5px_0_#55b8e8]"
            style={{ "--v2-delay": "0.18s" } as CSSProperties}
          >
            <strong className="font-black text-[#111111] uppercase">
              {accelerator.bonus.label}
            </strong>{" "}
            {accelerator.bonus.body}
          </p>

          <div
            data-reveal
            className="mt-9"
            style={{ "--v2-delay": "0.24s" } as CSSProperties}
          >
            <Button href={accelerator.cta.href} showArrow>
              {accelerator.cta.label}
            </Button>
          </div>
        </div>

        <div>
          <ol className="space-y-5">
            {accelerator.points.map((point, index) => (
              <li
                key={point}
                data-reveal
                className="group flex items-start gap-6 rounded-[12px] border-2 border-[#111111] bg-white p-6 shadow-[6px_6px_0_#55b8e8] transition hover:-translate-y-1 hover:shadow-[9px_9px_0_#f47b3b] lg:p-8"
                style={
                  { "--v2-delay": `${(index % 2) * 0.07}s` } as CSSProperties
                }
              >
                <span
                  aria-hidden
                  className="v2-display v2-outline text-[2.75rem] leading-none transition group-hover:[-webkit-text-stroke-color:#f47b3b]"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="pt-2 text-lg leading-7 font-semibold text-slate-700">
                  {point}
                </p>
              </li>
            ))}
          </ol>

          <div
            data-reveal="pop"
            className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[6px_6px_0_#55b8e8]"
          >
            <Image
              src={accelerator.image.src}
              alt={accelerator.image.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
