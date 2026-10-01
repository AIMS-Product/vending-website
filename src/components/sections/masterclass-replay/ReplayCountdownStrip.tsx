"use client";

import { useSyncExternalStore } from "react";
import { Countdown } from "@/components/sections/masterclass/Countdown";
import {
  replayCountdownLive,
  replayExpiresLabel,
} from "@/lib/content/masterclass-replay";

const subscribeToSeconds = (tick: () => void) => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
};
const readSecond = () => Math.floor(Date.now() / 1000) * 1000;
const readNothing = () => null;

/**
 * The countdown sits in its own tinted strip so it reads as a timer. The
 * server already drops the strip once the expiry has passed; this drops it in
 * the browser too, so an ISR copy or a tab left open past the expiry loses the
 * whole strip (label included) instead of claiming the replay has ended while
 * it still plays. Countdown gets no `expiredLabel`, so it renders nothing then.
 */
export function ReplayCountdownStrip({ expiresAt }: { expiresAt: string }) {
  const now = useSyncExternalStore(subscribeToSeconds, readSecond, readNothing);
  if (now != null && !replayCountdownLive(expiresAt, now)) return null;
  return (
    <div className="border-ink bg-tint border-b-2">
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-2 px-5 py-4 lg:flex-row lg:justify-center lg:gap-6 lg:px-10 lg:py-3">
        <p className="text-eyebrow text-sm font-black tracking-[0.14em] uppercase">
          {replayExpiresLabel}
        </p>
        <Countdown startsAt={expiresAt} />
      </div>
    </div>
  );
}
