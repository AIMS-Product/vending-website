"use client";

import { useId, useState } from "react";
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
  const id = useId();
  const hiddenMobile = total - mobile;
  const hiddenDesktop = total - desktop;
  const button = (count: number, className: string) => (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={id}
      onClick={() => setExpanded(true)}
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
    <div id={id} className="group/stories" data-expanded={expanded}>
      {children}
      {!expanded && hiddenMobile > 0
        ? button(hiddenMobile, "flex md:hidden")
        : null}
      {!expanded && hiddenDesktop > 0
        ? button(hiddenDesktop, "hidden md:flex")
        : null}
    </div>
  );
}
