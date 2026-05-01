import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { footerColumns } from "@/lib/content/nav";
import { cn } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white px-6 py-16 lg:px-10">
      <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
        <Wordmark className="text-brand-500" />

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {footerColumns.map((col, i) => (
            <ul key={i} className="space-y-3">
              {col.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "hover:text-brand-600 text-sm text-slate-700 transition",
                      // Last column starts highlighted (matches the
                      // "Contact Us / Terms / Privacy" treatment in design)
                      i === footerColumns.length - 1 && "text-brand-500",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              {/* Spacer to align the columns visually */}
              {col.items.length < 3 && <li aria-hidden className="h-0" />}
            </ul>
          ))}
        </nav>
      </div>
    </footer>
  );
}
