"use client";

import { useSyncExternalStore } from "react";

const subscribeToSeconds = (tick: () => void) => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
};
const readSecond = () => Math.floor(Date.now() / 1000) * 1000;
const readNothing = () => null;

// [label, ms per unit, units per next-larger unit]
const UNITS = [
  ["Days", 86_400_000, Infinity],
  ["Hours", 3_600_000, 24],
  ["Minutes", 60_000, 60],
  ["Seconds", 1_000, 60],
] as const;

/**
 * Counts down to the GHL start time. Computed from the date, so unlike the GHL
 * confirmation page's timer it never needs a weekly hand reset. Renders
 * nothing until mounted so the server and client never disagree on a second.
 */
export function Countdown({ startsAt }: { startsAt: string }) {
  const target = Date.parse(startsAt);
  const now = useSyncExternalStore(subscribeToSeconds, readSecond, readNothing);

  if (now == null) return <div className="h-[88px]" aria-hidden />;
  const left = target - now;
  if (left <= 0) {
    return (
      <p className="text-ink text-2xl font-black uppercase">We are live now</p>
    );
  }

  const parts = UNITS.map(([label, ms, wrap]) => ({
    label,
    value: Math.floor(left / ms) % wrap,
  }));

  return (
    <div className="flex gap-3" role="timer" aria-live="off">
      {parts.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-control border-ink shadow-btn flex w-[72px] flex-col items-center border-2 bg-white py-2.5 sm:w-20"
        >
          <span className="text-ink text-3xl font-black tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-eyebrow text-[11px] font-black tracking-[0.12em] uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
