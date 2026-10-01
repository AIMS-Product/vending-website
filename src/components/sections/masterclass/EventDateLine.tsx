"use client";

import { useSyncExternalStore } from "react";
import { EventLabel } from "@/components/sections/masterclass/EventLabel";
import {
  eventPhaseCopy,
  masterclassPhase,
  type MasterclassPhase,
} from "@/lib/content/masterclass";

const subscribeToClock = (tick: () => void) => {
  const timer = setInterval(tick, 5_000);
  return () => clearInterval(timer);
};

/**
 * The phase on this clock. Hydrates with the phase the server rendered at
 * `renderedAt`, so the HTML and the first client render agree, then follows
 * the visitor's clock.
 */
export function useMasterclassPhase(
  startsAt: string | null | undefined,
  renderedAt: number,
): MasterclassPhase {
  return useSyncExternalStore(
    subscribeToClock,
    () => masterclassPhase(Date.now(), startsAt),
    () => masterclassPhase(renderedAt, startsAt),
  );
}

/**
 * The date line: the GHL date before the start, "Live now" during the live
 * window, then "Next session date coming soon" until the weekly rollover
 * writes the next date, so a past date never reads as the next session.
 */
export function EventDateLine({
  label,
  startsAt,
  renderedAt,
}: {
  label: string;
  startsAt?: string | null;
  /** Server render time (ms), for a hydration-safe first render. */
  renderedAt: number;
}) {
  const phase = useMasterclassPhase(startsAt, renderedAt);
  if (phase === "live") {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 rounded-full bg-red-600 motion-safe:animate-pulse"
        />
        {eventPhaseCopy.live}
      </span>
    );
  }
  if (phase === "ended") return <>{eventPhaseCopy.ended}</>;
  return <EventLabel label={label} startsAt={startsAt} />;
}

/** Renders its children only until the live window closes. */
export function UntilEnded({
  startsAt,
  renderedAt,
  children,
}: {
  startsAt: string | null;
  renderedAt: number;
  children: React.ReactNode;
}) {
  const phase = useMasterclassPhase(startsAt, renderedAt);
  return phase === "ended" ? null : <>{children}</>;
}
