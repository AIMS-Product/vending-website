"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { PII_PARAMS } from "@/lib/content/masterclass";

/** The current URL without contact params, or null when it has none. */
function strippedUrl(): string | null {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of PII_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? url.href : null;
}

/**
 * Removes contact details (email, phone, names) from the address bar on
 * arrival, so they are not kept in history or read by analytics page views.
 * `first` stays: the page greets the visitor with it.
 *
 * Two passes. The layout effect runs before the analytics effects of later
 * components see the URL, but it keeps Next's history state, so the app router
 * still holds the PII URL as canonical: server action POSTs would go to it and
 * a cookie write would put it back in the address bar. The second pass, after
 * hydration, replaces with a null state, which Next's patched replaceState
 * adopts as the router's canonical URL without a server fetch.
 */
export function StripPiiParams() {
  const stripped = useRef<string | null>(null);
  useLayoutEffect(() => {
    const url = strippedUrl();
    if (!url) return;
    // Kept across Strict Mode's re-run, which finds the URL already clean.
    stripped.current = url;
    window.history.replaceState(window.history.state, "", url);
  }, []);
  useEffect(() => {
    if (!stripped.current) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState(
        null,
        "",
        strippedUrl() ?? window.location.href,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
