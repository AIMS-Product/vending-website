"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
};

export function NavLink({ href, children, className, external }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = !external && pathname === href;

  const classes = cn(
    "hover:text-brand-600 text-sm text-slate-700 transition",
    isActive && "text-brand-600 underline underline-offset-8",
    className,
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={classes}
    >
      {children}
    </Link>
  );
}
