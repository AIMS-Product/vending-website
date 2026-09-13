import type { ReactNode } from "react";
import Link from "next/link";
import { isViewerReadableHref } from "@/lib/admin/viewer-access";

/**
 * Renders a link when the current role can open the destination, and plain
 * text when it cannot.
 *
 * A read-only viewer sees the same numbers as everyone else, and the numbers
 * are still worth showing — but handing them a row of tiles that all bounce
 * back to where they started reads as a broken dashboard rather than as a
 * deliberate boundary. The destination's own `requireAdmin()` is what denies
 * them; this only keeps the UI honest about it.
 */
export function AdminViewerLink({
  canEdit,
  children,
  className,
  href,
}: {
  canEdit: boolean;
  children: ReactNode;
  className?: string;
  href: string;
}) {
  if (canEdit || isViewerReadableHref(href)) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return <span className={className}>{children}</span>;
}
