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

/**
 * Wraps a server-rendered StoryList. The list hides cards past each count via
 * `group-data-[expanded=false]/stories`; this only holds the open state, so
 * every card is in the HTML and opening one never fetches anything.
 */
export function StoriesToggle({
  total,
  mobile,
  desktop,
  children,
}: StoriesToggleProps) {
  const [expanded, setExpanded] = useState(false);
  // Read by the polite live region once the cards are revealed.
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);

  // The "more" button unmounts on click; hand focus to the first card it
  // revealed instead of letting it drop to <body>. data-revealed keeps the
  // outline visible even when the click came from a pointer.
  useEffect(() => {
    if (!expanded) return;
    const first = window.matchMedia("(min-width: 768px)").matches
      ? desktop
      : mobile;
    const card = groupRef.current?.querySelector<HTMLElement>(
      `[data-story-index="${first}"]`,
    );
    const play = card?.querySelector<HTMLElement>("button");
    if (!card || !play) return;
    card.dataset.revealed = "";
    play.addEventListener("blur", () => delete card.dataset.revealed, {
      once: true,
    });
    play.focus({ preventScroll: false });
  }, [expanded, desktop, mobile]);
  const hiddenMobile = total - mobile;
  const hiddenDesktop = total - desktop;
  const button = (count: number, className: string) => (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={id}
      onClick={() => {
        setExpanded(true);
        setAnnouncement(
          `${count} more ${count === 1 ? "story" : "stories"} shown`,
        );
      }}
      className={cn(
        buttonClass({ variant: "ghost" }),
        "mx-auto mt-8 w-full sm:w-auto",
        className,
      )}
    >
      {storiesCopy.more(count)}
    </button>
  );
  return (
    <div
      ref={groupRef}
      id={id}
      className="group/stories"
      data-expanded={expanded}
    >
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {!expanded && hiddenMobile > 0
        ? button(hiddenMobile, "flex md:hidden")
        : null}
      {!expanded && hiddenDesktop > 0
        ? button(hiddenDesktop, "hidden md:flex")
        : null}
    </div>
  );
}
