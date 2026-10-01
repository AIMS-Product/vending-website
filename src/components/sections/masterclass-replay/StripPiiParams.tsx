"use client";

import { useEffect } from "react";

/** Contact fields email/SMS links append to the replay URL. */
const PII_PARAMS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "name",
  "full_name",
] as const;

/**
 * Replay links arrive with ?email=&phone=&first_name=. The server has already
 * read them for attribution, so drop them from the address bar: otherwise they
 * are copied into shared links, page-view analytics and referrers. UTM params
 * stay. Renders nothing.
 */
export function StripPiiParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const present = PII_PARAMS.filter((key) => url.searchParams.has(key));
    if (!present.length) return;
    for (const key of present) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return null;
}
