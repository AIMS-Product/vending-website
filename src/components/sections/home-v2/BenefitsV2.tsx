import type { CSSProperties } from "react";
import { BenefitIcon } from "@/components/sections/Benefits";
import { benefits } from "@/lib/content/home";
import { benefitsV2 } from "@/lib/content/home-v2";
import { cn } from "@/lib/utils";

/** Bento rhythm: 7/5 then 5/7 column spans, with one ink card for contrast. */
const cardStyles = [
  { span: "lg:col-span-7", surface: "bg-white", chip: "bg-[#eaf8ff]" },
  { span: "lg:col-span-5", surface: "bg-[#eaf8ff]", chip: "bg-white" },
  {
    span: "lg:col-span-5",
    surface: "bg-[#111111]",
    chip: "bg-[#f47b3b]",
    dark: true,
  },
  { span: "lg:col-span-7", surface: "bg-[#ffe3d1]", chip: "bg-white" },
] as const;

export function BenefitsV2() {
  return (
    <section className="relative overflow-hidden bg-[#f5fbff] px-5 py-24 lg:px-10 lg:py-32">
      <div
        aria-hidden
        className="v2-dots absolute inset-0 [mask-image:linear-gradient(180deg,black_0%,transparent_45%)]"
      />

      <div className="relative mx-auto max-w-[1500px]">
        <div className="grid items-end gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p
              data-reveal
              className="text-sm font-black tracking-wide text-[#066a99] uppercase"
            >
              {benefitsV2.eyebrow}
            </p>
            <h2
              data-reveal
              className="v2-display mt-3 text-[clamp(2.6rem,4.5vw,4.5rem)] leading-[1.0] text-[#111111] uppercase"
              style={{ "--v2-delay": "0.06s" } as CSSProperties}
            >
              {benefits.title}
            </h2>
          </div>
          <p
            data-reveal
            className="text-lg leading-8 font-semibold text-slate-700 lg:col-span-5"
            style={{ "--v2-delay": "0.12s" } as CSSProperties}
          >
            {benefits.body}
          </p>
        </div>

        <ul className="mt-14 grid gap-6 lg:grid-cols-12">
          {benefits.items.map((item, index) => {
            const style = cardStyles[index % cardStyles.length];
            const dark = "dark" in style && style.dark;

            return (
              <li
                key={item.title}
                data-reveal
                className={cn("flex", style.span)}
                style={
                  { "--v2-delay": `${(index % 2) * 0.08}s` } as CSSProperties
                }
              >
                <div
                  className={cn(
                    "group flex w-full flex-col rounded-[14px] border-2 border-[#111111] p-8 shadow-[7px_7px_0_#55b8e8] transition hover:-translate-y-1 hover:shadow-[10px_10px_0_#f47b3b]",
                    style.surface,
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[8px] border-2 border-[#111111] text-[#111111] shadow-[4px_4px_0_#55b8e8] transition group-hover:-rotate-6",
                      style.chip,
                    )}
                  >
                    <BenefitIcon icon={item.icon} />
                  </div>
                  <h3
                    className={cn(
                      "v2-display mt-6 text-2xl uppercase",
                      dark ? "text-white" : "text-[#111111]",
                    )}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-3 max-w-md leading-7 font-semibold",
                      dark ? "text-slate-300" : "text-slate-700",
                    )}
                  >
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
