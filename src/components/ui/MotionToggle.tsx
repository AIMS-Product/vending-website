"use client";

import { useSyncExternalStore } from "react";

const ATTRIBUTE = "data-motion";
const PAUSED = "paused";
const EVENT = "vp-motion-change";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function isPaused(): boolean {
  return document.documentElement.getAttribute(ATTRIBUTE) === PAUSED;
}

/**
 * Pause / resume for the looping marquees and floating badges (WCAG 2.2.2).
 * State lives on the root element as `data-motion="paused"`; the matching rule
 * in globals.css stops every looping animation at once, so any number of
 * toggles stay in sync and the choice survives client-side navigation.
 */
export function MotionToggle({ className }: { className?: string }) {
  const paused = useSyncExternalStore(subscribe, isPaused, () => false);

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => {
        const root = document.documentElement;
        if (paused) root.removeAttribute(ATTRIBUTE);
        else root.setAttribute(ATTRIBUTE, PAUSED);
        window.dispatchEvent(new Event(EVENT));
      }}
      className={
        className ??
        "rounded-[6px] border-2 border-[#111111] bg-white px-3 py-1.5 text-xs font-black tracking-wide text-[#111111] uppercase focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none"
      }
    >
      Pause animations
    </button>
  );
}
