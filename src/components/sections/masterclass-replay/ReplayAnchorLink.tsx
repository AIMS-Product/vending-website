"use client";

import type { ReactNode } from "react";

/**
 * Inside a focus target, what takes focus: the player's play button while it
 * shows, else the loaded player's own focus group (tabindex -1), else the
 * target itself (the booking heading).
 */

function focusTarget(id: string) {
  const target = document.getElementById(id);
  if (!target) return null;
  if (target.tabIndex >= 0 || target.hasAttribute("tabindex")) return target;
  return (
    target.querySelector<HTMLElement>("button") ??
    target.querySelector<HTMLElement>("[tabindex='-1']")
  );
}

/**
 * An in-page link. The browser does the hash scroll; when the link names a
 * `focusId` (the booking heading, or the replay column), focus follows it
 * there so keyboard and screen-reader users continue from the section rather
 * than from <body>. On the replay that is the play button itself.
 */
export function ReplayAnchorLink({
  href,
  focusId,
  className,
  children,
}: {
  href: string;
  focusId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={
        focusId
          ? () => {
              // After the default hash scroll has started.
              requestAnimationFrame(() => {
                focusTarget(focusId)?.focus({ preventScroll: true });
              });
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}
