"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./Wordmark";
import { primaryNav, type NavItem } from "@/lib/content/nav";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <header className="sticky inset-x-0 top-0 z-30 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-6 py-6 lg:px-10">
        <Link
          href="/"
          aria-label="Vendingpreneurs home"
          onClick={() => setMenuOpen(false)}
        >
          <Wordmark height={48} />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-x-7 lg:flex"
        >
          {primaryNav.map((item) => (
            <HeaderNavLink
              key={item.label}
              item={item}
              pathname={pathname}
              className="text-sm"
            />
          ))}
        </nav>

        <button
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          className="ring-brand-100 hover:text-brand-600 flex size-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 transition lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">
            {menuOpen ? "Close navigation menu" : "Open navigation menu"}
          </span>
          <span aria-hidden className="flex w-5 flex-col gap-1.5">
            <span
              className={cn(
                "h-0.5 rounded-full bg-current transition",
                menuOpen && "translate-y-2 rotate-45",
              )}
            />
            <span
              className={cn(
                "h-0.5 rounded-full bg-current transition",
                menuOpen && "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-0.5 rounded-full bg-current transition",
                menuOpen && "-translate-y-2 -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Mobile primary"
        className={cn(
          "border-brand-100/70 bg-white/95 px-6 pb-5 shadow-sm backdrop-blur-md transition lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1">
          {primaryNav.map((item) => (
            <HeaderNavLink
              key={item.label}
              item={item}
              pathname={pathname}
              className="hover:bg-brand-50 rounded-md px-2 py-3 text-base"
              onClick={() => setMenuOpen(false)}
            />
          ))}
        </div>
      </nav>
    </header>
  );
}

function HeaderNavLink({
  item,
  pathname,
  className,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  className?: string;
  onClick?: () => void;
}) {
  const isActive = !item.external && pathname === item.href;
  const classes = cn(
    "hover:text-brand-600 text-slate-700 transition",
    isActive && "text-brand-600 underline underline-offset-8",
    className,
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        onClick={onClick}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={classes}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}
