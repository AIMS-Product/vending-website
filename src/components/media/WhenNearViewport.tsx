"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders `children` once the element with `targetId` comes within `margin`
 * of the viewport, and keeps them rendered after that.
 *
 * Exists for VidalyticsPlayer: /pre-call-resources carries fifteen players and
 * each one autoplays, so loading them all at once started fifteen video
 * streams on arrival. Phones and laptops in power-saving mode refuse or stall
 * that, which showed as dark, paused frames and solid black boxes further down
 * the page. Loading each player a screen or so before it is reached means
 * arriving starts one or two, and the rest start as the visitor scrolls.
 */
export function WhenNearViewport({
  targetId,
  margin = "600px",
  children,
}: {
  targetId: string;
  margin?: string;
  children: ReactNode;
}) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId, margin]);

  return near ? children : null;
}
