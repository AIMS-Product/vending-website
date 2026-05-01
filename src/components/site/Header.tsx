import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { NavLink } from "./NavLink";
import { primaryNav } from "@/lib/content/nav";

export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-6 py-6 lg:px-10">
        <Link href="/" aria-label="Vendingpreneurs home">
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-x-7 lg:flex"
        >
          {primaryNav.map((item) => (
            <NavLink key={item.label} href={item.href} external={item.external}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
