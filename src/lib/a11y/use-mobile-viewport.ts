"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `sm` breakpoint is 640px, so "mobile" is anything narrower. */
const MOBILE_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True below the `sm` breakpoint; false during SSR and the first paint. */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
