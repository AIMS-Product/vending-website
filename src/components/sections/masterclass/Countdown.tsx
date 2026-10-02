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
 * so a stale tab never claims "live now" days later. With a label and no
 * `endsAt` the label stays for good.
 */
export function countdownPhase(
  now: number,
  startsAt: string,
  endsAt?: string,
  expiredLabel?: string,
): { phase: "counting"; left: number } | { phase: "label" | "none" } {
  const target = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : expiredLabel ? Infinity : target;
  const left = target - now;
  if (left > 0) return { phase: "counting", left };
  return expiredLabel && now < end ? { phase: "label" } : { phase: "none" };
}

/** The timer's accessible name, set only when a call site gives one. */
export function timerLabelProps(label?: string): { "aria-label"?: string } {
  return label ? { "aria-label": label } : {};
}

export function Countdown({
  startsAt,
  endsAt,
  expiredLabel,
  label,
}: {
  startsAt: string;
  /** When the live window closes; after it nothing renders. */
  endsAt?: string;
  /** Shown from `startsAt` to `endsAt`. Omit to render nothing on expiry. */
  expiredLabel?: string;
  /** Accessible name for the role="timer" element. No default. */
  label?: string;
}) {
  const now = useSyncExternalStore(subscribeToSeconds, readSecond, readNothing);

  // Before mount: the same boxes, invisible, so the timer arriving never
  // moves the page (a fixed-height stand-in shifted it 8px and, in a row
  // layout, slid its neighbours sideways).
  if (now == null) return <TimerBoxes values={[0, 0, 0, 0]} placeholder />;
  const state = countdownPhase(now, startsAt, endsAt, expiredLabel);
  if (state.phase !== "counting") {
    if (state.phase === "none") return null;
    return (
      <p className="text-ink text-2xl font-black uppercase">{expiredLabel}</p>
    );
  }
  const { left } = state;

  return (
    <TimerBoxes
      values={UNITS.map(([, , ms, wrap]) => Math.floor(left / ms) % wrap)}
      label={label}
    />
  );
}

function TimerBoxes({
  values,
  label,
  placeholder = false,
}: {
  values: number[];
  label?: string;
  placeholder?: boolean;
}) {
  return (
    <div
      className={
        placeholder ? "invisible flex gap-2 sm:gap-3" : "flex gap-2 sm:gap-3"
      }
      {...(placeholder
        ? { "aria-hidden": true }
        : {
            role: "timer",
            "aria-live": "off" as const,
            ...timerLabelProps(label),
          })}
    >
      {UNITS.map(([unit, short], index) => (
        <div
          key={unit}
          className="rounded-control border-ink shadow-card flex w-16 flex-col items-center border-2 bg-white py-2.5 sm:w-24"
        >
          <span className="text-ink text-3xl font-black tabular-nums">
            {String(values[index]).padStart(2, "0")}
          </span>
          <span className="text-eyebrow text-xs font-black tracking-[0.12em] uppercase">
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
