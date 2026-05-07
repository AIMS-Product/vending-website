"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { footerColumns, type NavItem } from "@/lib/content/nav";
import { cn } from "@/lib/utils";

export function Footer() {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <footer className="border-t border-slate-100 bg-white px-6 py-16 lg:px-10">
      <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
        <Wordmark />

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {footerColumns.map((col, i) => (
            <ul key={i} className="space-y-3">
              {col.items.map((item) => (
                <FooterItem
                  key={item.label}
                  item={item}
                  highlighted={i === footerColumns.length - 1}
                />
              ))}
            </ul>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function FooterItem({
  item,
  highlighted,
}: {
  item: NavItem;
  highlighted: boolean;
}) {
  const className = cn(
    "hover:text-brand-600 text-sm text-slate-700 transition",
    highlighted && "text-brand-500",
  );

  if (item.external) {
    return (
      <li>
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {item.label}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href} className={className}>
        {item.label}
      </Link>
    </li>
  );
}
