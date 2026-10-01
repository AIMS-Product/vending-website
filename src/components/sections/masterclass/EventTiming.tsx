"use client";

import { useMemo, useSyncExternalStore } from "react";

const CENTRAL = "America/Chicago";

const subscribeToClock = (tick: () => void) => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
};
const readSecond = () => Math.floor(Date.now() / 1000) * 1000;
const readNothing = () => null;

/** "5d 06h 32m", "06h 32m" under a day, "under a minute" at the end. */
export function compactLeft(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const d = Math.floor(minutes / 1440);
  const h = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

function wallClock(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(time);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: part("weekday") ?? "",
    time: `${part("hour")}:${part("minute")} ${part("dayPeriod")}`,
    zone: part("timeZoneName") ?? timeZone,
  };
}

/**
 * "That's 8:30 PM your time (EDT)" for a visitor outside Central time; null
 * when their clock already reads the Central time, or the date is unreadable.
 * Names the weekday when the visitor's day differs from Central's.
 */
export function localTimeText(
  startsAt: string,
  timeZone: string,
): string | null {
  const time = Date.parse(startsAt);
  if (Number.isNaN(time) || !timeZone) return null;
  let local;
  try {
    local = wallClock(time, timeZone);
  } catch {
    // An unknown zone name from the browser: show nothing, the CT line stands.
    return null;
  }
  const central = wallClock(time, CENTRAL);
  if (local.time === central.time && local.weekday === central.weekday)
    return null;
  const day = local.weekday === central.weekday ? "" : `${local.weekday} `;
  return `That's ${day}${local.time} your time (${local.zone})`;
}

export function useNow() {
  return useSyncExternalStore(subscribeToClock, readSecond, readNothing);
}

/**
 * The start in the visitor's own zone, before the start only. Renders nothing
 * on the server and on a Central-time clock.
 */
export function LocalTimeLine({
  startsAt,
  className,
}: {
  startsAt: string;
  className?: string;
}) {
  const now = useNow();
  const mounted = now != null;
  // The text only depends on the start and the zone; the clock only hides it.
  const text = useMemo(
    () =>
      !mounted
        ? null
        : localTimeText(
            startsAt,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ),
    [startsAt, mounted],
  );
  if (now == null || now >= Date.parse(startsAt)) return null;
  return text ? <p className={className}>{text}</p> : null;
}

/** One-line "Starts in 5d 06h 32m", computed from the GHL start. */
export function CompactCountdown({
  startsAt,
  className,
}: {
  startsAt: string;
  className?: string;
}) {
  const now = useNow();
  if (now == null) return null;
  const left = Date.parse(startsAt) - now;
  if (!(left > 0)) return null;
  return (
    <p className={className} role="timer" aria-live="off">
      Starts in{" "}
      <span className="text-ink font-black tabular-nums">
        {compactLeft(left)}
      </span>
    </p>
  );
}
