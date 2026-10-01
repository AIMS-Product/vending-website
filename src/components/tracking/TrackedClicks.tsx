"use client";

import { useEffect } from "react";
import { trackClick } from "@/lib/tracking/funnel-events";

/**
 * One listener for every `data-track` element on the page, so server
 * components mark a link with attributes instead of becoming client code.
 * Sends the name and `data-track-detail` only, never the link itself.
 */
export function TrackedClicks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const el = target?.closest<HTMLElement>("[data-track]");
      if (el) trackClick(el.dataset.track ?? "", el.dataset.trackDetail);
    };
    // auxclick: a middle-click opens the link too.
    for (const type of ["click", "auxclick"] as const)
      document.addEventListener(type, onClick, { capture: true });
    return () => {
      for (const type of ["click", "auxclick"] as const)
        document.removeEventListener(type, onClick, { capture: true });
    };
  }, []);
  return null;
}
