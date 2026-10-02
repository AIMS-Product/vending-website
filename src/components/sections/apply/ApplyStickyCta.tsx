"use client";

import { useEffect, useRef, useState } from "react";
import { APPLY_QUIZ_ANCHOR, applySticky } from "@/lib/content/apply-page";
import { trackCtaClick } from "@/lib/tracking/funnel-events";
import { ApplyCtaButton } from "./ApplyCtaButton";

// Read by the chat launcher so it sits above the bar instead of on its button.
const OFFSET_VAR = "--sticky-cta-offset";

// Sticky bottom CTA bar. Matches the mockup: hidden at the top of the page,
// revealed once the visitor scrolls past the hero. Purely presentational —
// the CTA is the same anchor-to-quiz link used everywhere else.
//
// It also stays hidden while the form itself is on screen (UI audit,
// 2026-09-22). On a phone the hero form runs past 700px, so the bar used to
// slide in over the fields the visitor was filling, pointing at the form they
// were already in.
export function ApplyStickyCta({
  ctaLabel = applySticky.ctaLabel,
  text = applySticky.text,
  mobileText = "Launch your route in 90 days.",
  trackAs,
}: {
  ctaLabel?: string;
  text?: string;
  mobileText?: string;
  /** When set, a click sends cta_clicked with this location. */
  trackAs?: string;
} = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [formInView, setFormInView] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const visible = scrolled && !formInView;

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 140;
      setScrolled(window.scrollY > 700 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const form = document.getElementById(APPLY_QUIZ_ANCHOR);
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) =>
      setFormInView(entry.isIntersecting),
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const height = visible ? (barRef.current?.offsetHeight ?? 0) : 0;
    root.style.setProperty(OFFSET_VAR, `${height}px`);
    return () => {
      root.style.removeProperty(OFFSET_VAR);
    };
  }, [visible]);

  return (
    <div
      ref={barRef}
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#111111] bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3.5 lg:px-10">
        <span className="text-[15px] font-black text-[#111111] max-sm:hidden">
          {text}
        </span>
        <span className="text-[15px] leading-tight font-black whitespace-pre-line text-[#111111] sm:hidden">
          {mobileText}
        </span>
        <ApplyCtaButton
          size="md"
          className="shrink-0"
          onClick={trackAs ? () => trackCtaClick(trackAs) : undefined}
        >
          {ctaLabel}
        </ApplyCtaButton>
      </div>
    </div>
  );
}
