"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Calendly iframe plus a light "Loading available times…" layer behind
 * it, so the card is never a blank box while the scheduler loads. The layer
 * is removed once Calendly itself reports in: Calendly's page is transparent
 * outside its own card, and the surface around it should read as the card,
 * not the loading state.
 *
 * The iframe's own load event is not used. Calendly's first document loads in
 * ~3s, then redirects and paints the calendar several seconds later, so
 * clearing on `onLoad` left a blank tint box in between. Instead the layer
 * clears on the first `calendly.*` message the embed posts to this page (it
 * does, because buildCalendlySrc sets `embed_domain`). A timer clears it
 * regardless, in case those messages never arrive.
 */
const LOADING_LAYER_MAX_MS = 12_000;
const CALENDLY_ORIGIN = "https://calendly.com";

function isCalendlyMessage(event: Pick<MessageEvent, "origin" | "data">) {
  if (event.origin !== CALENDLY_ORIGIN) return false;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null) return false;
  const name = (data as { event?: unknown }).event;
  return typeof name === "string" && name.startsWith("calendly.");
}

export function CalendlyFrame({
  src,
  title,
  heightClassName,
}: {
  src: string;
  title: string;
  heightClassName: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const clear = () => setLoaded(true);
    const onMessage = (event: MessageEvent) => {
      if (isCalendlyMessage(event)) clear();
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(clear, LOADING_LAYER_MAX_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [loaded]);

  return (
    <>
      {loaded ? null : (
        <div
          aria-hidden
          className="bg-tint text-ink/70 absolute inset-0 grid place-items-center text-sm font-semibold"
        >
          Loading available times…
        </div>
      )}
      <iframe
        className={cn("relative block w-full border-0", heightClassName)}
        loading="eager"
        src={src}
        title={title}
      />
    </>
  );
}

export const __testing = { isCalendlyMessage, LOADING_LAYER_MAX_MS };
