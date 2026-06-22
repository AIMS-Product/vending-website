"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./Wordmark";
import { primaryNav, type NavItem } from "@/lib/content/nav";

// fallow-ignore-next-line complexity
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <header className="sticky inset-x-0 top-0 z-30 border-b-2 border-[#111111] bg-[#f5fbff]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-8 px-5 py-4 lg:px-10">
        <Link
          href="/"
          aria-label="Vendingpreneurs home"
          onClick={() => setMenuOpen(false)}
        >
          <Wordmark height={48} eager />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-x-10 lg:flex"
        >
          {primaryNav.map((item) => (
            <HeaderNavLink
              key={item.label}
              item={item}
              pathname={pathname}
              className="-my-3 py-3 text-sm"
            />
          ))}
        </nav>

        <Link
          href="/apply"
          className="hidden min-h-12 items-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-7 text-sm font-black text-[#111111] uppercase shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none lg:inline-flex"
        >
          Step inside
        </Link>

        <button
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          className="flex size-11 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-white text-[#111111] shadow-[4px_4px_0_#111111] transition hover:bg-[#eaf8ff] lg:hidden"
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
          "border-t-2 border-[#111111] bg-[#f5fbff] px-5 pb-5 shadow-sm backdrop-blur-md transition lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1">
          {primaryNav.map((item) => (
            <HeaderNavLink
              key={item.label}
              item={item}
              pathname={pathname}
              className="rounded-[8px] px-2 py-3 text-base hover:bg-white"
              onClick={() => setMenuOpen(false)}
            />
          ))}
          <Link
            href="/apply"
            className="mt-3 inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-6 text-sm font-black text-[#111111] uppercase shadow-[4px_4px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => setMenuOpen(false)}
          >
            Step inside
          </Link>
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
  const isActive =
    !item.external &&
    (item.href === "/"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const classes = cn(
    "rounded-[6px] text-sm font-black text-[#111111] uppercase transition hover:text-[#066a99] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none",
    isActive && "text-[#066a99]",
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
