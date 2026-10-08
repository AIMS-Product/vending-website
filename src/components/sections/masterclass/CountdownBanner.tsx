"use client";

import {
  compactLeft,
  useNow,
} from "@/components/sections/masterclass/EventTiming";
import { APPLY_QUIZ_ANCHOR } from "@/lib/content/apply-page";
import { countdownBanner } from "@/lib/content/masterclass";
import { trackCtaClick } from "@/lib/tracking/funnel-events";

/**
 * The homepage's black top bar (CohortBanner's look), counting down to the
 * live session and jumping to the form. Server render time until mounted, so
 * the first paint already has the bar; gone once the session starts.
 */
export function CountdownBanner({
  startsAt,
  renderedAt,
  lead = countdownBanner.lead,
  cta = countdownBanner.cta,
}: {
  startsAt: string | null;
  renderedAt: number;
  /** The words before the countdown; /qa says "Live Q&A starts in". */
  lead?: string;
  cta?: string;
}) {
  const now = useNow() ?? renderedAt;
  const left = startsAt ? Date.parse(startsAt) - now : NaN;
  if (!(left > 0)) return null;
  return (
    <a
      href={`#${APPLY_QUIZ_ANCHOR}`}
      onClick={() => trackCtaClick("top-bar")}
      className="flex min-h-11 items-center justify-center gap-2 border-b-2 border-[#111111] bg-[#111111] px-5 text-center text-sm font-bold text-white hover:underline focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:outline-none focus-visible:ring-inset"
    >
      <span role="timer" aria-live="off">
        {lead} <span className="tabular-nums">{compactLeft(left)}</span>
      </span>
      <span className="hidden text-[#55b8e8] sm:inline">· {cta}</span>
      <span aria-hidden className="text-[#55b8e8]">
        →
      </span>
    </a>
  );
}
