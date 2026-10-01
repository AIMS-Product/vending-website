"use client";

import { useLayoutEffect } from "react";
import { PII_PARAMS } from "@/lib/content/masterclass";

/**
 * Removes contact details (email, phone, names) from the address bar on
 * arrival, so they are not kept in history or read by analytics page views.
 * `first` stays: the page greets the visitor with it. Layout effect, so it
 * runs before the analytics effects of later components see the URL.
 */
export function StripPiiParams() {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of PII_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, "", url);
  }, []);
  return null;
}
