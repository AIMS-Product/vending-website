"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Calendly iframe plus a light "Loading available times…" layer behind
 * it, so the card is never a blank box while the scheduler loads. The layer
 * is removed on load: Calendly's page is transparent outside its own card,
 * and the surface around it should read as the card, not the loading state.
 * An iframe that finishes before hydration fires its load event unheard, so a
 * timer clears the layer regardless.
 */
const LOADING_LAYER_MAX_MS = 8000;

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
    const timer = setTimeout(() => setLoaded(true), LOADING_LAYER_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

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
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}
