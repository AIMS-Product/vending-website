"use client";

/**
 * An in-page link to the registration form. The native hash jump still does
 * the scroll (and works without JS); once it has run, focus moves to the
 * first field so keyboard and screen-reader users land in the form, not on
 * <body>.
 */
export function SaveSeatLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        window.setTimeout(() => {
          document
            .getElementById("mc-firstName")
            ?.focus({ preventScroll: true });
        }, 0);
      }}
    >
      {children}
    </a>
  );
}
