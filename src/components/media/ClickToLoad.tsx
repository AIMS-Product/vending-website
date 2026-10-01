"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A play button laid over a player's box that renders `children` (the
 * player's embed snippet) only once it is pressed.
 *
 * /pre-call-resources carries fifteen Vidalytics players and every one
 * autoplays muted behind the same large "Click to unmute" card. Only the
 * first player now loads on arrival; the rest wait for this click. Tracking
 * is untouched: the player still autoplays muted once loaded, and progress
 * still counts only while it is unmuted (VideoEngagement).
 */
export function ClickToLoad({
  label,
  variant = "hero",
  playPosition = "br",
  children,
}: {
  /** Accessible name of the play button. */
  label: string;
  /**
   * "hero": a large disc centred on the player. "card": a small disc in a
   * corner, so the burned-in result text on a member's thumbnail ("$90K/MO")
   * stays readable. The whole box is clickable either way.
   */
  variant?: PlayButtonVariant;
  /** Corner for the "card" disc: bottom-right (default) or top-right. */
  playPosition?: PlayPosition;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) return children;

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      aria-label={label}
      className="group absolute inset-0 z-10 grid cursor-pointer place-items-center focus-visible:outline-none"
    >
      <PlayGlyph variant={variant} position={playPosition} />
    </button>
  );
}

export type PlayButtonVariant = "hero" | "card";
/**
 * Corner of the small "card" disc. Member thumbnails burn their result text
 * into the left and bottom-left ("$22K/MONTH", "HOW?"), so the disc sits
 * bottom-right; "tr" is for a thumbnail whose text reaches that corner too.
 */
export type PlayPosition = "br" | "tr";

/** The visible play mark inside a click-to-play facade. Decorative. */
export function PlayGlyph({
  variant,
  position = "br",
}: {
  variant: PlayButtonVariant;
  position?: PlayPosition;
}) {
  if (variant === "card") {
    return (
      <span
        aria-hidden
        className={cn(
          "border-ink group-hover:bg-tint absolute right-3 grid size-10 place-items-center rounded-full border-2 bg-white transition group-focus-visible:ring-4 group-focus-visible:ring-[#55b8e8] motion-reduce:transition-none",
          position === "tr" ? "top-3" : "bottom-3",
        )}
      >
        <span className="ml-0.5 size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[#111111]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-20 place-items-center rounded-full border-2 border-[#111111] bg-white shadow-[5px_5px_0_#111111] transition group-hover:-translate-y-0.5 group-hover:shadow-[7px_7px_0_#111111] group-focus-visible:ring-4 group-focus-visible:ring-[#55b8e8] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
    >
      <span className="ml-1.5 size-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-[#111111]" />
    </span>
  );
}
