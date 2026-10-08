"use client";

import { ApplyStickyCta } from "@/components/sections/apply/ApplyStickyCta";
import {
  compactLeft,
  useNow,
} from "@/components/sections/masterclass/EventTiming";
import { masterclassHero, stickyEventLine } from "@/lib/content/masterclass";

/**
 * The sticky "Save my free seat" bar with a live countdown. Its line follows
 * the visitor's clock (server render time until mounted), so an open tab drops the date
 * once the session starts, like the other date lines.
 */
export function MasterclassStickyCta({
  startsAt,
  renderedAt,
  ctaLabel = masterclassHero.stickyCta,
  idleText,
}: {
  startsAt: string | null;
  renderedAt: number;
  ctaLabel?: string;
  /** Replaces "Free live masterclass" once the start has passed or with no date. */
  idleText?: string;
}) {
  const now = useNow() ?? renderedAt;
  const left = startsAt ? Date.parse(startsAt) - now : NaN;
  // Before the start the bar counts down (Liana, 2026-10-01); after it, no date.
  const countdown = left > 0 ? compactLeft(left) : null;
  const upcoming = Date.parse(startsAt ?? "") > now;
  const line =
    idleText && !upcoming ? idleText : stickyEventLine(startsAt, now);
  return (
    <ApplyStickyCta
      ctaLabel={ctaLabel}
      text={countdown ? `${line} · Starts in ${countdown}` : line}
      mobileText={
        countdown
          ? `Starts in\n${countdown}`
          : idleText && !upcoming
            ? idleText
            : stickyEventLine(startsAt, now, true)
      }
      trackAs="sticky"
    />
  );
}
