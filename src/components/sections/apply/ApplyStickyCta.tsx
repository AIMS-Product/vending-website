"use client";

import { useEffect, useState } from "react";
import { applySticky } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";

// Sticky bottom CTA bar. Matches the mockup: hidden at the top of the page,
// revealed once the visitor scrolls past the hero. Purely presentational —
// the CTA is the same anchor-to-quiz link used everywhere else.
export function ApplyStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 140;
      setVisible(window.scrollY > 700 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#111111] bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3.5 lg:px-10">
        <span className="text-[15px] font-black text-[#111111] max-sm:hidden">
          {applySticky.text}
        </span>
        <span className="text-[15px] font-black text-[#111111] sm:hidden">
          Launch your route in 90 days.
        </span>
        <ApplyCtaButton size="md" className="shrink-0">
          {applySticky.ctaLabel}
        </ApplyCtaButton>
      </div>
    </div>
  );
}
