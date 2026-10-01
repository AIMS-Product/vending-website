"use client";

import { useSyncExternalStore } from "react";

const subscribeToSeconds = (tick: () => void) => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
};
const readSecond = () => Math.floor(Date.now() / 1000) * 1000;
const readNothing = () => null;

// [label, short label for phones, ms per unit, units per next-larger unit]
const UNITS = [
  ["Days", "Days", 86_400_000, Infinity],
  ["Hours", "Hrs", 3_600_000, 24],
  ["Minutes", "Min", 60_000, 60],
  ["Seconds", "Sec", 1_000, 60],
] as const;

/**
 * Counts down to the GHL start time. Computed from the date, so unlike the GHL
 * confirmation page's timer it never needs a weekly hand reset. Renders
 * nothing until mounted so the server and client never disagree on a second.
 *
 * Between `startsAt` and `endsAt` it shows `expiredLabel` (the live window);
 * after `endsAt`, or on expiry when no live label is given, it renders nothing,
 * so a stale tab never claims "live now" days later.
 */
export function Countdown({
  startsAt,
  endsAt,
  expiredLabel,
}: {
  startsAt: string;
  /** When the live window closes; after it nothing renders. */
  endsAt?: string;
  /** Shown from `startsAt` to `endsAt`. Omit to render nothing on expiry. */
  expiredLabel?: string;
}) {
  const target = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : target;
  const now = useSyncExternalStore(subscribeToSeconds, readSecond, readNothing);

  if (now == null) return <div className="h-[84px]" aria-hidden />;
  const left = target - now;
  if (left <= 0) {
    if (!expiredLabel || now >= end) return null;
    return (
      <p className="text-ink text-2xl font-black uppercase">{expiredLabel}</p>
    );
  }

  const parts = UNITS.map(([label, short, ms, wrap]) => ({
    label,
    short,
    value: Math.floor(left / ms) % wrap,
  }));

  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-live="off">
      {parts.map(({ label, short, value }) => (
        <div
          key={label}
          className="rounded-control border-ink shadow-card flex w-16 flex-col items-center border-2 bg-white py-2.5 sm:w-20"
        >
          <span className="text-ink text-3xl font-black tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-eyebrow text-xs font-black tracking-[0.12em] uppercase">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
