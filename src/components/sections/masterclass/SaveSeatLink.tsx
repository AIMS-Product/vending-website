"use client";

/**
 * An in-page link (by default to the registration form). The native hash
 * jump still does the scroll (and works without JS); once it has run, focus
 * moves to `focusId` (the first field unless given) so keyboard and
 * screen-reader users land where the link went, not on <body>.
 */
export function SaveSeatLink({
  href,
  className,
  focusId = "mc-firstName",
  children,
}: {
  href: string;
  className?: string;
  /** Element focused after the jump; it needs tabIndex={-1} if not a control. */
  focusId?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        window.setTimeout(() => {
          document.getElementById(focusId)?.focus({ preventScroll: true });
        }, 0);
      }}
    >
      {children}
    </a>
  );
}
