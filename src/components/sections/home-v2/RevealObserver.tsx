"use client";

import { useEffect } from "react";

/**
 * Flips every `[data-reveal]` element on the page to `.is-inview` the first
 * time it enters the viewport. The hidden initial state lives in CSS behind
 * a `scripting: enabled` media query, so this is pure progressive
 * enhancement — no-JS visitors and reduced-motion users see static content.
 */
export function RevealObserver() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return null;
}
