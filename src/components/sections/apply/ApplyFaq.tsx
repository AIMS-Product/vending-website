"use client";

import { useState } from "react";
import { applyFaq } from "@/lib/content/apply-page";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "./icons";

export function ApplyFaq() {
  // First item open by default, matching the mockup. Single-open accordion.
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="border-t-2 border-[#111111] bg-white">
      <div className="mx-auto max-w-[820px] px-5 py-24 lg:px-10">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {applyFaq.eyebrow}
        </p>
        <h2 className="mt-4 mb-11 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
          {applyFaq.title}
        </h2>

        <div className="flex flex-col gap-3.5">
          {applyFaq.items.map((item, index) => {
            const open = openIndex === index;
            const panelId = `apply-faq-panel-${index}`;
            const buttonId = `apply-faq-button-${index}`;
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-[10px] border-2 border-[#111111] bg-[#f5fbff]"
              >
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[17px] font-black text-[#111111] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:outline-none"
                >
                  <span>{item.q}</span>
                  <ChevronDownIcon
                    className={cn(
                      "size-5 shrink-0 text-[#f47b3b] transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <p
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-6 pb-[22px] text-[15px] leading-relaxed font-semibold text-slate-700"
                  >
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
