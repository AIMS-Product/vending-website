"use client";

import type { ReactNode } from "react";

/**
 * An in-page link. The browser does the hash scroll; when the target names a
 * `focusId` (the booking heading), focus follows it there so keyboard and
 * screen-reader users continue from the section rather than from <body>.
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
                document
                  .getElementById(focusId)
                  ?.focus({ preventScroll: true });
              });
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}
