"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { storiesCopy } from "@/lib/content/masterclass";
import { cn } from "@/lib/utils";

interface StoriesToggleProps {
  total: number;
  /** Cards visible before "more" below md. */
  mobile: number;
  /** Cards visible before "more" from md up. */
  desktop: number;
  children: React.ReactNode;
}

/** Cards each "more" tap reveals below md. */
export const MOBILE_BATCH = 6;

/**
 * Below md the stories open a batch at a time, so one tap never buries the
 * closing CTA under 21 cards. Returns how many cards show after the next tap
 * and how many the button after that would offer (0 = hide it).
 */
export function nextMobileBatch(
  visible: number,
  total: number,
  step: number = MOBILE_BATCH,
): { visible: number; nextCount: number } {
  const next = Math.min(total, visible + step);
  return { visible: next, nextCount: Math.min(step, total - next) };
}

/**
 * Wraps a server-rendered StoryList. The list hides cards past each count via
 * `group-data-[expanded=false]/stories`; this holds the open state (and, below
 * md, how many cards are open), so every card is in the HTML and opening one
 * never fetches anything.
 */
export function StoriesToggle({
  total,
  mobile,
  desktop,
  children,
}: StoriesToggleProps) {
  const [expanded, setExpanded] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(mobile);
  // Index of the first card the last tap revealed; it receives focus.
  const [revealedFrom, setRevealedFrom] = useState<number | null>(null);
  // Read by the polite live region once the cards are revealed.
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);

  // Hand focus to the first card a tap revealed instead of letting it drop
  // to <body> (the desktop button unmounts). data-revealed keeps the outline
  // visible even when the click came from a pointer.
  useEffect(() => {
    if (revealedFrom == null) return;
    const card = groupRef.current?.querySelector<HTMLElement>(
      `[data-story-index="${revealedFrom}"]`,
    );
    const play = card?.querySelector<HTMLElement>("button");
    if (!card || !play) return;
    card.dataset.revealed = "";
    play.addEventListener("blur", () => delete card.dataset.revealed, {
      once: true,
    });
    play.focus({ preventScroll: false });
  }, [revealedFrom]);

  const announce = (count: number) =>
    setAnnouncement(`${count} more ${count === 1 ? "story" : "stories"} shown`);

  const mobileRemaining = total - mobileVisible;
  const hiddenDesktop = total - desktop;
  return (
    <div
      ref={groupRef}
      id={id}
      className="group/stories"
      data-stories-group={id}
      data-expanded={expanded}
    >
      {/* Once opened, cards past the current batch stay hidden below md. */}
      {expanded && mobileVisible < total ? (
        <style>{`@media (max-width: 767.98px){[data-stories-group="${id}"] li[data-story-index]:nth-child(n+${mobileVisible + 1}){display:none}}`}</style>
      ) : null}
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {mobileRemaining > 0 ? (
        <button
          type="button"
          aria-controls={id}
          onClick={() => {
            const { visible } = nextMobileBatch(mobileVisible, total);
            setRevealedFrom(mobileVisible);
            setMobileVisible(visible);
            setExpanded(true);
            announce(visible - mobileVisible);
          }}
          className={cn(
            buttonClass({ variant: "ghost" }),
            "mx-auto mt-8 flex w-full sm:w-auto md:hidden",
          )}
        >
          {storiesCopy.more(Math.min(MOBILE_BATCH, mobileRemaining))}
        </button>
      ) : null}
      {!expanded && hiddenDesktop > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            setRevealedFrom(desktop);
            setMobileVisible(total);
            setExpanded(true);
            announce(hiddenDesktop);
          }}
          className={cn(
            buttonClass({ variant: "ghost" }),
            "mx-auto mt-8 hidden w-full sm:w-auto md:flex",
          )}
        >
          {storiesCopy.more(hiddenDesktop)}
        </button>
      ) : null}
    </div>
  );
}
